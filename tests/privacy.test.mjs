import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createStore } from '../server/store.mjs';
import { OPERATOR } from '../server/operator.mjs';
import { cleanEnergyProfile, DAYMAIL_POLICY_VERSION, DAYMAIL_TEXT } from '../src/member-schema.mjs';
import { restoreConfiguration, validateRecoveryManifest, evaluateRecovery } from '../scripts/verify-restore.mjs';

const INITIAL_TIME = Date.parse('2026-11-14T12:00:00Z');
const DAY = 86400000;
const hash = value => createHash('sha256').update(value).digest('hex');
function input() {
  return { requestId: randomUUID(), name: 'Synthetische Privacy Persoon', channel: 'phone',
    email: 'privacy-test@example.invalid', phone: '+31600000000', postcode: '1234AB',
    topic: 'battery', message: 'Synthetische eigen hulpvraag.', shareScenario: true,
    scenario: { profile: { annualUse: 4321 } }, sourcePath: 'batterij', consentVersion: 'test-v1',
    contactText: 'Synthetisch opgeslagen adviesbewijs. Geen echt contactverzoek.',
    controller: { name: OPERATOR.name, email: OPERATOR.email },
    intake: { kind: 'housing', address: { street: 'Privacy Teststraat', houseNumber: '12', addition: 'A', city: 'Teststad' }, contactPreference: 'morning' } };
}
async function fixture(t) {
  let time = INITIAL_TIME;
  const directory = await mkdtemp(join(tmpdir(), 'zonlio-privacy-'));
  const env = { NODE_ENV: 'test', SQLITE_PATH: join(directory, 'privacy.sqlite') };
  const store = await createStore({ env, now: () => time });
  t.after(async () => { await store.close(); await rm(directory, { recursive: true, force: true }); });
  const original = input(), payloadHash = hash(JSON.stringify(original));
  const lead = (await store.createLead(original, payloadHash)).lead;
  async function subscriber(email = 'privacy-member@example.invalid') {
    let token;
    await store.members.queueChallenge({ purpose: 'subscribe', email, payload: { edition: 'evening', profile: cleanEnergyProfile({ devices: ['washing'] }) },
      tokenFor: id => { token = id + '.subscribe.synthetic-test'; return token; } });
    const result = await store.members.consumeChallenge({ tokenHash: hash(token), sessionHash: hash('not-used'),
      sessionExpires: new Date(time + DAY).toISOString(), emptyProfile: cleanEnergyProfile({}), accountVersion: 'qa-account',
      daymailVersion: DAYMAIL_POLICY_VERSION, daymailText: DAYMAIL_TEXT });
    assert.ok(result); return result.member;
  }
  function query(sql, params = []) {
    const db = new DatabaseSync(env.SQLITE_PATH);
    try { return db.prepare(sql).all(...params); } finally { db.close(); }
  }
  return { store, env, lead, original, payloadHash, subscriber, query, now: () => time, advance: ms => { time += ms; } };
}

test('dossier export contains personal source data and notes, but excludes credentials, hashes and claim tokens', async t => {
  const f = await fixture(t);
  await f.store.updateLead(f.lead.id, { status: 'assigned', actor: 'staff-private@example.invalid', note: 'Eigen dossiernotitie in synthetische test.' });
  await f.store.claimPortalEvents(1);
  const result = await f.store.privacy.exportLead(f.lead.id);
  assert.equal(result.scope, 'advice_request');
  assert.equal(result.lead.name, f.original.name);
  assert.equal(result.lead.housing.street, f.original.intake.address.street);
  assert.equal(result.lead.contact.text, f.original.contactText);
  assert.ok(result.history.some(item => item.note === 'Eigen dossiernotitie in synthetische test.'));
  assert.ok(result.history.some(item => item.actorRole === 'beheerder'));
  assert.doesNotMatch(JSON.stringify(result), /staff-private@example|payload_hash|request_id|claim_token|claimToken|session|token_hash/);
  assert.equal(await f.store.privacy.exportLead(randomUUID()), null);
});

