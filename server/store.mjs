import { OPERATOR } from './operator.mjs';
import { createMemberRepository } from './member-store.mjs';
import { createOperationsRepository } from './operations-store.mjs';
import { createPrivacyRepository } from './privacy-store.mjs';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { LEAD_STATUS_LABELS, CLOSED_STATUSES, followUpFieldErrors, housingFieldErrors } from '../src/advice-schema.mjs';

export class StoreConflict extends Error {
  constructor() { super('Deze aanvraagcode is al voor andere gegevens gebruikt.'); this.code = 'IDEMPOTENCY_CONFLICT'; }
}

export class LeadUpdateConflict extends Error {
  constructor(message = 'Dit dossier is ondertussen gewijzigd. Open het opnieuw voordat je opslaat.') { super(message); this.code = 'LEAD_UPDATE_CONFLICT'; }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS portal_events (
    id VARCHAR(36) PRIMARY KEY, unique_key VARCHAR(80) NOT NULL UNIQUE, lead_id VARCHAR(36) NOT NULL,
    revision INTEGER NOT NULL, status VARCHAR(16) NOT NULL, created_at VARCHAR(27) NOT NULL,
    locked_until VARCHAR(27), claim_token VARCHAR(36), portal_reference VARCHAR(120), accepted_at VARCHAR(27)
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR(36) PRIMARY KEY, reference VARCHAR(32) NOT NULL UNIQUE,
    request_id VARCHAR(36) NOT NULL UNIQUE, payload_hash VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL, channel VARCHAR(8) NOT NULL, email VARCHAR(254), phone VARCHAR(32),
    postcode VARCHAR(6), topic VARCHAR(16) NOT NULL, message TEXT NOT NULL,
    scenario_json TEXT, share_scenario INTEGER NOT NULL, source_path VARCHAR(16) NOT NULL,
    consent_version VARCHAR(64) NOT NULL, contact_text TEXT NOT NULL,
    controller_name VARCHAR(200) NOT NULL, controller_email VARCHAR(254) NOT NULL,
    contact_requested INTEGER NOT NULL, contact_expires_at VARCHAR(27) NOT NULL,
    status VARCHAR(16) NOT NULL, created_at VARCHAR(27) NOT NULL, updated_at VARCHAR(27) NOT NULL
  )`,
  // Additive extension tables: existing leads and their evidence are not rewritten.
  `CREATE TABLE IF NOT EXISTS lead_intakes (
    lead_id VARCHAR(36) PRIMARY KEY, kind VARCHAR(16) NOT NULL,
    address_json TEXT NOT NULL, contact_preference VARCHAR(16) NOT NULL,
    created_at VARCHAR(27) NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS lead_followups (
    lead_id VARCHAR(36) PRIMARY KEY, owner_label VARCHAR(120) NOT NULL,
    next_action VARCHAR(500) NOT NULL, next_action_on VARCHAR(10), revision INTEGER NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS lead_history (
    id VARCHAR(36) PRIMARY KEY, lead_id VARCHAR(36) NOT NULL,
    status VARCHAR(16) NOT NULL, note TEXT NOT NULL, actor VARCHAR(254) NOT NULL,
    created_at VARCHAR(27) NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS outbox (
    id VARCHAR(36) PRIMARY KEY, unique_key VARCHAR(100) NOT NULL UNIQUE,
    lead_id VARCHAR(36) NOT NULL, kind VARCHAR(32) NOT NULL, status VARCHAR(16) NOT NULL,
    attempts INTEGER NOT NULL, next_attempt_at VARCHAR(27) NOT NULL,
    locked_until VARCHAR(27), claim_token VARCHAR(36), last_error VARCHAR(80),
    sent_at VARCHAR(27), created_at VARCHAR(27) NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    id_hash VARCHAR(64) PRIMARY KEY, email VARCHAR(254) NOT NULL,
    created_at VARCHAR(27) NOT NULL, expires_at VARCHAR(27) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS page_views (
    day VARCHAR(10) NOT NULL, path VARCHAR(16) NOT NULL, total INTEGER NOT NULL,
    PRIMARY KEY (day, path)
  )`,
  `CREATE TABLE IF NOT EXISTS analytics_sessions (
    day VARCHAR(10) NOT NULL, session_hash VARCHAR(64) NOT NULL,
    PRIMARY KEY (day, session_hash)
  )`,
  `CREATE TABLE IF NOT EXISTS analytics_events (
    day VARCHAR(10) NOT NULL, session_hash VARCHAR(64) NOT NULL,
    event VARCHAR(24) NOT NULL, path VARCHAR(16) NOT NULL,
    PRIMARY KEY (day, session_hash, event, path)
  )`,
];

const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function calendarDay(date) {
  const parts = Object.fromEntries(DATE_FORMAT.formatToParts(new Date(date)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function periodDays(now, days) {
  const today = calendarDay(now);
  const noon = Date.parse(`${today}T12:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(noon - (days - i - 1) * 86400000).toISOString().slice(0, 10));
}
const LEAD_QUERY = `SELECT l.*, i.kind AS intake_kind, i.address_json, i.contact_preference,
  f.owner_label, f.next_action, f.next_action_on, f.revision, p.erased_at,
  (SELECT o.status FROM outbox o WHERE o.lead_id=l.id AND o.kind='internal_notification' LIMIT 1) AS notification_status
  FROM leads l LEFT JOIN lead_intakes i ON i.lead_id=l.id LEFT JOIN lead_followups f ON f.lead_id=l.id LEFT JOIN zonlio_lead_privacy p ON p.lead_id=l.id`;
function toLead(row) {
  if (!row) return null;
  return {
    id: row.id, reference: row.reference, name: row.name, channel: row.channel,
    email: row.email || '', phone: row.phone || '', postcode: row.postcode || '',
    topic: row.topic, message: row.message, scenario: row.scenario_json ? JSON.parse(row.scenario_json) : null,
    shareScenario: Boolean(row.share_scenario), sourcePath: row.source_path,
    consentVersion: row.consent_version, contactText: row.contact_text,
    controller: { name: row.controller_name, email: row.controller_email },
    contactRequested: Boolean(row.contact_requested), contactExpiresAt: row.contact_expires_at,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    notificationStatus: row.notification_status || 'pending',
    kind: row.intake_kind || 'general',
    housing: row.address_json ? JSON.parse(row.address_json) : null,
    contactPreference: row.contact_preference || 'any',
    followUp: { owner: row.owner_label || '', nextAction: row.next_action || '', nextActionOn: row.next_action_on || '' },
    revision: Number(row.revision || 0),
    erasedAt: row.erased_at || null,
  };
}
function duplicateError(error) {
  return error.code === 'ER_DUP_ENTRY' || [1555, 2067].includes(error.errcode)
    || /UNIQUE constraint failed/.test(error.message || '');
}

async function adapterFor(env) {
  const production = env.NODE_ENV === 'production';
  if (production || env.DB_HOST || env.DB_NAME) {
    for (const key of ['DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
      if (!env[key]) throw new Error(`DATABASE_CONFIGURATION_${key}`);
    }
    const { createPool } = await import('mysql2/promise');
    const pool = createPool({
      host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306),
      database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
      connectionLimit: 5, connectTimeout: 5000, waitForConnections: true, queueLimit: 30,
      charset: 'utf8mb4', multipleStatements: false,
    });
    const connection = (conn) => ({
      async all(sql, params = []) { const [rows] = await conn.execute(sql, params); return rows; },
      async get(sql, params = []) { const [rows] = await conn.execute(sql, params); return rows[0] || null; },
      async run(sql, params = []) { const [result] = await conn.execute(sql, params); return { changes: result.affectedRows }; },
    });
    const adapter = {
      dialect: 'mysql',
      async work(fn, transaction = false) {
        const conn = await pool.getConnection();
        try {
          if (transaction) await conn.beginTransaction();
          const result = await fn(connection(conn));
          if (transaction) await conn.commit();
          return result;
        } catch (error) {
          if (transaction) await conn.rollback().catch(() => {});
          throw error;
        } finally { conn.release(); }
      },
      async close() { await pool.end(); },
    };
    try { await adapter.work((db) => db.get('SELECT 1 AS ok')); }
    catch (error) { await pool.end().catch(() => {}); throw error; }
    return adapter;
  }

  const path = env.SQLITE_PATH === ':memory:' ? ':memory:' : resolve(env.SQLITE_PATH || 'data/zonlio.sqlite');
  if (path !== ':memory:') await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  const connection = {
    async all(sql, params = []) { return database.prepare(sql).all(...params); },
    async get(sql, params = []) { return database.prepare(sql).get(...params) || null; },
    async run(sql, params = []) { const result = database.prepare(sql).run(...params); return { changes: Number(result.changes) }; },
  };
  // Serializing all work prevents a second request joining an open SQLite transaction.
  let queue = Promise.resolve();
  return {
    dialect: 'sqlite',
    work(fn, transaction = false) {
      const task = queue.then(async () => {
        if (transaction) database.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(connection);
          if (transaction) database.exec('COMMIT');
          return result;
        } catch (error) {
          if (transaction) database.exec('ROLLBACK');
          throw error;
        }
      });
      queue = task.catch(() => {});
      return task;
    },
    async close() { await queue; database.close(); },
  };
}

export async function createStore({ env = process.env, now = () => Date.now() } = {}) {
  const adapter = await adapterFor(env);
  try {
    for (const statement of SCHEMA) {
      const ddl = adapter.dialect === 'mysql' ? `${statement} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` : statement;
      await adapter.work((db) => db.run(ddl));
    }
  }
  catch (error) { await adapter.close(); throw error; }
  let members, operations, privacy;
  try { members = await createMemberRepository({ adapter, now }); operations=await createOperationsRepository({adapter,now}); privacy=await createPrivacyRepository({adapter,now}); }
  catch (error) { await adapter.close(); throw error; }
  const stamp = () => new Date(now()).toISOString();
  const insertIgnore = adapter.dialect === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
  const store = {
    dialect: adapter.dialect, members, operations, privacy,
    async probe() { return Boolean(await adapter.work(db=>db.get('SELECT 1 AS ok'))); },
    close: () => adapter.close(),

    async createLead(input, payloadHash) {
      if (input.intake && (input.intake.kind !== 'housing' || Object.keys(housingFieldErrors({
        housing: input.intake.address, postcode: input.postcode, contactPreference: input.intake.contactPreference,
        topic: input.topic,
      })).length || input.channel !== 'phone' || !input.phone)) throw new TypeError('Ongeldige woningintake.');
      const save = async () => adapter.work(async (db) => {
        const existing = await db.get(`${LEAD_QUERY} WHERE l.request_id = ?`, [input.requestId]);
        if (existing) {
          if (existing.payload_hash !== payloadHash) throw new StoreConflict();
          return { lead: toLead(existing), duplicate: true };
        }
        const id = randomUUID();
        const reference = `ZON-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
        const createdAt = stamp();
        const expiresAt = new Date(new Date(createdAt).getTime() + 30 * 86400000).toISOString();
        await db.run(`INSERT INTO leads (
          id,reference,request_id,payload_hash,name,channel,email,phone,postcode,topic,message,
          scenario_json,share_scenario,source_path,consent_version,contact_text,controller_name,
          controller_email,contact_requested,contact_expires_at,status,created_at,updated_at
        ) VALUES (${Array(23).fill('?').join(',')})`, [
          id, reference, input.requestId, payloadHash, input.name, input.channel, input.email || null,
          input.phone || null, input.postcode || null, input.topic, input.message || '',
          input.shareScenario && input.scenario ? JSON.stringify(input.scenario) : null,
          input.shareScenario ? 1 : 0, input.sourcePath, input.consentVersion, input.contactText,
          input.controller.name, input.controller.email, 1, expiresAt, 'new', createdAt, createdAt,
        ]);
        if (input.intake) await db.run('INSERT INTO lead_intakes (lead_id,kind,address_json,contact_preference,created_at) VALUES (?,?,?,?,?)',
          [id, input.intake.kind, JSON.stringify(input.intake.address), input.intake.contactPreference, createdAt]);
        // NIVO receives an actionable review, never a fictitious contact milestone.
        const nivoRequest = input.controller.name === OPERATOR.name;
        await db.run('INSERT INTO lead_followups (lead_id,owner_label,next_action,next_action_on,revision) VALUES (?,?,?,?,?)',
          [id,nivoRequest?'Pim':'',nivoRequest?'Nieuwe aanvraag beoordelen en contactvoorkeur controleren':'',
            nivoRequest?calendarDay(createdAt):null,0]);
        await db.run('INSERT INTO lead_history (id,lead_id,status,note,actor,created_at) VALUES (?,?,?,?,?,?)',
          [randomUUID(), id, 'new', 'Adviesaanvraag ontvangen.', 'website', createdAt]);
        for (const kind of ['internal_notification', ...(input.email ? ['customer_confirmation'] : [])]) {
          await db.run(`INSERT INTO outbox (id,unique_key,lead_id,kind,status,attempts,next_attempt_at,created_at)
            VALUES (?,?,?,?,?,?,?,?)`, [randomUUID(), `${id}:${kind}:v1`, id, kind, 'pending', 0, createdAt, createdAt]);
        }
        if (input.intake && input.controller.name === OPERATOR.name) await db.run('INSERT INTO portal_events (id,unique_key,lead_id,revision,status,created_at) VALUES (?,?,?,?,?,?)',
          [randomUUID(),`${id}:0`,id,0,'pending',createdAt]);
        return { lead: toLead(await db.get(`${LEAD_QUERY} WHERE l.id = ?`, [id])), duplicate: false };
      }, true);
      try { return await save(); }
      catch (error) {
        // MySQL may race on the unique request_id; inspect after rollback in a new transaction.
        if (!duplicateError(error)) throw error;
        return adapter.work(async (db) => {
          const existing = await db.get(`${LEAD_QUERY} WHERE l.request_id = ?`, [input.requestId]);
          if (!existing) throw error;
          if (existing.payload_hash !== payloadHash) throw new StoreConflict();
          return { lead: toLead(existing), duplicate: true };
        });
      }
    },

    async listLeads({ status, limit = 30, cursor, queue } = {}) {
      return adapter.work(async (db) => {
        const filters = []; const params = [];
        if (status) { filters.push('l.status = ?'); params.push(status); }
        if (queue === 'attention') {
          // Include existing unplanned records without altering consent or history.
          // Only active contact rights are displayed as follow-up work.
          filters.push(`l.contact_requested=1 AND l.contact_expires_at>? AND
            l.status NOT IN ('won','lost','closed','withdrawn') AND
            (l.status='new' OR f.owner_label IS NULL OR f.owner_label='' OR
             f.next_action_on IS NULL OR f.next_action_on<=?)`);
          params.push(stamp(),calendarDay(now()));
        }
        if (cursor) {
          const after = await db.get('SELECT created_at,id FROM leads WHERE id = ?', [cursor]);
          if (after) {
            filters.push('(l.created_at < ? OR (l.created_at = ? AND l.id < ?))');
            params.push(after.created_at, after.created_at, after.id);
          }
        }
        const rows = await db.all(`${LEAD_QUERY} ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
          ORDER BY l.created_at DESC,l.id DESC LIMIT ${Math.min(100, limit) + 1}`, params);
        const hasMore = rows.length > limit;
        const selected = rows.slice(0, limit);
        return { leads: selected.map(toLead), nextCursor: hasMore ? selected.at(-1).id : null };
      });
    },

    async getLead(id) {
      return adapter.work(async (db) => {
        const lead = toLead(await db.get(`${LEAD_QUERY} WHERE l.id=?`, [id]));
        if (!lead) return null;
        const history = await db.all('SELECT * FROM lead_history WHERE lead_id=? ORDER BY created_at,id', [id]);
        return { lead, history: history.map((row) => ({ id: row.id, status: row.status, note: row.note, actor: row.actor, createdAt: row.created_at })) };
      });
    },

    async updateLead(id, { status, note = '', actor, followUp, expectedRevision }) {
      if (!Object.hasOwn(LEAD_STATUS_LABELS, status)) throw new TypeError('Ongeldige opvolgstatus.');
      if (followUp !== undefined && Object.keys(followUpFieldErrors(followUp)).length) throw new TypeError('Ongeldige opvolggegevens.');
      return adapter.work(async (db) => {
        // Lock the parent row: protects the first extension insert for legacy leads as well.
        const parent = await db.get(`SELECT id,status,contact_requested,contact_expires_at FROM leads WHERE id=?${adapter.dialect === 'mysql' ? ' FOR UPDATE' : ''}`, [id]);
        if (!parent) return null;
        if(await db.get('SELECT lead_id FROM zonlio_lead_privacy WHERE lead_id=? AND erased_at IS NOT NULL',[id]))throw new LeadUpdateConflict('Dit dossier is gewist en kan niet worden heropend of aangevuld.');
        const existing = toLead(await db.get(`${LEAD_QUERY} WHERE l.id=?`, [id]));
        if (expectedRevision !== undefined && expectedRevision !== existing.revision) throw new LeadUpdateConflict();
        if (existing.status === 'withdrawn' && status !== 'withdrawn') throw new LeadUpdateConflict('Een ingetrokken contactverzoek kan niet via een statuswijziging worden heropend.');
        const at = stamp();
        const next = followUp ? { owner: followUp.owner.trim(), nextAction: followUp.nextAction.trim(), nextActionOn: followUp.nextActionOn } : { ...existing.followUp };
        if (status === 'assigned' && !next.owner) throw new LeadUpdateConflict('Vul een verantwoordelijke in voordat je dit dossier toewijst.');
        if (CLOSED_STATUSES.includes(status)) { next.nextAction = ''; next.nextActionOn = ''; }
        if (next.nextActionOn && (!existing.contactRequested || existing.contactExpiresAt <= at || next.nextActionOn >= calendarDay(existing.contactExpiresAt))) {
          throw new LeadUpdateConflict('Plan geen contactactie buiten de geldigheid van dit contactverzoek.');
        }
        await db.run(`${insertIgnore} INTO lead_followups (lead_id,owner_label,next_action,next_action_on,revision) VALUES (?,?,?,?,?)`, [id, '', '', null, 0]);
        await db.run('UPDATE lead_followups SET owner_label=?,next_action=?,next_action_on=?,revision=? WHERE lead_id=?',
          [next.owner, next.nextAction, next.nextActionOn || null, existing.revision + 1, id]);
        await db.run('UPDATE leads SET status=?,contact_requested=?,updated_at=? WHERE id=?',
          [status, status === 'withdrawn' ? 0 : existing.contactRequested ? 1 : 0, at, id]);
        await db.run('INSERT INTO lead_history (id,lead_id,status,note,actor,created_at) VALUES (?,?,?,?,?,?)',
          [randomUUID(), id, status, [note, followUp ? `Opvolging: ${next.owner || 'niet toegewezen'}; ${next.nextAction || 'geen actie'}${next.nextActionOn ? ' — ' + next.nextActionOn : ''}` : ''].filter(Boolean).join('\n'), actor, at]);
        if (status === 'withdrawn') await db.run("UPDATE outbox SET status='cancelled',locked_until=NULL,claim_token=NULL,last_error='CONTACT_WITHDRAWN' WHERE lead_id=? AND status IN ('pending','processing','failed')", [id]);
        if (existing.kind === 'housing' && existing.controller.name === OPERATOR.name) await db.run('INSERT INTO portal_events (id,unique_key,lead_id,revision,status,created_at) VALUES (?,?,?,?,?,?)',
          [randomUUID(),`${id}:${existing.revision+1}`,id,existing.revision+1,'pending',at]);
        return toLead(await db.get(`${LEAD_QUERY} WHERE l.id=?`, [id]));
      }, true);
    },

    async claimPortalEvents(limit=5) {
      return adapter.work(async db=>{
        const at=stamp();
        const rows=await db.all(`SELECT * FROM portal_events WHERE status='pending' OR (status='leased' AND locked_until<=?) ORDER BY created_at,id LIMIT ${Math.min(10,Math.max(1,limit))}${adapter.dialect==='mysql'?' FOR UPDATE':''}`,[at]);
        for(const row of rows) {row.claim_token=randomUUID();row.locked_until=new Date(now()+120000).toISOString();await db.run("UPDATE portal_events SET status='leased',claim_token=?,locked_until=? WHERE id=?",[row.claim_token,row.locked_until,row.id]);}
        return rows;
      },true);
    },
    async ackPortalEvent({id,claimToken,portalReference}) {
      return adapter.work(async db=>{
        const row=await db.get(`SELECT * FROM portal_events WHERE id=?${adapter.dialect==='mysql'?' FOR UPDATE':''}`,[id]);
        if(!row||row.claim_token!==claimToken)return false;
        if(row.status==='accepted')return row.portal_reference===portalReference;
        if(row.status!=='leased'||row.locked_until<=stamp())return false;
        await db.run("UPDATE portal_events SET status='accepted',portal_reference=?,accepted_at=?,locked_until=NULL WHERE id=?",[portalReference,stamp(),id]);return true;
      },true);
    },
    async portalStats() {
      return adapter.work(async db=>{
        const counts=Object.fromEntries((await db.all('SELECT status,COUNT(*) AS total FROM portal_events GROUP BY status')).map(r=>[r.status,Number(r.total)]));
        const pending=await db.get("SELECT MIN(created_at) AS oldest FROM portal_events WHERE status IN ('pending','leased')");
        const expired=await db.get("SELECT COUNT(*) AS total FROM portal_events WHERE status='leased' AND locked_until<=?",[stamp()]);
        const last=await db.get("SELECT MAX(accepted_at) AS last FROM portal_events WHERE status='accepted'");
        return {...counts,oldestPendingAt:pending?.oldest||null,pendingAgeSeconds:pending?.oldest?Math.max(0,Math.floor((now()-Date.parse(pending.oldest))/1000)):0,expiredLeases:Number(expired?.total||0),lastAcceptedAt:last?.last||null};
      });
    },

    async expireContactRequests({limit=100}={}) {
      return adapter.work(async db=>{
        const at=stamp();
        const rows=await db.all(`SELECT id FROM leads WHERE contact_requested=1 AND contact_expires_at<=? ORDER BY contact_expires_at,id LIMIT ${Math.max(1,Math.min(100,Number.isInteger(limit)?limit:100))}${adapter.dialect==='mysql'?' FOR UPDATE':''}`,[at]);
        for(const row of rows) {
          const lead=toLead(await db.get(`${LEAD_QUERY} WHERE l.id=?`,[row.id]));
          const revision=lead.revision+1;
          await db.run(`${insertIgnore} INTO lead_followups (lead_id,owner_label,next_action,next_action_on,revision) VALUES (?,?,?,?,?)`,[lead.id,'','',null,0]);
          await db.run('UPDATE lead_followups SET next_action=?,next_action_on=NULL,revision=? WHERE lead_id=?',['',revision,lead.id]);
          await db.run('UPDATE leads SET contact_requested=0,updated_at=? WHERE id=?',[at,lead.id]);
          await db.run("UPDATE outbox SET status='cancelled',locked_until=NULL,claim_token=NULL,last_error='CONTACT_EXPIRED' WHERE lead_id=? AND status IN ('pending','processing','failed')",[lead.id]);
          await db.run('INSERT INTO lead_history (id,lead_id,status,note,actor,created_at) VALUES (?,?,?,?,?,?)',[randomUUID(),lead.id,lead.status,'Contacttermijn verstreken; verdere contactacties en wachtende e-mails gestopt.','system',at]);
          if(lead.kind==='housing'&&lead.controller.name===OPERATOR.name)await db.run('INSERT INTO portal_events (id,unique_key,lead_id,revision,status,created_at) VALUES (?,?,?,?,?,?)',[randomUUID(),`${lead.id}:${revision}`,lead.id,revision,'pending',at]);
        }
        return {expired:rows.length};
      },true);
    },
    async createSession(idHash, email, expiresAt) {
      await adapter.work((db) => db.run('INSERT INTO admin_sessions (id_hash,email,created_at,expires_at) VALUES (?,?,?,?)',
        [idHash, email, stamp(), expiresAt]));
    },
    async getSession(idHash) {
      return adapter.work((db) => db.get('SELECT * FROM admin_sessions WHERE id_hash=? AND expires_at>?', [idHash, stamp()]));
    },
    async revokeSession(idHash) { await adapter.work((db) => db.run('DELETE FROM admin_sessions WHERE id_hash=?', [idHash])); },

    async recordPageView(path = 'overzicht') {
      const day = calendarDay(now());
      const suffix = adapter.dialect === 'mysql'
        ? 'ON DUPLICATE KEY UPDATE total=total+1' : 'ON CONFLICT(day,path) DO UPDATE SET total=total+1';
      await adapter.work((db) => db.run(`INSERT INTO page_views (day,path,total) VALUES (?,?,1) ${suffix}`, [day, path]));
    },
    async recordEvent({ event, sessionHash, path }) {
      const day = calendarDay(now());
      await adapter.work(async (db) => {
        await db.run(`${insertIgnore} INTO analytics_sessions (day,session_hash) VALUES (?,?)`, [day, sessionHash]);
        await db.run(`${insertIgnore} INTO analytics_events (day,session_hash,event,path) VALUES (?,?,?,?)`, [day, sessionHash, event, path]);
      }, true);
    },

    async mailStats() {
      return adapter.work(async (db) => {
        const rows = await db.all('SELECT status,COUNT(*) AS total FROM outbox GROUP BY status');
        const counts = Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
        const last = await db.get("SELECT MAX(sent_at) AS last_success FROM outbox WHERE status='sent'");
        const oldest=await db.get("SELECT MIN(created_at) AS oldest FROM outbox WHERE status IN ('pending','processing')");
        return { pending: (counts.pending || 0) + (counts.processing || 0), failed: counts.failed || 0, sent: counts.sent || 0, cancelled: counts.cancelled || 0, lastSuccessAt: last?.last_success || null, oldestPendingAt:oldest?.oldest||null };
      });
    },

    async stats(days = 30) {
      const dates = periodDays(now(), days);
      return adapter.work(async (db) => {
        // Rows are reduced using Amsterdam calendar dates, independent of DB server timezone.
        const since = new Date(Date.parse(`${dates[0]}T00:00:00Z`) - 86400000).toISOString();
        const rows = (await db.all('SELECT id,created_at,status,topic,source_path FROM leads WHERE created_at>=?', [since]))
          .filter((row) => dates.includes(calendarDay(row.created_at)));
        const history=await db.all('SELECT h.lead_id,h.status FROM lead_history h JOIN leads l ON l.id=h.lead_id WHERE l.created_at>=?',[since]);
        const reached=new Map(rows.map(row=>[row.id,new Set([row.status])]));
        for(const row of history)reached.get(row.lead_id)?.add(row.status);
        const views = await db.all('SELECT day,SUM(total) AS total FROM page_views WHERE day>=? GROUP BY day', [dates[0]]);
        const sessions = await db.all('SELECT day,COUNT(*) AS total FROM analytics_sessions WHERE day>=? GROUP BY day', [dates[0]]);
        const sessionCount = await db.get('SELECT COUNT(DISTINCT session_hash) AS total FROM analytics_sessions WHERE day>=?', [dates[0]]);
        const events = await db.all('SELECT event,COUNT(*) AS total FROM analytics_events WHERE day>=? GROUP BY event', [dates[0]]);
        const viewMap = Object.fromEntries(views.map((r) => [r.day, Number(r.total)]));
        const sessionMap = Object.fromEntries(sessions.map((r) => [r.day, Number(r.total)]));
        const eventMap = Object.fromEntries(events.map((r) => [r.event, Number(r.total)]));
        const counts = Object.fromEntries(Object.keys(LEAD_STATUS_LABELS).map((status) => [status, rows.filter((r) => r.status === status).length]));
        const at = stamp();
        const allOpen = await db.all(`SELECT l.status,l.created_at,l.contact_requested,l.contact_expires_at,f.owner_label,f.next_action_on
          FROM leads l LEFT JOIN lead_followups f ON f.lead_id=l.id
          WHERE l.status NOT IN ('won','lost','closed','withdrawn')`);
        const actionable = allOpen.filter(r => r.contact_requested && r.contact_expires_at > at);
        const today=calendarDay(now());
        const needsAttention = r => r.status==='new' || !r.owner_label || !r.next_action_on || r.next_action_on<=today;
        const workload = { open: allOpen.length, actionable: actionable.length,
          attention: actionable.filter(needsAttention).length,
          unassigned: actionable.filter(r => !r.owner_label).length,
          unhandled: actionable.filter(r => r.status==='new' && Date.parse(r.created_at)<now()-24*3600000).length,
          due: actionable.filter(r => r.next_action_on && r.next_action_on <= today).length,
          expired: allOpen.filter(r => r.contact_expires_at <= at).length,
          scope: 'Alle open dossiers, los van de gekozen instroomperiode. Acties uitsluitend binnen geldige contactverzoeken.' };
        const sources = ['overzicht','planner','2027','batterij'].map(sourcePath => {
          const cohort=rows.filter(r=>r.source_path===sourcePath);
          return {sourcePath,leads:cohort.length,milestones:Object.fromEntries(['attempted','contacted','qualified','appointment','quoted','won','lost'].map(status=>[status,cohort.filter(row=>reached.get(row.id)?.has(status)).length]))};
        });
        return {
          days, from: dates[0], to: dates.at(-1), workload, acquisition: sources,
          totals: { leads: rows.length, ...counts, pageViews: views.reduce((n, r) => n + Number(r.total), 0),
            consentedSessions: Number(sessionCount?.total || 0), calculatorCompleted: eventMap.calculator_complete || 0, adviceOpened: eventMap.advice_open || 0 },
          daily: dates.map((date) => ({ date, leads: rows.filter((r) => calendarDay(r.created_at) === date).length, pageViews: viewMap[date] || 0, sessions: sessionMap[date] || 0 })),
          definitions: { pageViews: 'Ruwe serverpaginaweergaven; geen unieke personen en mogelijk bots.', consentedSessions: 'Unieke browser-tab-ID’s met statistiekentoestemming in deze periode.', events: 'Per browser-tab-ID, dag, gebeurtenistype en module ontdubbeld.' },
        };
      });
    },

    async claimOutbox(limit = 3) {
      const at = stamp();
      const until = new Date(new Date(at).getTime() + 90000).toISOString();
      return adapter.work(async (db) => {
        const rows = await db.all(`SELECT * FROM outbox WHERE
          (status='pending' AND next_attempt_at<=?) OR (status='processing' AND locked_until<=?)
          ORDER BY created_at,id LIMIT ${Math.min(5, Math.max(1, limit))}${adapter.dialect === 'mysql' ? ' FOR UPDATE' : ''}`, [at, at]);
        for (const row of rows) {
          row.claim_token = randomUUID();
          row.attempts = Number(row.attempts) + 1;
          row.locked_until = until;
          await db.run("UPDATE outbox SET status='processing',attempts=?,locked_until=?,claim_token=? WHERE id=?",
            [row.attempts, until, row.claim_token, row.id]);
        }
        return rows;
      }, true);
    },
    async mailClaimActive(item) {
      return adapter.work(db=>db.get("SELECT id FROM outbox WHERE id=? AND claim_token=? AND status='processing' AND locked_until>?",[item.id,item.claim_token,stamp()])).then(Boolean);
    },
    async deferMail(item) {
      await adapter.work(db=>db.run("UPDATE outbox SET status='pending',attempts=attempts-1,next_attempt_at=?,claim_token=NULL,locked_until=NULL,last_error='SEND_BUDGET' WHERE id=? AND claim_token=? AND status='processing'",[new Date(now()+15*60000).toISOString(),item.id,item.claim_token]));
    },
    async cancelMail(item, reason = 'CONTACT_NOT_ACTIVE') {
      await adapter.work(db => db.run("UPDATE outbox SET status='cancelled',locked_until=NULL,claim_token=NULL,last_error=? WHERE id=? AND claim_token=?",
        [reason, item.id, item.claim_token]));
    },
    async finishMail(item, { success, errorCode = 'SMTP_ERROR' }) {
      const at = stamp();
      const delays = [60000, 300000, 900000, 3600000, 10800000, 43200000, 86400000];
      const failed = !success && item.attempts >= 8;
      const next = new Date(new Date(at).getTime() + delays[Math.min(item.attempts - 1, delays.length - 1)]).toISOString();
      await adapter.work((db) => db.run(`UPDATE outbox SET status=?,next_attempt_at=?,locked_until=NULL,
        claim_token=NULL,last_error=?,sent_at=? WHERE id=? AND claim_token=? AND status='processing'`,
      [success ? 'sent' : failed ? 'failed' : 'pending', next, success ? null : errorCode, success ? at : null, item.id, item.claim_token]));
    },
    async retryFailedMail(limit = 5) {
      return adapter.work(async (db) => {
        const rows = await db.all(`SELECT id FROM outbox WHERE status='failed' ORDER BY created_at LIMIT ${Math.min(5, Math.max(1, limit))}`);
        for (const row of rows) await db.run("UPDATE outbox SET status='pending',attempts=0,next_attempt_at=? WHERE id=?", [stamp(), row.id]);
        return rows.length;
      }, true);
    },
  };
  return store;
}
