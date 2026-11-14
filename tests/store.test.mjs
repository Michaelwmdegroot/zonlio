import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createStore, StoreConflict } from '../server/store.mjs';

function lead(overrides = {}) {
  return { requestId: randomUUID(), name: 'Test Aanvrager', channel: 'email', email: 'test@example.invalid', phone: '', postcode: '2311',
    topic: 'battery', message: 'Lokale test.', shareScenario: false, scenario: null, sourcePath: '2027',
    consentVersion: 'test-v1', contactText: 'Ik vraag advies per e-mail.', controller: { name: 'Testbedrijf', email: 'info@example.invalid' }, ...overrides };
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'zonlio-store-'));
  const env = { NODE_ENV: 'test', SQLITE_PATH: join(directory, 'store.sqlite') };
  let time = Date.parse('2026-11-14T12:00:00Z');
  const store = await createStore({ env, now: () => time });
  let closed = false;
  t.after(async () => { if (!closed) await store.close(); await rm(directory, { recursive: true, force: true }); });
  return { store, env, advance: (ms) => { time += ms; }, close: async () => { await store.close(); closed = true; } };
}

test('gelijktijdige herhalingen maken één lead en één set outboxtaken', async (t) => {
  const { store } = await fixture(t);
  const input = lead();
  const results = await Promise.all(Array.from({ length: 12 }, () => store.createLead(input, 'same-hash')));
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  assert.equal(new Set(results.map((r) => r.lead.reference)).size, 1);
  assert.equal((await store.stats(7)).totals.leads, 1);
  assert.equal((await store.mailStats()).pending, 2);
  await assert.rejects(() => store.createLead({ ...input, name: 'Andere naam' }, 'changed-hash'), StoreConflict);
  assert.equal((await store.getLead(results[0].lead.id)).lead.name, 'Test Aanvrager');
});

test('ontvangen aanvraag en outbox blijven na opnieuw openen bestaan', async (t) => {
  const fixtureData = await fixture(t);
  const saved = await fixtureData.store.createLead(lead(), 'persist-hash');
  await fixtureData.close();
  const reopened = await createStore({ env: fixtureData.env });
  try {
    assert.equal((await reopened.getLead(saved.lead.id)).lead.reference, saved.lead.reference);
    assert.equal((await reopened.mailStats()).pending, 2);
  } finally { await reopened.close(); }
});

test('een outboxfout rolt ook lead en aanvraagbewijs terug', async (t) => {
  const { store, env } = await fixture(t);
  const connection = new DatabaseSync(env.SQLITE_PATH);
  connection.exec('DROP TABLE outbox');
  connection.close();
  await assert.rejects(() => store.createLead(lead(), 'rollback-hash'));
  assert.equal((await store.stats(7)).totals.leads, 0);
  const verify = new DatabaseSync(env.SQLITE_PATH);
  assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM lead_history').get().total, 0);
  verify.close();
});

test('verlopen mailclaim kan worden hervat en oude worker overschrijft geen nieuwe claim', async (t) => {
  const { store, advance } = await fixture(t);
  await store.createLead(lead({ channel: 'phone', email: '', phone: '+31612345678' }), 'lease-hash');
  const [first] = await store.claimOutbox(1);
  assert.equal((await store.claimOutbox(1)).length, 0);
  advance(91000);
  const [second] = await store.claimOutbox(1);
  assert.equal(first.id, second.id);
  assert.notEqual(first.claim_token, second.claim_token);
  await store.finishMail(first, { success: true });
  assert.equal((await store.mailStats()).sent, 0);
  await store.finishMail(second, { success: true });
  assert.equal((await store.mailStats()).sent, 1);
});

test('gebeurtenissen worden ontdubbeld en ruwe weergaven blijven apart', async (t) => {
  const { store } = await fixture(t);
  const event = { event: 'calculator_complete', sessionHash: 'test-session-hash', path: '2027' };
  await store.recordEvent(event);
  await store.recordEvent(event);
  await store.recordPageView('overzicht');
  await store.recordPageView('overzicht');
  const stats = await store.stats(7);
  assert.equal(stats.totals.pageViews, 2);
  assert.equal(stats.totals.consentedSessions, 1);
  assert.equal(stats.totals.calculatorCompleted, 1);
  assert.equal(stats.daily.length, 7);
});

test('productie gebruikt nooit een lokale database als MySQL ontbreekt', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'zonlio-prod-db-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'must-not-exist.sqlite');
  await assert.rejects(() => createStore({ env: { NODE_ENV: 'production', SQLITE_PATH: path } }), /DATABASE_CONFIGURATION/);
  await assert.rejects(() => access(path));
});

test('NIVO requests start one Pim review and attention queue follows consent and due dates',async t=>{
  const f=await fixture(t);
  const input=lead({controller:{name:'NIVO Groep Holland BV',email:'info@zonlio.nl'}});
  const first=await f.store.createLead(input,'nivo-dedup-test');
  assert.equal((await f.store.createLead(input,'nivo-dedup-test')).duplicate,true);
  assert.equal(first.lead.followUp.owner,'Pim');
  assert.equal(first.lead.followUp.nextActionOn,'2026-11-14');
  assert.match(first.lead.followUp.nextAction,/beoordelen/);
  assert.equal(first.lead.status,'new','Planning review does not imply reaching the person');
  assert.equal((await f.store.stats(7)).workload.attention,1);
  assert.equal((await f.store.listLeads({queue:'attention'})).leads.length,1);
  assert.equal((await f.store.listLeads({queue:'attention',status:'won'})).leads.length,0);
  await f.store.updateLead(first.lead.id,{status:'assigned',actor:'qa',expectedRevision:0,
    followUp:{owner:'Pim',nextAction:'Controleer later',nextActionOn:'2026-11-16'}});
  assert.equal((await f.store.listLeads({queue:'attention'})).leads.length,0);
  f.advance(2*86400000);
  assert.equal((await f.store.listLeads({queue:'attention'})).leads.length,1);
  await f.store.updateLead(first.lead.id,{status:'withdrawn',actor:'qa',expectedRevision:1});
  assert.equal((await f.store.listLeads({queue:'attention'})).leads.length,0);
  assert.equal((await f.store.stats(7)).workload.attention,0);
  assert.equal((await f.store.listLeads()).leads.length,1);
});

test('expired open request is excluded from action queue even if next review date is overdue',async t=>{
  const f=await fixture(t);
  const input=lead({requestId:randomUUID(),controller:{name:'NIVO Groep Holland BV',email:'info@zonlio.nl'}});
  await f.store.createLead(input,'expiring-lead');
  f.advance(31*86400000);
  assert.equal((await f.store.listLeads({queue:'attention'})).leads.length,0);
  assert.equal((await f.store.listLeads()).leads.length,1);
});