test('correction validates data and changes a revision without broadening contact rights or resending mail', async t => {
  const f = await fixture(t);
  const saved = await f.store.privacy.correctLead(f.lead.id, { expectedRevision: 0, actor: 'qa-admin',
    fields: { name: 'Gecorrigeerde Testpersoon', phone: '06 1111 1111', postcode: '2345 cd',
      housing: { street: 'Nieuwe Teststraat', houseNumber: '4', addition: '', city: 'Teststad' } } });
  assert.equal(saved.revision, 1);
  const lead = (await f.store.getLead(f.lead.id)).lead;
  assert.equal(lead.phone, '+31611111111');
  assert.equal(lead.postcode, '2345CD');
  assert.equal(lead.housing.street, 'Nieuwe Teststraat');
  assert.equal(lead.contactRequested, true);
  assert.equal(lead.contactExpiresAt, f.lead.contactExpiresAt);
  assert.equal(lead.consentVersion, f.lead.consentVersion);
  assert.equal(lead.contactText, f.lead.contactText);
  assert.equal(lead.status, 'new');
  assert.equal((await f.store.mailStats()).pending, 0);
  const audit = f.query('SELECT * FROM zonlio_privacy_audit WHERE lead_id=?', [lead.id]);
  assert.equal(audit.length, 1);
  assert.doesNotMatch(JSON.stringify(audit), /Gecorrigeerde Testpersoon|Nieuwe Teststraat|Synthetische Privacy Persoon|31611111111/);
  assert.equal((await f.store.portalStats()).pending, 2);
  const manifest = await f.store.privacy.recoveryManifest();
  assert.equal(manifest.leadCorrections[0].revision, 1);
  assert.doesNotMatch(JSON.stringify(manifest), /Gecorrigeerde Testpersoon|Nieuwe Teststraat/);
  const replay = await f.store.createLead(f.original, f.payloadHash);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.lead.name, 'Gecorrigeerde Testpersoon', 'A browser retry never restores the older personal data');
});

test('invalid correction fields and stale revisions leave the dossier unchanged', async t => {
  const f = await fixture(t);
  for (const fields of [null, [], {}, { status: 'new' }, { contactRequested: true }, { consentVersion: 'new' }, { email: 'bad' },
    { phone: '' }, { name: 'x' }, { name: 'Name\nHeader' }, { housing: { street: 'Missing rest' } }, { postcode: 'invalid' }]) {
    await assert.rejects(f.store.privacy.correctLead(f.lead.id, { expectedRevision: 0, actor: 'qa', fields }), error => error.code === 'PRIVACY_VALIDATION');
  }
  await assert.rejects(f.store.privacy.correctLead(f.lead.id, { expectedRevision: 9, actor: 'qa', fields: { name: 'Valid Test' } }), error => error.code === 'PRIVACY_CONFLICT');
  assert.equal((await f.store.getLead(f.lead.id)).lead.revision, 0);
  assert.equal((await f.store.privacy.verificationSummary()).actions.corrected, undefined);
});

test('concurrent corrections serialize and correction of withdrawn data never restores permission', async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled(['First Test', 'Second Test'].map(name => f.store.privacy.correctLead(f.lead.id, { expectedRevision: 0, actor: 'qa', fields: { name } })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'PRIVACY_CONFLICT');
  await f.store.updateLead(f.lead.id, { status: 'withdrawn', expectedRevision: 1, actor: 'qa' });
  await f.store.privacy.correctLead(f.lead.id, { expectedRevision: 2, actor: 'qa', fields: { email: 'corrected@example.invalid' } });
  const lead = (await f.store.getLead(f.lead.id)).lead;
  assert.equal(lead.status, 'withdrawn');
  assert.equal(lead.contactRequested, false);
  assert.equal(lead.contactExpiresAt, f.lead.contactExpiresAt);
  assert.equal(lead.revision, 3);
});

