import { randomUUID } from 'node:crypto';
import { domainToASCII } from 'node:url';
import { housingFieldErrors } from '../src/advice-schema.mjs';
import { OPERATOR } from './operator.mjs';

const DAY = 86400000;
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS zonlio_lead_privacy (lead_id VARCHAR(36) PRIMARY KEY, erased_at VARCHAR(27), last_action_at VARCHAR(27) NOT NULL, FOREIGN KEY (lead_id) REFERENCES leads(id))`,
  `CREATE TABLE IF NOT EXISTS zonlio_privacy_audit (id VARCHAR(36) PRIMARY KEY, lead_id VARCHAR(36) NOT NULL, action VARCHAR(24) NOT NULL, fields_json TEXT NOT NULL, actor VARCHAR(254) NOT NULL, created_at VARCHAR(27) NOT NULL, FOREIGN KEY (lead_id) REFERENCES leads(id))`,
];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const actorName = actor => typeof actor === 'string' && actor.length > 0 && actor.length <= 254 && !/[\u0000-\u001f\u007f]/.test(actor);
const text = (value, max, required = false) => typeof value === 'string' && value.trim().length <= max
  && (!required || value.trim().length >= 2) && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : null;
function email(value) {
  const valueText = text(value, 254);
  if (valueText === '') return '';
  if (valueText === null || valueText.split('@').length !== 2) return null;
  const [local, domainRaw] = valueText.split('@');
  const domain = domainToASCII(domainRaw).toLowerCase();
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || !domain.includes('.') || `${local}@${domain}`.length > 254
    || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return `${local}@${domain}`;
}
function phone(value) {
  const clean = text(value, 40);
  if (clean === '') return '';
  if (clean === null || !/^[+\d\s().-]+$/.test(clean)) return null;
  let result = clean.replace(/[\s().-]/g, '');
  if (result.startsWith('00')) result = '+' + result.slice(2);
  else if (result.startsWith('0')) result = '+31' + result.slice(1);
  return /^\+?[1-9]\d{6,14}$/.test(result) ? result : null;
}
export class PrivacyValidation extends Error {
  constructor(fieldErrors = { form: 'Controleer de privacyhandeling.' }) {
    super('Controleer de privacyhandeling.'); this.code = 'PRIVACY_VALIDATION'; this.fieldErrors = fieldErrors;
  }
}
export class PrivacyConflict extends Error {
  constructor(message = 'Het dossier is gewijzigd of de persoonsgegevens zijn al verwijderd. Open het opnieuw.') {
    super(message); this.code = 'PRIVACY_CONFLICT';
  }
}
function validateFields(fields, row, intake) {
  if (!object(fields) || Object.keys(fields).length === 0
    || Object.keys(fields).some(key => !['name', 'email', 'phone', 'postcode', 'housing'].includes(key))) {
    throw new PrivacyValidation({ fields: 'Wijzig alleen naam, e-mail, telefoon, postcode of woningadres.' });
  }
  const errors = {}, cleaned = {};
  if (Object.hasOwn(fields, 'name')) {
    cleaned.name = text(fields.name, 120, true);
    if (!cleaned.name) errors.name = 'Vul een naam in van 2–120 tekens.';
  }
  if (Object.hasOwn(fields, 'email')) {
    cleaned.email = email(fields.email);
    if (cleaned.email === null || (row.channel === 'email' && !cleaned.email)) errors.email = 'Vul een geldig e-mailadres in.';
  }
  if (Object.hasOwn(fields, 'phone')) {
    cleaned.phone = phone(fields.phone);
    if (cleaned.phone === null || (row.channel === 'phone' && !cleaned.phone)) errors.phone = 'Vul een geldig telefoonnummer in.';
  }
  if (Object.hasOwn(fields, 'postcode')) {
    const value = text(fields.postcode, 10);
    cleaned.postcode = value?.replace(/\s/g, '').toUpperCase();
    if (value === null || (cleaned.postcode && !/^[1-9]\d{3}(?:[A-Z]{2})?$/.test(cleaned.postcode))) errors.postcode = 'Vul een geldige Nederlandse postcode in.';
  }
  if (intake?.kind === 'housing') {
    const housing = Object.hasOwn(fields, 'housing') ? fields.housing : JSON.parse(intake.address_json);
    const validation = housingFieldErrors({ housing, postcode: cleaned.postcode ?? row.postcode, topic: row.topic, contactPreference: intake.contact_preference });
    Object.assign(errors, validation);
    if (Object.hasOwn(fields, 'housing') && Object.keys(validation).length === 0) {
      cleaned.housing = Object.fromEntries(['street', 'houseNumber', 'addition', 'city'].map(key => [key, (housing[key] || '').trim()]));
    }
  } else if (Object.hasOwn(fields, 'housing')) errors.housing = 'Dit dossier heeft geen woningintake.';
  if (Object.keys(errors).length) throw new PrivacyValidation(errors);
  return cleaned;
}

/** Private, revision-protected rights operations. No automatic retention deletion. */
export async function createPrivacyRepository({ adapter, now }) {
  const mysql = adapter.dialect === 'mysql', lock = mysql ? ' FOR UPDATE' : '';
  const ignore = mysql ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
  const stamp = () => new Date(now()).toISOString();
  for (const sql of SCHEMA) await adapter.work(db => db.run(sql + (mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '')));
  async function state(db, id, expectedRevision) {
    // Same parent-first lock order as status updates; correction and erasure cannot race into reopening.
    const row = await db.get(`SELECT * FROM leads WHERE id=?${lock}`, [id]);
    if (!row) return null;
    const followUp = await db.get('SELECT * FROM lead_followups WHERE lead_id=?', [id]);
    const privacy = await db.get('SELECT * FROM zonlio_lead_privacy WHERE lead_id=?', [id]);
    const revision = Number(followUp?.revision || 0);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new PrivacyValidation({ expectedRevision: 'Open de actuele versie van het dossier.' });
    if (expectedRevision !== revision) throw new PrivacyConflict();
    return { row, followUp, privacy, revision, intake: await db.get('SELECT * FROM lead_intakes WHERE lead_id=?', [id]) };
  }
  async function audit(db, id, action, fields, actor, at) {
    await db.run('INSERT INTO zonlio_privacy_audit (id,lead_id,action,fields_json,actor,created_at) VALUES (?,?,?,?,?,?)',
      [randomUUID(), id, action, JSON.stringify(fields), actor, at]);
  }
  async function revisionEvent(db, s, revision, at) {
    if (s.intake?.kind === 'housing' && s.row.controller_name === OPERATOR.name
      && !await db.get('SELECT lead_id FROM zonlio_acceptance_leads WHERE lead_id=?', [s.row.id])) {
      await db.run('INSERT INTO portal_events (id,unique_key,lead_id,revision,status,created_at) VALUES (?,?,?,?,?,?)',
        [randomUUID(), `${s.row.id}:${revision}`, s.row.id, revision, 'pending', at]);
    }
  }
  async function cancelMail(db, id, reason) {
    await db.run("UPDATE outbox SET status='cancelled',claim_token=NULL,locked_until=NULL,last_error=? WHERE lead_id=? AND status IN ('pending','processing','failed')", [reason, id]);
  }
  const repo = {
    async isErased(id) {
      return adapter.work(async db => Boolean((await db.get('SELECT erased_at FROM zonlio_lead_privacy WHERE lead_id=?', [id]))?.erased_at));
    },
    async exportLead(id) {
      return adapter.work(async db => {
        const row = await db.get('SELECT * FROM leads WHERE id=?', [id]);
        if (!row) return null;
        const intake = await db.get('SELECT * FROM lead_intakes WHERE lead_id=?', [id]);
        const followUp = await db.get('SELECT * FROM lead_followups WHERE lead_id=?', [id]);
        const privacy = await db.get('SELECT erased_at,last_action_at FROM zonlio_lead_privacy WHERE lead_id=?', [id]);
        const history = await db.all('SELECT status,note,actor,created_at FROM lead_history WHERE lead_id=? ORDER BY created_at,id', [id]);
        const mail = await db.all('SELECT kind,status,created_at,sent_at FROM outbox WHERE lead_id=? ORDER BY created_at,id', [id]);
        const portal = await db.all('SELECT revision,status,created_at,accepted_at FROM portal_events WHERE lead_id=? ORDER BY created_at,id', [id]);
        return {
          exportedAt: stamp(), scope: 'advice_request',
          lead: {
            id: row.id, reference: row.reference, name: row.name, email: row.email || '', phone: row.phone || '',
            postcode: row.postcode || '', channel: row.channel, topic: row.topic, message: row.message,
            housing: intake ? JSON.parse(intake.address_json) : null, contactPreference: intake?.contact_preference || 'any',
            sourcePath: row.source_path, scenario: row.scenario_json ? JSON.parse(row.scenario_json) : null,
            shareScenario: Boolean(row.share_scenario), controller: { name: row.controller_name, email: row.controller_email },
            contact: { requested: Boolean(row.contact_requested), expiresAt: row.contact_expires_at, version: row.consent_version, text: row.contact_text },
            status: row.status, revision: Number(followUp?.revision || 0), createdAt: row.created_at, updatedAt: row.updated_at,
            followUp: { owner: followUp?.owner_label || '', nextAction: followUp?.next_action || '', nextActionOn: followUp?.next_action_on || '' },
          },
          history: history.map(item => ({ status: item.status, note: item.note, actorRole: ['website', 'system'].includes(item.actor) ? item.actor : 'beheerder', createdAt: item.created_at })),
          mail: mail.map(item => ({ kind: item.kind, status: item.status, createdAt: item.created_at, sentAt: item.sent_at })),
          portal: portal.map(item => ({ revision: Number(item.revision), status: item.status, createdAt: item.created_at, acceptedAt: item.accepted_at })),
          privacy: { erasedAt: privacy?.erased_at || null, lastActionAt: privacy?.last_action_at || null },
          note: 'Dossierexport met opgeslagen eigen gegevens en dossiernotities. Controleer het verzoek en rechten van anderen vóór veilige verstrekking. Accounts en dagmails hebben een afzonderlijke export.',
        };
      }, true);
    },
    async correctLead(id, { expectedRevision, fields, actor } = {}) {
      if (!actorName(actor)) throw new PrivacyValidation();
      return adapter.work(async db => {
        const s = await state(db, id, expectedRevision);
        if (!s) return null;
        if (s.privacy?.erased_at) throw new PrivacyConflict();
        const cleaned = validateFields(fields, s.row, s.intake), at = stamp(), revision = s.revision + 1;
        for (const key of ['name', 'email', 'phone', 'postcode']) {
          if (Object.hasOwn(cleaned, key)) await db.run(`UPDATE leads SET ${key}=? WHERE id=?`, [cleaned[key] || null, id]);
        }
        if (cleaned.housing) await db.run('UPDATE lead_intakes SET address_json=? WHERE lead_id=?', [JSON.stringify(cleaned.housing), id]);
        await db.run('UPDATE leads SET updated_at=? WHERE id=?', [at, id]);
        await db.run(`${ignore} INTO lead_followups (lead_id,owner_label,next_action,next_action_on,revision) VALUES (?,?,?,?,?)`, [id, '', '', null, 0]);
        await db.run('UPDATE lead_followups SET revision=? WHERE lead_id=?', [revision, id]);
        await db.run(`${ignore} INTO zonlio_lead_privacy (lead_id,last_action_at) VALUES (?,?)`, [id, at]);
        await db.run('UPDATE zonlio_lead_privacy SET last_action_at=? WHERE lead_id=?', [at, id]);
        const names = Object.keys(cleaned).sort();
        await audit(db, id, 'corrected', names, actor, at);
        await db.run('INSERT INTO lead_history (id,lead_id,status,note,actor,created_at) VALUES (?,?,?,?,?,?)',
          [randomUUID(), id, s.row.status, 'Persoonsgegevens gecorrigeerd: ' + names.join(', ') + '. Geen nieuwe contacttoestemming of automatische mail.', actor, at]);
        await cancelMail(db, id, 'PRIVACY_CORRECTED');
        await revisionEvent(db, s, revision, at);
        return { leadId: id, revision, corrected: true, fields: names };
      }, true);
    },
    async eraseLead(id, { expectedRevision, actor, confirm } = {}) {
      if (!actorName(actor) || confirm !== 'ERASE_LEAD_PERSONAL_DATA') throw new PrivacyValidation({ confirm: 'Bevestig het wissen van de persoonsgegevens in dit dossier.' });
      return adapter.work(async db => {
        const s = await state(db, id, expectedRevision);
        if (!s) return null;
        if (s.privacy?.erased_at) return { leadId: id, revision: s.revision, erased: true, alreadyErased: true };
        const at = stamp(), revision = s.revision + 1;
        // Keep only technical identity for stop delivery and idempotency: never restore the old payload hash.
        await db.run("UPDATE leads SET name=?,email=NULL,phone=NULL,postcode=NULL,message='',scenario_json=NULL,share_scenario=0,payload_hash='erased',contact_requested=0,status='withdrawn',updated_at=? WHERE id=?", ['[Gegevens verwijderd]', at, id]);
        await db.run("UPDATE lead_intakes SET address_json='{}',contact_preference='any' WHERE lead_id=?", [id]);
        await db.run(`${ignore} INTO lead_followups (lead_id,owner_label,next_action,next_action_on,revision) VALUES (?,?,?,?,?)`, [id, '', '', null, 0]);
        await db.run("UPDATE lead_followups SET owner_label='',next_action='',next_action_on=NULL,revision=? WHERE lead_id=?", [revision, id]);
        await db.run('DELETE FROM lead_history WHERE lead_id=?', [id]);
        await db.run('INSERT INTO lead_history (id,lead_id,status,note,actor,created_at) VALUES (?,?,?,?,?,?)',
          [randomUUID(), id, 'withdrawn', 'Persoonsgegevens en vrije dossiernotities gewist. Alleen beperkte stop- en technische referenties behouden.', 'system', at]);
        await db.run(`${ignore} INTO zonlio_lead_privacy (lead_id,erased_at,last_action_at) VALUES (?,?,?)`, [id, at, at]);
        await db.run('UPDATE zonlio_lead_privacy SET erased_at=?,last_action_at=? WHERE lead_id=?', [at, at, id]);
        await audit(db, id, 'erased', ['contact', 'housing', 'message', 'scenario', 'notes', 'originalPayloadHash'], actor, at);
        await cancelMail(db, id, 'PRIVACY_ERASED');
        await revisionEvent(db, s, revision, at);
        return { leadId: id, revision, erased: true, alreadyErased: false };
      }, true);
    },
    async retentionPreview({ closedDays = 180, unverifiedDays = 7 } = {}) {
      if (!Number.isInteger(closedDays) || closedDays < 1 || closedDays > 3650
        || !Number.isInteger(unverifiedDays) || unverifiedDays < 1 || unverifiedDays > 365) throw new PrivacyValidation();
      return adapter.work(async db => {
        const leadCutoff = new Date(now() - closedDays * DAY).toISOString();
        const predicate = "(l.status IN ('won','lost','closed','withdrawn') OR l.contact_requested=0 OR l.contact_expires_at<=?) AND l.updated_at<=? AND p.erased_at IS NULL";
        const count = await db.get(`SELECT COUNT(*) AS total FROM leads l LEFT JOIN zonlio_lead_privacy p ON p.lead_id=l.id WHERE ${predicate}`, [stamp(), leadCutoff]);
        const candidates = await db.all(`SELECT l.id,l.reference,l.status,l.updated_at FROM leads l LEFT JOIN zonlio_lead_privacy p ON p.lead_id=l.id WHERE ${predicate} ORDER BY l.updated_at,l.id LIMIT 100`, [stamp(), leadCutoff]);
        const challenges = await db.get('SELECT COUNT(*) AS total FROM zonlio_challenges WHERE consumed_at IS NULL AND created_at<=?', [new Date(now() - unverifiedDays * DAY).toISOString()]);
        return { dryRun: true, generatedAt: stamp(), policyApproved: false, policy: { closedDays, unverifiedDays },
          counts: { leadReviewCandidates: Number(count.total), unverifiedChallenges: Number(challenges.total) },
          candidates: candidates.map(row => ({ id: row.id, reference: row.reference, status: row.status, updatedAt: row.updated_at })),
          note: 'Uitsluitend een beoordelingslijst. De voorgestelde termijnen zijn geen wettelijke standaard of goedgekeurd NIVO-bewaarbeleid. Deze actie verwijdert niets.' };
      });
    },
    async verificationSummary() {
      return adapter.work(async db => {
        const erased = await db.get('SELECT COUNT(*) AS total FROM zonlio_lead_privacy WHERE erased_at IS NOT NULL');
        const actions = await db.all('SELECT action,COUNT(*) AS total FROM zonlio_privacy_audit GROUP BY action');
        return { erasedLeads: Number(erased.total), actions: Object.fromEntries(actions.map(row => [row.action, Number(row.total)])), automaticLeadDeletion: false };
      });
    },
    async recoveryManifest() {
      return adapter.work(async db => {
        const leads = await db.all(`SELECT l.id,l.request_id,l.status,l.contact_requested,l.contact_expires_at,l.updated_at,f.revision,p.erased_at
          FROM leads l LEFT JOIN lead_followups f ON f.lead_id=l.id LEFT JOIN zonlio_lead_privacy p ON p.lead_id=l.id
          WHERE l.contact_requested=0 OR l.contact_expires_at<=? OR l.status IN ('won','lost','closed','withdrawn') OR p.erased_at IS NOT NULL`, [stamp()]);
        const subscriptions = await db.all("SELECT m.id,m.email_key,s.status,s.revision,s.updated_at FROM zonlio_members m JOIN zonlio_subscriptions s ON s.member_id=m.id WHERE s.status IN ('paused','unsubscribed')");
        const corrections = await db.all(`SELECT l.id,l.request_id,l.updated_at,f.revision FROM leads l
          JOIN zonlio_lead_privacy p ON p.lead_id=l.id LEFT JOIN lead_followups f ON f.lead_id=l.id WHERE p.erased_at IS NULL`);
        const suppressions = await db.all('SELECT email_key,reason,created_at FROM zonlio_delivery_suppressions');
        const erasures = await db.all('SELECT member_id,email_key,erased_at FROM zonlio_member_erasure');
        return { schema: 'zonlio.privacy.recovery.v1', createdAt: stamp(),
          leadStops: leads.map(row => ({ id: row.id, requestId: row.request_id, status: row.status, revision: Number(row.revision || 0), contactExpiresAt: row.contact_expires_at, updatedAt: row.updated_at, erasedAt: row.erased_at || null })),
          leadCorrections: corrections.map(row => ({ id: row.id, requestId: row.request_id, revision: Number(row.revision || 0), updatedAt: row.updated_at })),
          subscriptionStops: subscriptions.map(row => ({ memberId: row.id, emailKey: row.email_key, status: row.status, revision: Number(row.revision), updatedAt: row.updated_at })),
          deliverySuppressions: suppressions.map(row => ({ emailKey: row.email_key, reason: row.reason, createdAt: row.created_at })),
          memberErasures: erasures.map(row => ({ memberId: row.member_id, emailKey: row.email_key, erasedAt: row.erased_at })),
          note: 'Beveiligd pseudoniem herstelregister. Geen marketinglijst. Bewaar apart van oudere backups; dit bestand bevat geen wachtwoorden, mailtokens of NAW, maar is niet openbaar.' };
      }, true);
    },
  };
  return repo;
}
