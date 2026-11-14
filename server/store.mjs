import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export class StoreConflict extends Error {
  constructor() { super('Deze aanvraagcode is al voor andere gegevens gebruikt.'); this.code = 'IDEMPOTENCY_CONFLICT'; }
}

const SCHEMA = [
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
  const stamp = () => new Date(now()).toISOString();
  const insertIgnore = adapter.dialect === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
  const store = {
    dialect: adapter.dialect,
    close: () => adapter.close(),

    async createLead(input, payloadHash) {
      const save = async () => adapter.work(async (db) => {
        const existing = await db.get('SELECT * FROM leads WHERE request_id = ?', [input.requestId]);
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
        await db.run('INSERT INTO lead_history (id,lead_id,status,note,actor,created_at) VALUES (?,?,?,?,?,?)',
          [randomUUID(), id, 'new', 'Adviesaanvraag ontvangen.', 'website', createdAt]);
        for (const kind of ['internal_notification', ...(input.email ? ['customer_confirmation'] : [])]) {
          await db.run(`INSERT INTO outbox (id,unique_key,lead_id,kind,status,attempts,next_attempt_at,created_at)
            VALUES (?,?,?,?,?,?,?,?)`, [randomUUID(), `${id}:${kind}:v1`, id, kind, 'pending', 0, createdAt, createdAt]);
        }
        return { lead: toLead(await db.get('SELECT * FROM leads WHERE id = ?', [id])), duplicate: false };
      }, true);
      try { return await save(); }
      catch (error) {
        // MySQL may race on the unique request_id; inspect after rollback in a new transaction.
        if (!duplicateError(error)) throw error;
        return adapter.work(async (db) => {
          const existing = await db.get('SELECT * FROM leads WHERE request_id = ?', [input.requestId]);
          if (!existing) throw error;
          if (existing.payload_hash !== payloadHash) throw new StoreConflict();
          return { lead: toLead(existing), duplicate: true };
        });
      }
    },

    async listLeads({ status, limit = 30, cursor } = {}) {
      return adapter.work(async (db) => {
        const filters = []; const params = [];
        if (status) { filters.push('l.status = ?'); params.push(status); }
        if (cursor) {
          const after = await db.get('SELECT created_at,id FROM leads WHERE id = ?', [cursor]);
          if (after) {
            filters.push('(l.created_at < ? OR (l.created_at = ? AND l.id < ?))');
            params.push(after.created_at, after.created_at, after.id);
          }
        }
        const rows = await db.all(`SELECT l.*,
          (SELECT o.status FROM outbox o WHERE o.lead_id=l.id AND o.kind='internal_notification' LIMIT 1) AS notification_status
          FROM leads l ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
          ORDER BY l.created_at DESC,l.id DESC LIMIT ${Math.min(100, limit) + 1}`, params);
        const hasMore = rows.length > limit;
        const selected = rows.slice(0, limit);
        return { leads: selected.map(toLead), nextCursor: hasMore ? selected.at(-1).id : null };
      });
    },

    async getLead(id) {
      return adapter.work(async (db) => {
        const lead = toLead(await db.get(`SELECT l.*,
          (SELECT o.status FROM outbox o WHERE o.lead_id=l.id AND o.kind='internal_notification' LIMIT 1) AS notification_status
          FROM leads l WHERE l.id=?`, [id]));
        if (!lead) return null;
        const history = await db.all('SELECT * FROM lead_history WHERE lead_id=? ORDER BY created_at,id', [id]);
        return { lead, history: history.map((row) => ({ id: row.id, status: row.status, note: row.note, actor: row.actor, createdAt: row.created_at })) };
      });
    },

    async updateLead(id, { status, note = '', actor }) {
      return adapter.work(async (db) => {
        const existing = await db.get('SELECT id FROM leads WHERE id=?', [id]);
        if (!existing) return null;
        const at = stamp();
        await db.run('UPDATE leads SET status=?,updated_at=? WHERE id=?', [status, at, id]);
        await db.run('INSERT INTO lead_history (id,lead_id,status,note,actor,created_at) VALUES (?,?,?,?,?,?)',
          [randomUUID(), id, status, note, actor, at]);
        return toLead(await db.get('SELECT * FROM leads WHERE id=?', [id]));
      }, true);
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
        return { pending: (counts.pending || 0) + (counts.processing || 0), failed: counts.failed || 0, sent: counts.sent || 0, lastSuccessAt: last?.last_success || null };
      });
    },

    async stats(days = 30) {
      const dates = periodDays(now(), days);
      return adapter.work(async (db) => {
        // Rows are reduced using Amsterdam calendar dates, independent of DB server timezone.
        const since = new Date(Date.parse(`${dates[0]}T00:00:00Z`) - 86400000).toISOString();
        const rows = (await db.all('SELECT created_at,status,topic,source_path FROM leads WHERE created_at>=?', [since]))
          .filter((row) => dates.includes(calendarDay(row.created_at)));
        const views = await db.all('SELECT day,SUM(total) AS total FROM page_views WHERE day>=? GROUP BY day', [dates[0]]);
        const sessions = await db.all('SELECT day,COUNT(*) AS total FROM analytics_sessions WHERE day>=? GROUP BY day', [dates[0]]);
        const sessionCount = await db.get('SELECT COUNT(DISTINCT session_hash) AS total FROM analytics_sessions WHERE day>=?', [dates[0]]);
        const events = await db.all('SELECT event,COUNT(*) AS total FROM analytics_events WHERE day>=? GROUP BY event', [dates[0]]);
        const viewMap = Object.fromEntries(views.map((r) => [r.day, Number(r.total)]));
        const sessionMap = Object.fromEntries(sessions.map((r) => [r.day, Number(r.total)]));
        const eventMap = Object.fromEntries(events.map((r) => [r.event, Number(r.total)]));
        const counts = Object.fromEntries(['new', 'contacted', 'qualified', 'won', 'closed'].map((status) => [status, rows.filter((r) => r.status === status).length]));
        return {
          days, from: dates[0], to: dates.at(-1),
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
          await db.run("UPDATE outbox SET status='processing',attempts=?,locked_until=?,claim_token=? WHERE id=?",
            [row.attempts, until, row.claim_token, row.id]);
        }
        return rows;
      }, true);
    },
    async finishMail(item, { success, errorCode = 'SMTP_ERROR' }) {
      const at = stamp();
      const delays = [60000, 300000, 900000, 3600000, 10800000, 43200000, 86400000];
      const failed = !success && item.attempts >= 8;
      const next = new Date(new Date(at).getTime() + delays[Math.min(item.attempts - 1, delays.length - 1)]).toISOString();
      await adapter.work((db) => db.run(`UPDATE outbox SET status=?,next_attempt_at=?,locked_until=NULL,
        claim_token=NULL,last_error=?,sent_at=? WHERE id=? AND claim_token=?`,
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