test('erasure scrubs customer data, free notes and original hash while preserving stop/idempotency tombstones', async t => {
  const f = await fixture(t);
  await f.store.updateLead(f.lead.id, { status: 'assigned', actor: 'qa', expectedRevision: 0,
    note: 'Oude notitie met synthetisch prive detail.', followUp: { owner: 'Pim', nextAction: 'Synthetische klantdetails', nextActionOn: '' } });
  const [leased] = await f.store.claimOutbox(1);
  await assert.rejects(f.store.privacy.eraseLead(f.lead.id, { expectedRevision: 1, actor: 'qa', confirm: 'wrong' }), error => error.code === 'PRIVACY_VALIDATION');
  const result = await f.store.privacy.eraseLead(f.lead.id, { expectedRevision: 1, actor: 'qa', confirm: 'ERASE_LEAD_PERSONAL_DATA' });
  assert.equal(result.revision, 2);
  assert.equal(await f.store.privacy.isErased(f.lead.id), true);
  const exported = await f.store.privacy.exportLead(f.lead.id);
  assert.equal(exported.lead.name, '[Gegevens verwijderd]');
  assert.equal(exported.lead.contact.requested, false);
  assert.equal(exported.lead.status, 'withdrawn');
  assert.ok(exported.privacy.erasedAt);
  const data = f.query('SELECT * FROM leads WHERE id=?', [f.lead.id])[0];
  assert.equal(data.request_id, f.original.requestId);
  assert.equal(data.payload_hash, 'erased');
  for (const field of ['email', 'phone', 'postcode', 'scenario_json']) assert.equal(data[field], null);
  const records = [...f.query('SELECT * FROM leads WHERE id=?', [f.lead.id]), ...f.query('SELECT * FROM lead_history WHERE lead_id=?', [f.lead.id]),
    ...f.query('SELECT * FROM lead_followups WHERE lead_id=?', [f.lead.id]), ...f.query('SELECT * FROM lead_intakes WHERE lead_id=?', [f.lead.id]),
    ...f.query('SELECT * FROM zonlio_privacy_audit WHERE lead_id=?', [f.lead.id])];
  assert.doesNotMatch(JSON.stringify(records), /Synthetische Privacy Persoon|privacy-test@example|Privacy Teststraat|Oude notitie|klantdetails|4321/);
  await f.store.finishMail(leased, { success: true });
  assert.equal((await f.store.mailStats()).sent, 0, 'An obsolete mail worker cannot resurrect a cancelled claim');
  await assert.rejects(f.store.createLead(f.original, f.payloadHash), error => error.code === 'IDEMPOTENCY_CONFLICT');
  await assert.rejects(f.store.updateLead(f.lead.id, { status: 'withdrawn', actor: 'qa', note: 'Add PII again' }), error => error.code === 'LEAD_UPDATE_CONFLICT');
  await assert.rejects(f.store.privacy.correctLead(f.lead.id, { expectedRevision: 2, actor: 'qa', fields: { name: 'Reanimated Person' } }), error => error.code === 'PRIVACY_CONFLICT');
  const again = await f.store.privacy.eraseLead(f.lead.id, { expectedRevision: 2, actor: 'qa', confirm: 'ERASE_LEAD_PERSONAL_DATA' });
  assert.equal(again.alreadyErased, true);
  assert.equal(again.revision, 2);
});

test('a privacy transaction rolls back on Portal queue failure, without a half-erased dossier', async t => {
  const f = await fixture(t);
  const db = new DatabaseSync(f.env.SQLITE_PATH);
  db.exec('ALTER TABLE portal_events RENAME TO portal_events_qa_backup');
  db.close();
  try {
    await assert.rejects(f.store.privacy.eraseLead(f.lead.id, { expectedRevision: 0, actor: 'qa', confirm: 'ERASE_LEAD_PERSONAL_DATA' }));
    assert.equal((await f.store.getLead(f.lead.id)).lead.name, f.original.name);
    assert.equal(await f.store.privacy.isErased(f.lead.id), false);
    assert.equal((await f.store.mailStats()).pending, 2);
    assert.equal(f.query('SELECT COUNT(*) AS total FROM zonlio_privacy_audit')[0].total, 0);
  } finally {
    const repair = new DatabaseSync(f.env.SQLITE_PATH);
    repair.exec('ALTER TABLE portal_events_qa_backup RENAME TO portal_events');
    repair.close();
  }
});

test('retention preview is bounded and read-only; it does not silently approve or execute a policy', async t => {
  const f = await fixture(t);
  await f.store.updateLead(f.lead.id, { status: 'closed', actor: 'qa' });
  f.advance(181 * DAY);
  const before = await f.store.getLead(f.lead.id);
  const preview = await f.store.privacy.retentionPreview();
  assert.equal(preview.dryRun, true);
  assert.equal(preview.policyApproved, false);
  assert.equal(preview.counts.leadReviewCandidates, 1);
  assert.equal(preview.candidates[0].id, f.lead.id);
  assert.doesNotMatch(JSON.stringify(preview), /privacy-test@example|Synthetische Privacy Persoon|Teststraat/);
  assert.deepEqual(await f.store.getLead(f.lead.id), before);
  await assert.rejects(f.store.privacy.retentionPreview({ closedDays: 0 }), error => error.code === 'PRIVACY_VALIDATION');
  assert.equal((await f.store.privacy.verificationSummary()).automaticLeadDeletion, false);
});

