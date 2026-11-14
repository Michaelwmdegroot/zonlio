import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createPool } from 'mysql2/promise';
import { cleanEnergyProfile, DAYMAIL_POLICY_VERSION, DAYMAIL_TEXT } from '../src/member-schema.mjs';
import { createStore, StoreConflict } from '../server/store.mjs';

const enabled = process.env.MYSQL_TEST === '1';

test('echte MySQL: schema, transacties, idempotentie en beheerstatistieken', {
  skip: enabled ? false : 'MYSQL_TEST=1 en een lege, expliciete zonlio_*_test database zijn vereist.',
  timeout: 60000,
}, async (t) => {
  const env = process.env;
  // This test temporarily renames outbox. Never point it at a live database.
  assert.match(env.DB_NAME || '', /^zonlio_[a-z0-9_]*test[a-z0-9_]*$/i,
    'DB_NAME moet een expliciete Zonlio-testdatabase zijn; productie is niet toegestaan.');
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD']) assert.ok(env[key], `${key} ontbreekt.`);
  const pool = createPool({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), database: env.DB_NAME,
    user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 3, connectTimeout: 5000, multipleStatements: false });
  let store;
  let renamed = false;
  const backupTable = `outbox_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const requestIds = [];
  t.after(async () => {
    try {
      await store?.close();
      if (renamed) await pool.query(`RENAME TABLE \`${backupTable}\` TO outbox`);
      if (requestIds.length) {
        const marks = requestIds.map(() => '?').join(',');
        const [rows] = await pool.execute(`SELECT id FROM leads WHERE request_id IN (${marks})`, requestIds);
        if (rows.length) {
          const ids = rows.map((row) => row.id);
          const idMarks = ids.map(() => '?').join(',');
          await pool.execute(`DELETE FROM outbox WHERE lead_id IN (${idMarks})`, ids);
          await pool.execute(`DELETE FROM lead_history WHERE lead_id IN (${idMarks})`, ids);
          await pool.execute(`DELETE FROM lead_intakes WHERE lead_id IN (${idMarks})`, ids);
          await pool.execute(`DELETE FROM lead_followups WHERE lead_id IN (${idMarks})`, ids);
          await pool.execute(`DELETE FROM leads WHERE id IN (${idMarks})`, ids);
        }
      }
    } finally { await pool.end(); }
  });

  const [versionRows] = await pool.query('SELECT VERSION() AS version');
  assert.match(versionRows[0].version, /^8\./, 'Deze gate moet tegen echte MySQL 8 draaien.');
  store = await createStore({ env: { ...env, NODE_ENV: 'production' } });
  assert.equal(store.dialect, 'mysql');
  const [existing] = await pool.query('SELECT COUNT(*) AS total FROM leads');
  assert.equal(Number(existing[0].total), 0, 'Gebruik een lege, exclusieve testdatabase; bestaande aanvragen worden niet verwijderd.');

  await t.test('schema-init maakt de vereiste InnoDB-tabellen', async () => {
    const names = ['leads', 'lead_intakes', 'lead_followups', 'lead_history', 'outbox', 'admin_sessions', 'page_views', 'analytics_sessions', 'analytics_events'];
    const [tables] = await pool.execute('SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=?', [env.DB_NAME]);
    for (const name of names) assert.equal(tables.find((row) => row.TABLE_NAME === name)?.ENGINE, 'InnoDB', name);
  });

  const input = {
    requestId: randomUUID(), name: 'MySQL CI Aanvrager', channel: 'email', email: 'mysql-ci@example.invalid', phone: '',
    postcode: '2311', topic: 'battery', message: 'Uitsluitend lokale CI-testgegevens; geen e-mailverzending.',
    shareScenario: false, scenario: null, sourcePath: '2027', consentVersion: 'mysql-test-v1',
    contactText: 'Technische integratietest, geen echt contactverzoek.',
    controller: { name: 'Zonlio integratietest', email: 'ci@example.invalid' },
  };
  requestIds.push(input.requestId);
  let saved;

  await t.test('concurrente herhalingen schrijven precies één aanvraag en twee outboxtaken', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => store.createLead(input, 'mysql-same-payload')));
    assert.equal(results.filter((row) => !row.duplicate).length, 1);
    assert.equal(new Set(results.map((row) => row.lead.reference)).size, 1);
    saved = results[0].lead;
    const [queued] = await pool.execute('SELECT COUNT(*) AS total FROM outbox WHERE lead_id=?', [saved.id]);
    assert.equal(Number(queued[0].total), 2);
    await assert.rejects(() => store.createLead({ ...input, name: 'Gewijzigd' }, 'different-hash'), StoreConflict);
  });

  await t.test('status, historie, filters en statistieken werken op MySQL', async () => {
    assert.ok(saved, 'De aanvraag uit de vorige controle moet bestaan.');
    await store.updateLead(saved.id, { status: 'qualified', note: 'MySQL-statuscontrole.', actor: 'ci@example.invalid' });
    const detail = await store.getLead(saved.id);
    assert.equal(detail.lead.status, 'qualified');
    assert.equal(detail.history.length, 2);
    const list = await store.listLeads({ status: 'qualified', limit: 10 });
    assert.equal(list.leads.length, 1);
    const stats = await store.stats(7);
    assert.equal(stats.totals.leads, 1);
    assert.equal(stats.totals.qualified, 1);
    assert.equal(stats.daily.length, 7);
  });

  await t.test('outboxfout rolt lead en aanvraaghistorie samen terug', async () => {
    const rollbackInput = { ...input, requestId: randomUUID() };
    requestIds.push(rollbackInput.requestId);
    await pool.query(`RENAME TABLE outbox TO \`${backupTable}\``);
    renamed = true;
    try {
      await assert.rejects(() => store.createLead(rollbackInput, 'mysql-rollback-test'));
    } finally {
      await pool.query(`RENAME TABLE \`${backupTable}\` TO outbox`);
      renamed = false;
    }
    const [missing] = await pool.execute('SELECT COUNT(*) AS total FROM leads WHERE request_id=?', [rollbackInput.requestId]);
    assert.equal(Number(missing[0].total), 0);
    const [history] = await pool.execute('SELECT COUNT(*) AS total FROM lead_history WHERE lead_id=?', [saved.id]);
    assert.equal(Number(history[0].total), 2);
    assert.equal((await store.stats(7)).totals.leads, 1);
    assert.equal((await store.mailStats()).pending, 2);
  });

  await t.test('woningadvies en opvolging zijn transactioneel, revisieveilig en intrekbaar op MySQL', async () => {
    const housingInput = { ...input, requestId: randomUUID(), channel: 'phone', phone: '+31600000000', postcode: '2311AB',
      intake: { kind: 'housing', address: {street:'QA straat',houseNumber:'12',city:'Teststad',addition:''}, contactPreference:'morning' } };
    requestIds.push(housingInput.requestId);
    const results = await Promise.all(Array.from({length:6},()=>store.createLead(housingInput,'mysql-housing')));
    assert.equal(results.filter(row=>!row.duplicate).length,1);
    const lead = results[0].lead;
    assert.equal(lead.kind,'housing');assert.equal(lead.housing.street,'QA straat');
    const updates = await Promise.allSettled(['QA A','QA B'].map(owner=>store.updateLead(lead.id,{status:'assigned',actor:'qa',expectedRevision:0,followUp:{owner,nextAction:'Controleer vraag',nextActionOn:''}})));
    assert.equal(updates.filter(row=>row.status==='fulfilled').length,1);
    assert.equal(updates.find(row=>row.status==='rejected').reason.code,'LEAD_UPDATE_CONFLICT');
    await store.updateLead(lead.id,{status:'withdrawn',actor:'qa',expectedRevision:1});
    const detail=await store.getLead(lead.id);assert.equal(detail.lead.contactRequested,false);
    const [mail]=await pool.execute('SELECT status FROM outbox WHERE lead_id=?',[lead.id]);
    assert.ok(mail.every(row=>row.status==='cancelled'));
    await assert.rejects(store.updateLead(lead.id,{status:'new',actor:'qa'}), /niet.*heropend/);

    const failed={...housingInput,requestId:randomUUID()};requestIds.push(failed.requestId);
    await pool.query(`RENAME TABLE outbox TO \`${backupTable}\``);renamed=true;
    try{await assert.rejects(store.createLead(failed,'mysql-housing-rollback'));}
    finally{await pool.query(`RENAME TABLE \`${backupTable}\` TO outbox`);renamed=false;}
    const [remaining]=await pool.execute('SELECT id FROM leads WHERE request_id=?',[failed.requestId]);assert.equal(remaining.length,0);
    const [orphans]=await pool.execute('SELECT i.lead_id FROM lead_intakes i LEFT JOIN leads l ON l.id=i.lead_id WHERE l.id IS NULL');assert.equal(orphans.length,0);
  });

  await t.test('Mijn Zonlio: bevestiging, sessies, revisies, quota en afmelden op echte MySQL', async () => {
    const repo=store.members;const digest=value=>createHash('sha256').update(value).digest('hex');
    let issued;const email='members-mysql@example.invalid';
    const tokenFor=(id,purpose)=>{issued=`${id}.${purpose}.synthetic-no-live-token`;return issued;};
    const profile=cleanEnergyProfile({devices:['washing'],scenario:{annualUse:4321}});
    const queued=await Promise.all(Array.from({length:8},()=>repo.queueChallenge({purpose:'subscribe',email,payload:{edition:'evening',profile},tokenFor})));
    assert.equal(queued.filter(Boolean).length,1,'Per-address limits serialize across concurrent MySQL connections.');
    const token=issued;const consume=()=>repo.consumeChallenge({tokenHash:digest(token),sessionHash:digest('qa-session'),sessionExpires:new Date(Date.now()+3600000).toISOString(),emptyProfile:cleanEnergyProfile({}),accountVersion:'qa-account',daymailVersion:DAYMAIL_POLICY_VERSION,daymailText:DAYMAIL_TEXT});
    const confirmed=await Promise.all(Array.from({length:6},consume));assert.equal(confirmed.filter(Boolean).length,1);
    const id=confirmed.find(Boolean).member.id;
    try {
      const row=await repo.get(id);assert.equal(row.subscription.status,'active');assert.equal(row.member.profile.scenario.annualUse,4321);
      const changes=await Promise.allSettled([4000,5000].map(annualUse=>repo.saveProfile(id,cleanEnergyProfile({...profile,scenario:{annualUse}}),0)));
      assert.equal(changes.filter(r=>r.status==='fulfilled').length,1);assert.equal(changes.find(r=>r.status==='rejected').reason.code,'MEMBER_CONFLICT');
      const quota=await Promise.all(Array.from({length:15},()=>repo.reserveBudget('daily',10)));assert.equal(quota.filter(Boolean).length,8);
      const lease=await Promise.all(Array.from({length:5},()=>repo.acquireTask('scheduler')));assert.equal(lease.filter(Boolean).length,1);await repo.finishTask('scheduler',lease.find(Boolean),{qa:true});
      const date='2099-01-01';const subs=await repo.dueSubscribers('evening',date);assert.equal(subs.length,1);
      const jobs=await Promise.all(Array.from({length:8},()=>repo.queuePlan(subs[0],date,{status:'available',validUntil:'2099-01-01T08:00:00.000Z'})));assert.equal(jobs.filter(r=>r.changes).length,1);
      const claims=(await Promise.all([repo.claimMail(),repo.claimMail()])).flat();assert.equal(new Set(claims.map(r=>r.id)).size,claims.length,'No overlapping claims');
      await repo.unsubscribe(id,DAYMAIL_POLICY_VERSION,DAYMAIL_TEXT);
      for(const item of claims.filter(r=>r.kind==='daily'))assert.equal(await repo.mailContext(item),null);
      assert.equal((await repo.get(id)).subscription.status,'unsubscribed');
    } finally {await repo.deleteMember(id);await pool.execute('DELETE FROM zonlio_send_budget');}
    assert.equal((await repo.get(id)).member,null);
  });

  await t.test('Mijn Zonlio: outbox failure rolls back challenge on MySQL', async () => {
    const temp=`member_mail_test_${randomUUID().replaceAll('-','')}`;
    await pool.query(`RENAME TABLE zonlio_member_mail TO \`${temp}\``);
    try {await assert.rejects(store.members.queueChallenge({purpose:'login',email:'rollback-member@example.invalid',payload:{},tokenFor:id=>id}));}
    finally {await pool.query(`RENAME TABLE \`${temp}\` TO zonlio_member_mail`);}
    const [rows]=await pool.execute('SELECT id FROM zonlio_challenges WHERE email=?',['rollback-member@example.invalid']);assert.equal(rows.length,0);
  });

});
