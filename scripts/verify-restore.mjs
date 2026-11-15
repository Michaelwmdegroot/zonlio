import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const STOPPED = new Set(['won', 'lost', 'closed', 'withdrawn']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const REQUIRED = {
  leads: ['id', 'request_id', 'payload_hash', 'contact_requested', 'contact_expires_at', 'status'],
  lead_followups: ['lead_id', 'revision'], lead_intakes: ['lead_id', 'address_json'], lead_history: ['lead_id', 'note'],
  outbox: ['lead_id', 'status', 'claim_token'], portal_events: ['lead_id', 'revision', 'status', 'claim_token'],
  zonlio_lead_privacy: ['lead_id', 'erased_at'], zonlio_privacy_audit: ['lead_id', 'action'],
  zonlio_members: ['id', 'email_key', 'delivery_blocked'], zonlio_subscriptions: ['member_id', 'status', 'revision'],
  zonlio_member_erasure: ['member_id', 'email_key', 'erased_at'],
  zonlio_delivery_suppressions: ['email_key', 'reason'], zonlio_member_mail: ['member_id', 'status'],
  zonlio_challenges: ['id', 'consumed_at'], zonlio_consent_history: ['member_id', 'state'],
  admin_sessions: ['id_hash'], zonlio_member_sessions: ['id_hash'],
};
const FLAGS = ['LEAD_ENABLED', 'HOUSING_ADVICE_ENABLED', 'MEMBER_ACCOUNTS_ENABLED', 'DAYMAIL_SIGNUP_ENABLED', 'DAYMAIL_SEND_ENABLED', 'PORTAL_EXPORT_ENABLED', 'OPS_ALERTS_ENABLED'];

/** Fail closed before creating a connection. Uses separate RESTORE_* credentials only. */
export function restoreConfiguration(env) {
  if (env.RESTORE_CHECK_ONLY !== 'true') throw new Error('RESTORE_CHECK_ONLY moet true zijn.');
  const name = env.RESTORE_DB_NAME || '', source = env.RESTORE_SOURCE_DB_NAME || '';
  if (!/^[A-Za-z0-9_]*zonlio_[A-Za-z0-9_]*(restore|test)[A-Za-z0-9_]*$/i.test(name)
    || !source || name.toLowerCase() === source.toLowerCase()
    || (env.DB_NAME && name.toLowerCase() === env.DB_NAME.toLowerCase())) {
    throw new Error('Gebruik een afzonderlijke benoemde zonlio_restore/test database, verschillend van de bron en productie.');
  }
  for (const key of ['RESTORE_DB_HOST', 'RESTORE_DB_USER', 'RESTORE_DB_PASSWORD', 'RESTORE_PRIVACY_MANIFEST']) {
    if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error(`${key} ontbreekt.`);
  }
  if (FLAGS.some(key => env[key] === 'true') || env.SMTP_PASSWORD || env.SMTP_PASS) throw new Error('Restorecontrole vereist uitgeschakelde diensten en geen SMTP-wachtwoord.');
  const port = Number(env.RESTORE_DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Ongeldige herstel-databasepoort.');
  return { host: env.RESTORE_DB_HOST, port, database: name, user: env.RESTORE_DB_USER, password: env.RESTORE_DB_PASSWORD,
    connectTimeout: 5000, multipleStatements: false, charset: 'utf8mb4' };
}

export function validateRecoveryManifest(manifest, now = Date.now()) {
  if (!manifest || manifest.schema !== 'zonlio.privacy.recovery.v1' || !Number.isFinite(Date.parse(manifest.createdAt))
    || Date.parse(manifest.createdAt) > now + 300000 || Date.parse(manifest.createdAt) < now - 24 * 3600000) {
    throw new Error('Gebruik een actueel herstelregister (maximaal 24 uur oud) uit de bevoegde bronomgeving.');
  }
  for (const field of ['leadStops', 'leadCorrections', 'subscriptionStops', 'deliverySuppressions', 'memberErasures']) {
    if (!Array.isArray(manifest[field]) || manifest[field].length > 100000) throw new Error('Ongeldig of te groot herstelregister.');
  }
  const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const revision = value => Number.isInteger(value) && value >= 0;
  if (manifest.leadStops.some(item => !item || !UUID.test(item.id || '') || !UUID.test(item.requestId || '') || !revision(item.revision)
    || !validTime(item.contactExpiresAt) || (item.erasedAt !== null && !validTime(item.erasedAt)))
    || manifest.leadCorrections.some(item => !item || !UUID.test(item.id || '') || !UUID.test(item.requestId || '') || !revision(item.revision) || !validTime(item.updatedAt))
    || manifest.subscriptionStops.some(item => !item || !UUID.test(item.memberId || '') || !HASH.test(item.emailKey || '') || !['paused', 'unsubscribed'].includes(item.status) || !revision(item.revision))
    || manifest.deliverySuppressions.some(item => !item || !HASH.test(item.emailKey || '') || !['hard_bounce', 'complaint', 'owner_request'].includes(item.reason))
    || manifest.memberErasures.some(item => !item || !UUID.test(item.memberId || '') || !HASH.test(item.emailKey || '') || !validTime(item.erasedAt))) {
    throw new Error('Ongeldige stop- of verwijderrecords in herstelregister.');
  }
  return manifest;
}

/** Compare only stops: restored active consent can never overrule a newer restriction. */
export function evaluateRecovery(manifest, snapshot, now = Date.now()) {
  validateRecoveryManifest(manifest, now);
  const failures = { missingLeadStops: 0, activeLeadContact: 0, staleLeadRevision: 0, revertedLeadCorrection: 0, missingLeadErasure: 0,
    residualLeadPersonalData: 0, reactivatedSubscriptions: 0, missingSubscriptionStops: 0,
    revertedSubscriptionStops: 0, staleSubscriptionRevision: 0, missingDeliverySuppressions: 0,
    suppressedMemberUnblocked: 0, resurrectedMembers: 0, missingMemberErasureLedger: 0 };
  const leads = new Map(snapshot.leads.map(row => [row.id, row]));
  const members = new Map(snapshot.members.map(row => [row.id, row]));
  const subscriptions = new Map(snapshot.subscriptions.map(row => [row.memberId, row]));
  const activeSubscriberEmailKeys = new Set(snapshot.subscriptions
    .filter(row => row.status === 'active')
    .map(row => members.get(row.memberId)?.emailKey).filter(Boolean));
  const suppressions = new Set(snapshot.deliverySuppressions.map(row => row.emailKey));
  const erasures = new Set(snapshot.memberErasures.map(row => row.memberId));
  const unblockedEmailKeys = new Set(snapshot.members.filter(row => !row.deliveryBlocked).map(row => row.emailKey));
  for (const stop of manifest.leadStops) {
    const row = leads.get(stop.id);
    if (!row || row.requestId !== stop.requestId) { failures.missingLeadStops++; continue; }
    if (row.contactRequested && !STOPPED.has(row.status) && Date.parse(row.contactExpiresAt) > now) failures.activeLeadContact++;
    if (row.revision < stop.revision) failures.staleLeadRevision++;
    if (stop.erasedAt && !row.erasedAt) failures.missingLeadErasure++;
    if (stop.erasedAt && row.hasPersonalData) failures.residualLeadPersonalData++;
  }
  for (const correction of manifest.leadCorrections) {
    const row = leads.get(correction.id);
    if (!row || row.requestId !== correction.requestId || row.revision < correction.revision) failures.revertedLeadCorrection++;
  }
  for (const stop of manifest.subscriptionStops) {
    const member = members.get(stop.memberId);
    const subscription = subscriptions.get(stop.memberId);
    // A backup predating a stop is not reconciled merely because the original
    // subscription row is missing. Confirm its identity and durable stop state.
    if (!member || member.emailKey !== stop.emailKey || !subscription) failures.missingSubscriptionStops++;
    if (subscription) {
      // Unsubscribed is stricter than paused. An older paused record must not
      // downgrade a later unsubscribe, even when neither sends mail today.
      if (subscription.status !== 'active'
        && subscription.status !== 'unsubscribed'
        && !(stop.status === 'paused' && subscription.status === 'paused')) failures.revertedSubscriptionStops++;
      if (!Number.isInteger(subscription.revision) || subscription.revision < stop.revision) failures.staleSubscriptionRevision++;
    }
    // Check the pseudonymous email identity as well as the member ID so a
    // different restored account cannot re-enable a previously stopped address.
    if (subscription?.status === 'active' || activeSubscriberEmailKeys.has(stop.emailKey)) failures.reactivatedSubscriptions++;
  }
  for (const stop of manifest.deliverySuppressions) {
    if (!suppressions.has(stop.emailKey)) failures.missingDeliverySuppressions++;
    if (unblockedEmailKeys.has(stop.emailKey)) failures.suppressedMemberUnblocked++;
  }
  for (const erased of manifest.memberErasures) {
    if (members.has(erased.memberId)) failures.resurrectedMembers++;
    if (!erasures.has(erased.memberId)) failures.missingMemberErasureLedger++;
  }
  return { privacyReconciled: Object.values(failures).every(count => count === 0), failures,
    compared: { leadStops: manifest.leadStops.length, leadCorrections: manifest.leadCorrections.length, subscriptionStops: manifest.subscriptionStops.length,
      deliverySuppressions: manifest.deliverySuppressions.length, memberErasures: manifest.memberErasures.length } };
}

export async function inspectRestore(connection, manifest, now = Date.now()) {
  const query = async (sql, params = []) => (await connection.execute(sql, params))[0];
  const columns = await query('SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
  const missingSchema = [];
  for (const [table, names] of Object.entries(REQUIRED)) {
    for (const name of names) if (!columns.some(row => row.TABLE_NAME === table && row.COLUMN_NAME === name)) missingSchema.push(`${table}.${name}`);
  }
  if (missingSchema.length) return { ok: false, readOnly: true, schemaReady: false, missingSchema, privacyReconciled: false };
  const count = async (sql, params = []) => Number((await query(sql, params))[0].total);
  const orphans = {};
  for (const table of ['lead_followups', 'lead_intakes', 'lead_history', 'outbox', 'portal_events', 'zonlio_lead_privacy', 'zonlio_privacy_audit']) {
    orphans[table] = await count(`SELECT COUNT(*) AS total FROM ${table} c LEFT JOIN leads p ON p.id=c.lead_id WHERE p.id IS NULL`);
  }
  const leadRows = await query(`SELECT l.id,l.request_id,l.name,l.email,l.phone,l.postcode,l.message,l.scenario_json,l.payload_hash,
    l.contact_requested,l.contact_expires_at,l.status,f.revision,f.owner_label,f.next_action,p.erased_at,i.address_json,
    (SELECT COUNT(*) FROM lead_history h WHERE h.lead_id=l.id AND (h.status<>'withdrawn' OR h.actor<>'system')) AS old_history
    FROM leads l LEFT JOIN lead_followups f ON f.lead_id=l.id LEFT JOIN zonlio_lead_privacy p ON p.lead_id=l.id LEFT JOIN lead_intakes i ON i.lead_id=l.id`);
  const snapshot = {
    leads: leadRows.map(row => ({ id: row.id, requestId: row.request_id, revision: Number(row.revision || 0), status: row.status,
      contactRequested: Boolean(row.contact_requested), contactExpiresAt: row.contact_expires_at, erasedAt: row.erased_at,
      hasPersonalData: row.name !== '[Gegevens verwijderd]' || Boolean(row.email || row.phone || row.postcode || row.message || row.scenario_json
        || row.owner_label || row.next_action || (row.address_json && row.address_json !== '{}') || row.payload_hash !== 'erased' || Number(row.old_history)) })),
    members: (await query('SELECT id,email_key,delivery_blocked FROM zonlio_members')).map(row => ({ id: row.id, emailKey: row.email_key, deliveryBlocked: Boolean(row.delivery_blocked) })),
    subscriptions: (await query('SELECT member_id,status,revision FROM zonlio_subscriptions')).map(row => ({ memberId: row.member_id, status: row.status, revision: Number(row.revision) })),
    deliverySuppressions: (await query('SELECT email_key FROM zonlio_delivery_suppressions')).map(row => ({ emailKey: row.email_key })),
    memberErasures: (await query('SELECT member_id FROM zonlio_member_erasure')).map(row => ({ memberId: row.member_id })),
  };
  const recovery = evaluateRecovery(manifest, snapshot, now);
  return { ok: Object.values(orphans).every(value => value === 0) && recovery.privacyReconciled, readOnly: true,
    schemaReady: true, orphanCounts: orphans,
    counts: { leads: snapshot.leads.length, members: snapshot.members.length,
      pendingLeadMail: await count("SELECT COUNT(*) AS total FROM outbox WHERE status IN ('pending','processing','failed')"),
      pendingMemberMail: await count("SELECT COUNT(*) AS total FROM zonlio_member_mail WHERE status IN ('pending','processing','failed')"),
      adminSessions: await count('SELECT COUNT(*) AS total FROM admin_sessions'), memberSessions: await count('SELECT COUNT(*) AS total FROM zonlio_member_sessions') },
    ...recovery,
    nextGate: 'Dit is een read-only controle van een afzonderlijke restoredatabase. Geen productieherstel of verzending vrijgegeven. Sessies, oude wachtrijen en bronconcurrentie apart controleren.' };
}

async function main() {
  let connection;
  try {
    const config = restoreConfiguration(process.env);
    const path = resolve(process.env.RESTORE_PRIVACY_MANIFEST);
    const info = await stat(path);
    if (!info.isFile() || info.size > 10 * 1024 * 1024 || (info.mode & 0o077) !== 0) throw new Error('Herstelregister moet een privébestand zijn (0600), maximaal 10 MB.');
    const bytes = await readFile(path), manifest = validateRecoveryManifest(JSON.parse(bytes.toString('utf8')));
    const { createConnection } = await import('mysql2/promise');
    connection = await createConnection(config);
    // Transaction control uses MySQL's text protocol; parameterized inspection
    // queries continue to use execute() inside inspectRestore.
    await connection.query('SET TRANSACTION READ ONLY');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const result = await inspectRestore(connection, manifest);
    await connection.rollback();
    console.log(JSON.stringify({ ...result, manifestSha256: createHash('sha256').update(bytes).digest('hex'), manifestCreatedAt: manifest.createdAt }, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    // Never expose driver messages, SQL, credentials, file paths or manifest records.
    const known = typeof error?.message === 'string' && /^(RESTORE_|Gebruik |Ongeldige |Ongeldig |Restorecontrole |Herstelregister )/.test(error.message);
    console.error(JSON.stringify({ ok: false, readOnly: true, error: known ? error.message : 'Herstelcontrole niet geslaagd; controleer veilige configuratie en schemaversie.' }));
    process.exitCode = 1;
  } finally { await connection?.end().catch(() => {}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