test('lead privacy operations do not silently delete a separately consented account or subscription', async t => {
  const f = await fixture(t);
  const member = await f.subscriber(f.original.email);
  await f.store.privacy.eraseLead(f.lead.id, { expectedRevision: 0, actor: 'qa', confirm: 'ERASE_LEAD_PERSONAL_DATA' });
  assert.equal((await f.store.members.get(member.id)).subscription.status, 'active');
  assert.equal((await f.store.members.get(member.id)).member.email, f.original.email);
});

test('the recovery manifest preserves later withdrawals, opt-outs, bounces and member erasures without NAW or tokens', async t => {
  const f = await fixture(t);
  await f.store.updateLead(f.lead.id, { status: 'withdrawn', actor: 'qa' });
  const unsubscribed = await f.subscriber('unsubscribed@example.invalid');
  await f.store.members.unsubscribe(unsubscribed.id, DAYMAIL_POLICY_VERSION, DAYMAIL_TEXT);
  await f.store.members.suppressEmail('bounced@example.invalid', 'hard_bounce');
  const deleted = await f.subscriber('deleted@example.invalid');
  await f.store.members.deleteMember(deleted.id);
  const manifest = await f.store.privacy.recoveryManifest();
  assert.equal(manifest.schema, 'zonlio.privacy.recovery.v1');
  assert.equal(manifest.leadStops.length, 1);
  assert.equal(manifest.leadStops[0].id, f.lead.id);
  assert.equal(manifest.subscriptionStops[0].memberId, unsubscribed.id);
  assert.equal(manifest.deliverySuppressions[0].emailKey, hash('bounced@example.invalid'));
  assert.equal(manifest.memberErasures[0].memberId, deleted.id);
  assert.doesNotMatch(JSON.stringify(manifest), /unsubscribed@example|deleted@example|bounced@example|privacy-test@example|Privacy Teststraat|"(?:token|password|claimToken)":|Synthetische Privacy Persoon/);
  assert.equal(validateRecoveryManifest(manifest, f.now()), manifest);
});

test('restore configuration rejects source/production DB, active flags and inherited SMTP secrets before connecting', () => {
  const valid = { RESTORE_CHECK_ONLY: 'true', RESTORE_DB_HOST: 'localhost', RESTORE_DB_NAME: 'zonlio_restore_test', RESTORE_SOURCE_DB_NAME: 'zonlio_live',
    RESTORE_DB_USER: 'qa-readonly', RESTORE_DB_PASSWORD: 'synthetic-test-only', RESTORE_PRIVACY_MANIFEST: '/private/synthetic.json' };
  assert.equal(restoreConfiguration(valid).database, 'zonlio_restore_test');
  for (const changes of [{ RESTORE_CHECK_ONLY: 'false' }, { RESTORE_DB_NAME: 'zonlio_live' }, { RESTORE_SOURCE_DB_NAME: 'zonlio_restore_test' },
    { DB_NAME: 'zonlio_restore_test' }, { RESTORE_DB_HOST: '' }, { RESTORE_PRIVACY_MANIFEST: '' }, { PORTAL_EXPORT_ENABLED: 'true' },
    { DAYMAIL_SEND_ENABLED: 'true' }, { SMTP_PASSWORD: 'never-copy-this' }, { SMTP_PASS: 'alternate-secret' }, { RESTORE_DB_PORT: 'not-a-number' }]) {
    assert.throws(() => restoreConfiguration({ ...valid, ...changes }));
  }
});

