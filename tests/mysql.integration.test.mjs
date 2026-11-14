import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createPool } from 'mysql2/promise';
import { cleanEnergyProfile, DAYMAIL_POLICY_VERSION, DAYMAIL_TEXT } from '../src/member-schema.mjs';
import { createStore, StoreConflict } from '../server/store.mjs';
import { OPERATOR } from '../server/operator.mjs';
import { portalEvent } from '../server/portal.mjs';
import { inspectRestore } from '../scripts/verify-restore.mjs';

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
          await pool.execute(`DELETE FROM zonlio_privacy_audit WHERE lead_id IN (${idMarks})`, ids);
          await pool.execute(`DELETE FROM zonlio_lead_privacy WHERE lead_id IN (${idMarks})`, ids);
          await pool.execute(`DELETE FROM portal_events WHERE lead_id IN (${idMarks})`, ids);
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
    const names = ['leads', 'lead_intakes', 'lead_followups', 'lead_history', 'outbox', 'admin_sessions', 'page_views', 'analytics_sessions', 'analytics_events', 'zonlio_lead_privacy', 'zonlio_privacy_audit', 'zonlio_member_erasure'];
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


  await t.test('Mijn Zonlio: hashed delivery stop survives deletion and blocks queued challenges on real MySQL', async () => {
    const repo=store.members;
    const email='suppression-mysql@example.invalid';
    const digest=value=>createHash('sha256').update(value).digest('hex');
    let issued,id;
    const tokenFor=(challengeId,purpose)=>{issued=`${challengeId}.${purpose}.synthetic-suppression-token`;return issued;};
    try {
      assert.equal(await repo.queueChallenge({purpose:'subscribe',email,payload:{edition:'evening',profile:cleanEnergyProfile({devices:['washing']})},tokenFor}),true);
      const confirmed=await repo.consumeChallenge({tokenHash:digest(issued),sessionHash:digest('qa-suppression-session'),sessionExpires:'2099-01-01T00:00:00.000Z',emptyProfile:cleanEnergyProfile({}),accountVersion:'qa-account',daymailVersion:DAYMAIL_POLICY_VERSION,daymailText:DAYMAIL_TEXT});
      id=confirmed.member.id;
      const [subscriber]=await repo.dueSubscribers('evening','2099-01-02');
      await repo.queuePlan(subscriber,'2099-01-02',{status:'available',validUntil:'2099-01-02T08:00:00.000Z'});
      const claimed=await repo.claimMail();
      await repo.suppressEmail(email,'complaint');
      for(const item of claimed)assert.equal(await repo.mailContext(item),null);
      assert.equal((await repo.get(id)).member.deliveryBlocked,true);
      assert.equal((await repo.suppressionForEmail(email.toUpperCase())).reason,'complaint');
      await repo.deleteMember(id);
      assert.equal(await repo.queueChallenge({purpose:'login',email,payload:{},tokenFor}),false);
      assert.equal((await repo.suppressionForEmail(email)).reason,'complaint');
    } finally {
      if(id)await repo.deleteMember(id);
      await pool.execute('DELETE FROM zonlio_delivery_suppressions WHERE email_key=?',[digest(email)]);
    }
  });


  await t.test('operations: MySQL serializes concurrent runs and rejects stale completion', async () => {
    const identities={instanceId:randomUUID(),releaseId:'mysql-ops-qa'};
    const tokens=[];
    try {
      const claims=await Promise.all(Array.from({length:8},()=>store.operations.beginRun(identities)));
      assert.equal(claims.filter(Boolean).length,1);tokens.push(...claims.filter(Boolean));
      assert.equal(await store.operations.finishRun(randomUUID(),true),false);
      await pool.execute("UPDATE zonlio_ops_lock SET locked_until=? WHERE name='maintenance' AND claim_token=?",[new Date(Date.now()-1000).toISOString(),tokens[0]]);
      assert.equal(await store.operations.finishRun(tokens[0],true),false,'An expired lease is not a successful heartbeat.');
      const replacement=await store.operations.beginRun(identities);assert.ok(replacement);tokens.push(replacement);
      assert.equal(await store.operations.finishRun(tokens[0],true),false);
      assert.equal(await store.operations.finishRun(replacement,true),true);
      const restarted=await store.operations.beginRun({instanceId:randomUUID(),releaseId:'mysql-ops-qa'});tokens.push(restarted);
      assert.equal(await store.operations.finishRun(restarted,true),true);
      const report=await store.operations.summary();
      assert.ok(report.successfulTicks24h>=2);assert.ok(report.observedInstances24h>=2);
      assert.ok(report.runs.some(run=>run.status==='interrupted'));
      assert.doesNotMatch(JSON.stringify(report),/claim_token|instance_id/);
    } finally {
      for(const token of tokens){
        await pool.execute("UPDATE zonlio_ops_lock SET claim_token=NULL,locked_until=NULL WHERE name='maintenance' AND claim_token=?",[token]);
        await pool.execute('DELETE FROM zonlio_ops_runs WHERE id=?',[token]);
      }
    }
  });

  await t.test('operations: MySQL alert claims deduplicate, observe retry cooldown and cannot resurrect resolved incidents', async () => {
    const codes=['cron_overdue','price_source'];
    const checks=codes.map(code=>({code,problem:true}));
    try {
      await store.operations.recordChecks(checks);
      await Promise.all(Array.from({length:6},()=>store.operations.recordChecks(checks)));
      const claims=await Promise.all(Array.from({length:6},()=>store.operations.claimAlertDigest()));
      assert.equal(claims.filter(Boolean).length,1);
      const first=claims.find(Boolean);assert.deepEqual(first.codes,codes);
      await store.operations.finishAlertDigest(randomUUID(),true);
      assert.equal(await store.operations.claimAlertDigest(),null,'Wrong-token completion does not release a live claim.');
      await store.operations.finishAlertDigest(first.token,true);
      assert.equal(await store.operations.claimAlertDigest(),null,'Accepted digest is not sent again inside six hours.');
      await pool.execute('UPDATE zonlio_ops_alerts SET notified_at=? WHERE code IN (?,?)',[new Date(Date.now()-7*3600000).toISOString(),...codes]);
      const retry=await store.operations.claimAlertDigest();assert.ok(retry);
      await store.operations.finishAlertDigest(retry.token,false);
      assert.equal(await store.operations.claimAlertDigest(),null,'Failed SMTP attempt has a fifteen-minute cooldown.');
      await pool.execute('UPDATE zonlio_ops_alerts SET locked_until=? WHERE code IN (?,?)',[new Date(Date.now()-1000).toISOString(),...codes]);
      const stale=await store.operations.claimAlertDigest();assert.ok(stale);
      await store.operations.recordChecks(codes.map(code=>({code,problem:false})));
      await store.operations.finishAlertDigest(stale.token,true);
      const report=await store.operations.summary();
      for(const code of codes)assert.equal(report.alerts.find(row=>row.code===code).status,'resolved');
      assert.equal(await store.operations.claimAlertDigest(),null);
    } finally {await pool.execute('DELETE FROM zonlio_ops_alerts WHERE code IN (?,?)',codes);}
  });

  await t.test('contact expiry: a previously accepted NIVO lead generates exactly one newer NAW-free stop event on MySQL', async () => {
    const request={...input,requestId:randomUUID(),controller:OPERATOR,channel:'phone',phone:'+31600000000',postcode:'2311AB',intake:{kind:'housing',address:{street:'Synthetische straat',houseNumber:'20',city:'Teststad',addition:''},contactPreference:'any'}};
    requestIds.push(request.requestId);
    const {lead}=await store.createLead(request,'mysql-expiry-qa');
    try {
      const initial=(await store.claimPortalEvents(10)).find(event=>event.lead_id===lead.id);assert.ok(initial);
      assert.equal(await store.ackPortalEvent({id:initial.id,claimToken:initial.claim_token,portalReference:'qa-expiry'}),true);
      await pool.execute('UPDATE leads SET contact_expires_at=? WHERE id=?',[new Date(Date.now()-1000).toISOString(),lead.id]);
      const concurrent=await Promise.all(Array.from({length:5},()=>store.expireContactRequests()));
      assert.equal(concurrent.reduce((sum,result)=>sum+result.expired,0),1);
      const current=await store.getLead(lead.id);assert.equal(current.lead.contactRequested,false);assert.equal(current.lead.revision,1);
      const [mails]=await pool.execute('SELECT status FROM outbox WHERE lead_id=?',[lead.id]);assert.ok(mails.every(row=>row.status==='cancelled'));
      const next=(await store.claimPortalEvents(10)).find(event=>event.lead_id===lead.id);assert.ok(next);
      const payload=portalEvent(next,current.lead,Date.now());assert.equal(payload.type,'advice.contact_expired');assert.equal(payload.revision,1);
      assert.equal(payload.contact.requested,false);assert.equal(payload.person,undefined);assert.equal(payload.housing,undefined);assert.equal(payload.scenario,undefined);
      assert.equal(await store.ackPortalEvent({id:next.id,claimToken:next.claim_token,portalReference:'qa-expiry'}),true);
      assert.equal((await store.expireContactRequests()).expired,0);
      const [events]=await pool.execute('SELECT revision FROM portal_events WHERE lead_id=? ORDER BY revision',[lead.id]);assert.deepEqual(events.map(row=>Number(row.revision)),[0,1]);
    } finally {await pool.execute('DELETE FROM portal_events WHERE lead_id=?',[lead.id]);}
  });

  await t.test('privacy: MySQL correction/erasure is transactional, revision-safe, replay-proof and recoverable without exposing NAW', async () => {
    const request = { ...input, requestId: randomUUID(), controller: OPERATOR, channel: 'phone', phone: '+31600000000', postcode: '2311AB',
      name: 'Synthetische Privacy CI', email: 'privacy-mysql@example.invalid', message: 'Private synthetic question only.', shareScenario: true, scenario: { profile: { annualUse: 4321 } },
      intake: { kind: 'housing', address: { street: 'Privacy Teststraat', houseNumber: '9', city: 'Teststad', addition: '' }, contactPreference: 'any' } };
    requestIds.push(request.requestId);
    const originalHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const { lead } = await store.createLead(request, originalHash);
    const corrections = await Promise.allSettled(['Corrected QA One', 'Corrected QA Two'].map(name =>
      store.privacy.correctLead(lead.id, { expectedRevision: 0, actor: 'mysql-qa', fields: { name } })));
    assert.equal(corrections.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(corrections.find(result => result.status === 'rejected').reason.code, 'PRIVACY_CONFLICT');
    const corrected = (await store.getLead(lead.id)).lead;
    assert.equal(corrected.revision, 1);
    assert.equal(corrected.contactRequested, true);
    assert.equal(corrected.contactExpiresAt, lead.contactExpiresAt);
    assert.equal(corrected.contactText, lead.contactText);
    assert.equal(corrected.consentVersion, lead.consentVersion);
    const correctionManifest = await store.privacy.recoveryManifest();
    assert.equal(correctionManifest.leadCorrections.find(row => row.id === lead.id).revision, 1);
    assert.doesNotMatch(JSON.stringify(correctionManifest), /privacy-mysql@example|Corrected QA|Privacy Teststraat/);

    const erased = await store.privacy.eraseLead(lead.id, { expectedRevision: 1, actor: 'mysql-qa', confirm: 'ERASE_LEAD_PERSONAL_DATA' });
    assert.equal(erased.revision, 2);
    assert.equal(erased.erased, true);
    assert.equal(await store.privacy.isErased(lead.id), true);
    const removed = (await store.getLead(lead.id)).lead;
    assert.equal(removed.name, '[Gegevens verwijderd]');
    assert.equal(removed.contactRequested, false);
    assert.ok(removed.erasedAt);
    const [raw] = await pool.execute('SELECT payload_hash,email,phone,postcode,message,scenario_json FROM leads WHERE id=?', [lead.id]);
    assert.equal(raw[0].payload_hash, 'erased');
    for (const key of ['email', 'phone', 'postcode', 'scenario_json']) assert.equal(raw[0][key], null);
    assert.equal(raw[0].message, '');
    await assert.rejects(store.createLead(request, originalHash), StoreConflict);
    await assert.rejects(store.updateLead(lead.id, { status: 'withdrawn', actor: 'mysql-qa', note: 'Must not add private notes again' }), error => error.code === 'LEAD_UPDATE_CONFLICT');
    await assert.rejects(store.privacy.correctLead(lead.id, { expectedRevision: 2, actor: 'mysql-qa', fields: { name: 'Do not restore' } }), error => error.code === 'PRIVACY_CONFLICT');
    const exported = await store.privacy.exportLead(lead.id);
    assert.doesNotMatch(JSON.stringify(exported), /privacy-mysql@example|Synthetische Privacy CI|Corrected QA|Privacy Teststraat|Private synthetic|4321|claim_token|payload_hash/);
    const events = (await store.claimPortalEvents(10)).filter(event => event.lead_id === lead.id);
    assert.equal(events.length, 3);
    for (const event of events) {
      const payload = portalEvent(event, removed, Date.now());
      assert.equal(payload.type, 'advice.erased'); assert.equal(payload.revision, 2);
      assert.equal(payload.person, undefined); assert.equal(payload.housing, undefined); assert.equal(payload.scenario, undefined);
      assert.equal(await store.ackPortalEvent({ id: event.id, claimToken: event.claim_token, portalReference: 'qa-privacy-erased' }), true);
    }
    const manifest = await store.privacy.recoveryManifest();
    assert.ok(manifest.leadStops.find(row => row.id === lead.id).erasedAt);
    assert.equal(manifest.leadCorrections.some(row => row.id === lead.id), false);
    assert.doesNotMatch(JSON.stringify(manifest), /privacy-mysql@example|Synthetische Privacy CI|Private synthetic/);
    // Same isolated CI database, read-only transaction: validates actual MySQL schema/query path,
    // not a Hostinger backup restore or independent production evidence.
    const connection = await pool.getConnection();
    try {
      await connection.execute('SET TRANSACTION READ ONLY');
      await connection.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT');
      const checked = await inspectRestore(connection, manifest);
      assert.equal(checked.schemaReady, true, JSON.stringify(checked));
      assert.equal(checked.privacyReconciled, true, JSON.stringify(checked));
      assert.equal(checked.ok, true, JSON.stringify(checked));
      assert.doesNotMatch(JSON.stringify(checked), /privacy-mysql@example|Privacy Teststraat|claim_token|password/);
    } finally { await connection.rollback(); connection.release(); }
  });

});
