import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import express from 'express';
import { createStore } from '../server/store.mjs';
import { createAuth } from '../server/auth.mjs';
import { createPortalRouter, portalEvent, PORTAL_SCHEMA, PORTAL_EVENT_TYPES } from '../server/portal.mjs';
import { OPERATOR } from '../server/operator.mjs';
import { cleanEnergyProfile, DAYMAIL_POLICY_VERSION, DAYMAIL_TEXT } from '../src/member-schema.mjs';

const INITIAL_TIME = Date.parse('2026-11-14T12:00:00Z');
const DAY = 86400000;
const SYNTHETIC_SECRET = 'portal-acceptance-synthetic-no-production-secret';
function input(overrides = {}) {
  return {
    requestId: randomUUID(), name: 'Synthetische Portal Test', channel: 'phone',
    email: 'portal-test@example.invalid', phone: '+31600000000', postcode: '1234AB',
    topic: 'battery', message: 'Uitsluitend een lokaal gefingeerd testdossier.',
    shareScenario: false, scenario: null, sourcePath: 'batterij',
    consentVersion: 'portal-contract-test-v1', contactText: 'Synthetisch contactbewijs; geen echte contacttoestemming.',
    controller: { name: OPERATOR.name, email: OPERATOR.email },
    intake: { kind: 'housing', address: { street: 'Teststraat', houseNumber: '1', addition: '', city: 'Teststad' }, contactPreference: 'morning' },
    ...overrides,
  };
}
async function fixture(t, overrides = {}) {
  let time = INITIAL_TIME;
  const directory = await mkdtemp(join(tmpdir(), 'zonlio-portal-'));
  const env = {
    NODE_ENV: 'test', SQLITE_PATH: join(directory, 'qa.sqlite'), PUBLIC_URL: 'http://zonlio.test',
    SESSION_SECRET: 'portal-test-session-key-not-used-in-production',
    LEAD_CONTROLLER_NAME: OPERATOR.name, LEAD_CONTROLLER_CONFIRMED: 'true',
    PORTAL_EXPORT_ENABLED: 'true', PORTAL_EXPORT_TOKEN: SYNTHETIC_SECRET,
    ...overrides,
  };
  const store = await createStore({ env, now: () => time });
  const auth = createAuth({ env, store, now: () => time });
  const portal = createPortalRouter({ env, store, auth, now: () => time });
  const app = express();
  app.use(express.json({ limit: '24kb', strict: true }));
  app.use('/api/portal', portal.router);
  app.use((error, _req, res, _next) => res.status(500).json({ error: 'Synthetische servicefout.' }));
  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await store.close();
    await rm(directory, { recursive: true, force: true });
  });
  async function api(path = '/claim', { body = {}, authorization = `Bearer ${SYNTHETIC_SECRET}`, type = 'application/json', method = 'POST' } = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/portal${path}`, {
      method, headers: { 'Content-Type': type, ...(authorization ? { Authorization: authorization } : {}) },
      body: method === 'GET' ? undefined : type === 'application/json' ? JSON.stringify(body) : String(body),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  async function save(overrides = {}) {
    const value = input(overrides);
    return (await store.createLead(value, createHash('sha256').update(JSON.stringify(value)).digest('hex'))).lead;
  }
  const ack = (event, portalReference = 'portal.synthetic-1') => api('/ack', {
    body: { id: event.id, claimToken: event.claimToken, portalReference },
  });
  return { env, store, portal, api, save, ack, now: () => time, advance: ms => { time += ms; } };
}

function assertStop(event, expectedType) {
  assert.equal(event.type, expectedType);
  assert.equal(event.contact.requested, false);
  for (const key of ['person', 'housing', 'scenario', 'message', 'topic', 'contactPreference', 'sourcePath']) {
    assert.equal(Object.hasOwn(event, key), false, `Stop event excludes ${key}`);
  }
  assert.doesNotMatch(JSON.stringify(event), /portal-test@example|Teststraat|Teststad|31600000000|Synthetische Portal Test/);
}

test('Portal stays closed without its own flag, confirmed matching operator and separate token', async t => {
  for (const overrides of [
    { PORTAL_EXPORT_ENABLED: undefined }, { PORTAL_EXPORT_ENABLED: 'false' },
    { LEAD_CONTROLLER_CONFIRMED: 'false' }, { LEAD_CONTROLLER_NAME: 'Onbevestigde BV' },
    { LEAD_CONTROLLER_EMAIL: 'other@example.invalid' }, { PORTAL_EXPORT_TOKEN: '' },
    { PORTAL_EXPORT_TOKEN: 'too-short' },
  ]) {
    const f = await fixture(t, overrides);
    await f.save();
    assert.equal(f.portal.enabled, false);
    const result = await f.api();
    assert.equal(result.status, 503);
    assert.equal((await f.store.portalStats()).pending, 1);
    assert.doesNotMatch(JSON.stringify(result.body), /Synthetische Portal Test|claimToken|example.invalid/);
  }
});

test('Portal bearer is header-only; invalid auth, body shape and batches cannot claim anything', async t => {
  const f = await fixture(t);
  await f.save();
  for (const authorization of ['', 'Bearer incorrect-secret', `Basic ${SYNTHETIC_SECRET}`]) {
    assert.equal((await f.api('/claim?token=' + SYNTHETIC_SECRET, { authorization })).status, 401);
  }
  assert.equal((await f.api('/claim', { type: 'text/plain', body: '{}' })).status, 415);
  for (const body of [[], { limit: 0 }, { limit: 11 }, { limit: '1' }, { limit: 1.2 }, { limit: null }, { limit: 1, email: 'injected@example.invalid' }]) {
    assert.equal((await f.api('/claim', { body })).status, 422);
  }
  assert.equal((await f.store.portalStats()).pending, 1);
});

test('active event matches the documented v1 upsert schema and only shares an explicitly chosen scenario', async t => {
  const f = await fixture(t);
  const saved = await f.save({ scenario: { profile: { annualUse: 9876 } }, shareScenario: false });
  const response = await f.api();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.body.events.length, 1);
  const [event] = response.body.events;
  assert.equal(event.schema, PORTAL_SCHEMA);
  assert.equal(event.type, 'advice.upsert');
  assert.ok(PORTAL_EVENT_TYPES.includes(event.type));
  assert.equal(event.source, 'zonlio');
  assert.equal(event.requestId, saved.id);
  assert.equal(event.reference, saved.reference);
  assert.equal(event.revision, 0);
  assert.equal(event.observedAt, new Date(f.now()).toISOString());
  assert.equal(event.leaseExpiresAt, new Date(f.now() + 120000).toISOString());
  assert.equal(event.assignmentHint, 'Pim');
  assert.equal(event.person.phone, '+31600000000');
  assert.equal(event.housing.postcode, '1234AB');
  assert.equal(event.scenario, null);
  assert.equal(event.contact.requested, true);
  assert.deepEqual(Object.keys(event).sort(), ['id', 'claimToken', 'leaseExpiresAt', 'schema', 'source', 'type', 'status', 'requestId', 'reference', 'revision', 'createdAt', 'updatedAt', 'observedAt', 'controller', 'assignmentHint', 'contact', 'person', 'housing', 'topic', 'message', 'sourcePath', 'scenario', 'contactPreference'].sort());
  await f.ack(event);
  const scenario = { profile: { annualUse: 4321 } };
  await f.save({ shareScenario: true, scenario });
  assert.deepEqual((await f.api()).body.events[0].scenario, scenario);
});

test('ack rejects forged identifiers and references before touching the lease', async t => {
  const f = await fixture(t);
  await f.save();
  const [event] = (await f.api()).body.events;
  const valid = { id: event.id, claimToken: event.claimToken, portalReference: 'portal.synthetic-1' };
  for (const body of [
    [], { ...valid, id: '-'.repeat(36) }, { ...valid, claimToken: ['not-a-string'] },
    { ...valid, portalReference: 'person@example.invalid' }, { ...valid, portalReference: 'x'.repeat(121) },
    { ...valid, secret: SYNTHETIC_SECRET },
  ]) assert.equal((await f.api('/ack', { body })).status, 422);
  assert.equal((await f.ack({ ...event, claimToken: randomUUID() })).status, 409);
  assert.equal((await f.ack(event)).status, 200);
  assert.equal((await f.ack(event)).status, 200, 'Same durable receipt is idempotent');
  assert.equal((await f.ack(event, 'different-reference')).status, 409);
  assert.equal((await f.api()).body.events.length, 0);
});

test('parallel claims do not overlap; expired lease gets a new token and old workers cannot ack', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 7; i++) await f.save();
  const results = await Promise.all(Array.from({ length: 4 }, () => f.api('/claim', { body: { limit: 2 } })));
  const events = results.flatMap(result => result.body.events);
  assert.equal(events.length, 7);
  assert.equal(new Set(events.map(event => event.id)).size, 7);
  assert.equal((await f.api()).body.events.length, 0);
  f.advance(120000);
  assert.equal((await f.ack(events[0])).status, 409, 'Lease expires at its exact boundary');
  const reclaimed = (await f.api('/claim', { body: { limit: 10 } })).body.events;
  assert.equal(reclaimed.length, 7);
  for (const event of reclaimed) {
    const old = events.find(item => item.id === event.id);
    assert.notEqual(event.claimToken, old.claimToken);
    assert.equal((await f.ack(old)).status, 409);
    assert.equal((await f.ack(event, 'portal.' + event.requestId)).status, 200);
  }
  assert.equal((await f.api()).body.events.length, 0);
});

test('unacknowledged Portal outage persists across a store reopen and can be replayed safely', async t => {
  const f = await fixture(t);
  await f.save();
  const [first] = (await f.api()).body.events;
  // A separate connection simulates a fresh process seeing the same durable store.
  const reopened = await createStore({ env: f.env, now: f.now });
  try {
    assert.equal((await reopened.portalStats()).leased, 1);
    assert.equal((await reopened.claimPortalEvents(1)).length, 0);
    f.advance(120001);
    const [second] = await reopened.claimPortalEvents(1);
    assert.equal(second.id, first.id);
    assert.notEqual(second.claim_token, first.claimToken);
    assert.equal(await reopened.ackPortalEvent({ id: first.id, claimToken: first.claimToken, portalReference: 'old-worker' }), false);
    assert.equal(await reopened.ackPortalEvent({ id: second.id, claimToken: second.claim_token, portalReference: 'durable-receipt' }), true);
    assert.equal((await f.store.portalStats()).accepted, 1);
  } finally { await reopened.close(); }
});

test('late claim serializes the latest revision; withdrawal strips NAW from every outstanding event', async t => {
  const f = await fixture(t);
  const saved = await f.save({ shareScenario: true, scenario: { profile: { annualUse: 4321 } } });
  await f.store.updateLead(saved.id, { status: 'assigned', actor: 'synthetic-qa', expectedRevision: 0 });
  await f.store.updateLead(saved.id, { status: 'withdrawn', actor: 'synthetic-qa', expectedRevision: 1 });
  const events = (await f.api()).body.events;
  assert.equal(events.length, 3);
  for (const event of events) {
    assert.equal(event.requestId, saved.id);
    assert.equal(event.revision, 2, 'Queue entries are notifications of the current state, not historical PII snapshots');
    assertStop(event, 'advice.withdrawn');
    assert.equal((await f.ack(event)).status, 200);
  }
  assert.equal((await f.api()).body.events.length, 0);
  await assert.rejects(f.store.updateLead(saved.id, { status: 'new', actor: 'synthetic-qa' }), /niet.*heropend/);
});

test('a withdrawal after an earlier claim is a newer durable stop, even if the old ack arrives later', async t => {
  const f = await fixture(t);
  const saved = await f.save();
  const [old] = (await f.api()).body.events;
  await f.store.updateLead(saved.id, { status: 'withdrawn', actor: 'synthetic-qa', expectedRevision: 0 });
  const [stop] = (await f.api()).body.events;
  assertStop(stop, 'advice.withdrawn');
  assert.ok(stop.revision > old.revision);
  assert.equal((await f.ack(stop)).status, 200);
  assert.equal((await f.ack(old)).status, 200);
  const latest = (await f.store.getLead(saved.id)).lead;
  assert.equal(latest.status, 'withdrawn');
  assert.equal(latest.contactRequested, false);
  assert.equal(latest.revision, stop.revision, 'Transport acknowledgement never reopens business state');
});

test('an already accepted request emits one newer expiry-stop without re-exporting contact data', async t => {
  const f = await fixture(t);
  const saved = await f.save();
  const [initial] = (await f.api()).body.events;
  assert.equal((await f.ack(initial)).status, 200);
  f.advance(30 * DAY);
  const [expired] = (await f.api()).body.events;
  assert.ok(expired, 'Expiry must enqueue a stop even after the original event was accepted');
  assertStop(expired, 'advice.contact_expired');
  assert.equal(expired.requestId, saved.id);
  assert.equal(expired.revision, initial.revision + 1);
  assert.notEqual(expired.id, initial.id);
  const record = await f.store.getLead(saved.id);
  assert.equal(record.lead.contactRequested, false);
  assert.equal(record.lead.followUp.nextAction, '');
  assert.equal(record.lead.followUp.nextActionOn, '');
  assert.equal((await f.ack(expired)).status, 200);
  const repeats = await Promise.all(Array.from({ length: 5 }, () => f.store.expireContactRequests({ limit: 100 })));
  assert.ok(repeats.every(result => result.expired === 0));
  assert.equal((await f.api()).body.events.length, 0);
  assert.equal((await f.store.portalStats()).accepted, 2);
});

test('closure types never contain a person, housing, message or scenario', async t => {
  const f = await fixture(t);
  for (const status of ['won', 'lost', 'closed']) {
    const saved = await f.save();
    const [upsert] = (await f.api()).body.events;
    await f.ack(upsert);
    await f.store.updateLead(saved.id, { status, actor: 'synthetic-qa' });
    const [closed] = (await f.api()).body.events;
    assertStop(closed, 'advice.closed');
    assert.equal(closed.status, status);
    await f.ack(closed);
  }
});

test('general advice, a different controller and a confirmed daymail subscription never become Portal sales events', async t => {
  const f = await fixture(t);
  await f.save({ intake: undefined });
  await f.save({ controller: { name: 'Ander testbedrijf', email: 'other@example.invalid' } });
  let rawToken;
  await f.store.members.queueChallenge({
    purpose: 'subscribe', email: 'portal-subscriber@example.invalid',
    payload: { edition: 'evening', profile: cleanEnergyProfile({ devices: ['washing'] }) },
    tokenFor: id => { rawToken = `${id}.subscribe.synthetic-test`; return rawToken; },
  });
  const digest = value => createHash('sha256').update(value).digest('hex');
  const consumed = await f.store.members.consumeChallenge({
    tokenHash: digest(rawToken), sessionHash: digest('unused-subscription-session'),
    sessionExpires: new Date(f.now() + DAY).toISOString(), emptyProfile: cleanEnergyProfile({}),
    accountVersion: 'test-account-v1', daymailVersion: DAYMAIL_POLICY_VERSION, daymailText: DAYMAIL_TEXT,
  });
  assert.ok(consumed);
  assert.equal((await f.store.members.stats()).subscriptions.active, 1);
  assert.equal((await f.api()).body.events.length, 0);
  assert.equal(portalEvent({ id: randomUUID() }, { ...input(), kind: 'general' }, f.now()), null);
  assert.equal(portalEvent({ id: randomUUID() }, { ...input(), kind: 'housing', controller: { name: 'Other' } }, f.now()), null);
});

test('valid Portal consumers are rate-limited without leaking payloads or secrets', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 60; i++) assert.equal((await f.api()).status, 200);
  const limited = await f.api();
  assert.equal(limited.status, 429);
  assert.doesNotMatch(JSON.stringify(limited.body), new RegExp(SYNTHETIC_SECRET));
  f.advance(60001);
  assert.equal((await f.api()).status, 200);
});

test('lead erasure has a distinct stop event so the receiver can erase old PII instead of merely stopping contact', async t => {
  const f = await fixture(t);
  const saved = await f.save();
  const [upsert] = (await f.api()).body.events;
  await f.ack(upsert);
  const erased = await f.store.privacy.eraseLead(saved.id, {
    expectedRevision: 0, actor: 'synthetic-qa', confirm: 'ERASE_LEAD_PERSONAL_DATA',
  });
  assert.equal(erased.erased, true);
  const [event] = (await f.api()).body.events;
  assertStop(event, 'advice.erased');
  assert.equal(event.erasedAt, new Date(f.now()).toISOString());
  assert.equal(event.revision, 1);
  assert.ok(PORTAL_EVENT_TYPES.includes(event.type));
  await f.ack(event);
  assert.equal((await f.api()).body.events.length, 0);
});