test('older restore cannot pass while newer stop/erasure/suppression records are absent or reversed', () => {
  const leadId = randomUUID(), requestId = randomUUID(), memberId = randomUUID(), erasedMember = randomUUID(), emailKey = hash('qa@example.invalid');
  const manifest = { schema: 'zonlio.privacy.recovery.v1', createdAt: new Date(INITIAL_TIME).toISOString(),
    leadCorrections: [{ id: leadId, requestId, revision: 3, updatedAt: new Date(INITIAL_TIME).toISOString() }],
    leadStops: [{ id: leadId, requestId, status: 'withdrawn', revision: 3, contactExpiresAt: new Date(INITIAL_TIME + DAY).toISOString(), erasedAt: new Date(INITIAL_TIME).toISOString() }],
    subscriptionStops: [{ memberId, emailKey, status: 'unsubscribed', revision: 1 }],
    deliverySuppressions: [{ emailKey, reason: 'complaint' }], memberErasures: [{ memberId: erasedMember, emailKey: hash('deleted@example.invalid'), erasedAt: new Date(INITIAL_TIME).toISOString() }] };
  const stale = { leads: [{ id: leadId, requestId, status: 'new', revision: 0, contactRequested: true, contactExpiresAt: new Date(INITIAL_TIME + DAY).toISOString(), erasedAt: null, hasPersonalData: true }],
    members: [{ id: memberId, emailKey, deliveryBlocked: false }, { id: erasedMember, emailKey: hash('deleted@example.invalid'), deliveryBlocked: false }],
    subscriptions: [{ memberId, status: 'active' }], deliverySuppressions: [], memberErasures: [] };
  const failure = evaluateRecovery(manifest, stale, INITIAL_TIME);
  assert.equal(failure.privacyReconciled, false);
  for (const key of ['activeLeadContact', 'staleLeadRevision', 'revertedLeadCorrection', 'missingLeadErasure', 'residualLeadPersonalData', 'reactivatedSubscriptions', 'missingDeliverySuppressions', 'suppressedMemberUnblocked', 'resurrectedMembers', 'missingMemberErasureLedger']) assert.equal(failure.failures[key], 1, key);
  const reconciled = { leads: [{ ...stale.leads[0], status: 'withdrawn', revision: 3, contactRequested: false, erasedAt: manifest.createdAt, hasPersonalData: false }],
    members: [{ id: memberId, emailKey, deliveryBlocked: true }], subscriptions: [{ memberId, status: 'unsubscribed', revision: 1 }], deliverySuppressions: [{ emailKey }], memberErasures: [{ memberId: erasedMember }] };
  assert.equal(evaluateRecovery(manifest, reconciled, INITIAL_TIME).privacyReconciled, true);
  assert.throws(() => validateRecoveryManifest({ ...manifest, createdAt: new Date(INITIAL_TIME - 2 * DAY).toISOString() }, INITIAL_TIME));
  assert.throws(() => validateRecoveryManifest({ ...manifest, deliverySuppressions: [{ emailKey: 'plaintext@example.invalid', reason: 'complaint' }] }, INITIAL_TIME));
});

test('restore verifier fails closed on missing, downgraded, stale or identity-swapped subscription stops', () => {
  const memberId = randomUUID(), otherId = randomUUID(), emailKey = hash('stop-only@example.invalid');
  const manifest = {
    schema: 'zonlio.privacy.recovery.v1', createdAt: new Date(INITIAL_TIME).toISOString(),
    leadStops: [], leadCorrections: [], deliverySuppressions: [], memberErasures: [],
    subscriptionStops: [{ memberId, emailKey, status: 'unsubscribed', revision: 6 }],
  };
  const member = { id: memberId, emailKey, deliveryBlocked: false };
  const active = { leads: [], members: [member],
    subscriptions: [{ memberId, status: 'unsubscribed', revision: 6 }],
    deliverySuppressions: [], memberErasures: [] };
  assert.equal(evaluateRecovery(manifest, active, INITIAL_TIME).privacyReconciled, true);
  const cases = [
    ['a missing restored subscription row', { subscriptions: [] }, 'missingSubscriptionStops'],
    ['a missing restored member', { members: [] }, 'missingSubscriptionStops'],
    ['an account with a different email hash', { members: [{ ...member, emailKey: hash('wrong@example.invalid') }] }, 'missingSubscriptionStops'],
    ['an older paused state replacing an unsubscribe', { subscriptions: [{ memberId, status: 'paused', revision: 6 }] }, 'revertedSubscriptionStops'],
    ['an older revision with unchanged inactive status', { subscriptions: [{ memberId, status: 'unsubscribed', revision: 5 }] }, 'staleSubscriptionRevision'],
    ['a new account with the stopped email becoming active', { members: [{ id: otherId, emailKey, deliveryBlocked: false }],
      subscriptions: [{ memberId: otherId, status: 'active', revision: 0 }] }, 'reactivatedSubscriptions'],
  ];
  for (const [description, override, code] of cases) {
    const result = evaluateRecovery(manifest, { ...active, ...override }, INITIAL_TIME);
    assert.equal(result.privacyReconciled, false, description);
    assert.ok(result.failures[code] > 0, description + ': ' + code);
  }
  const paused = { ...manifest, subscriptionStops: [{ ...manifest.subscriptionStops[0], status: 'paused' }] };
  const stricter = { ...active, subscriptions: [{ memberId, status: 'unsubscribed', revision: 7 }] };
  assert.equal(evaluateRecovery(paused, stricter, INITIAL_TIME).privacyReconciled, true,
    'A newer unsubscribed state is at least as restrictive as a previous pause.');
});
