import { randomUUID } from 'node:crypto';

export const OPS_CODES = Object.freeze(['price_source', 'weather_source', 'cron_overdue', 'lead_queue', 'member_queue', 'mail_failures', 'mail_budget', 'lead_followup', 'portal_backlog']);
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS zonlio_ops_lock (name VARCHAR(40) PRIMARY KEY, claim_token VARCHAR(36), locked_until VARCHAR(27))`,
  `CREATE TABLE IF NOT EXISTS zonlio_ops_runs (id VARCHAR(36) PRIMARY KEY, instance_id VARCHAR(36) NOT NULL, release_id VARCHAR(80) NOT NULL, started_at VARCHAR(27) NOT NULL, finished_at VARCHAR(27), status VARCHAR(16) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS zonlio_ops_alerts (code VARCHAR(40) PRIMARY KEY, status VARCHAR(16) NOT NULL, first_seen_at VARCHAR(27) NOT NULL, last_seen_at VARCHAR(27) NOT NULL, resolved_at VARCHAR(27), notified_at VARCHAR(27), claim_token VARCHAR(36), locked_until VARCHAR(27))`,
];

/** Operational evidence contains fixed codes/times only: never message content or contact data. */
export async function createOperationsRepository({ adapter, now = Date.now }) {
  const stamp = () => new Date(now()).toISOString();
  const lock = adapter.dialect === 'mysql' ? ' FOR UPDATE' : '';
  const ignore = adapter.dialect === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
  for (const sql of SCHEMA) await adapter.work(db => db.run(sql + (adapter.dialect === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '')));
  for(const name of ['maintenance','alerts'])await adapter.work(db => db.run(`${ignore} INTO zonlio_ops_lock (name) VALUES (?)`, [name]));
  return {
    async beginRun({ instanceId, releaseId }) {
      if (!/^[a-f0-9-]{36}$/.test(instanceId) || !/^[a-zA-Z0-9._-]{1,80}$/.test(releaseId)) throw new TypeError('INVALID_RUN_IDENTITY');
      return adapter.work(async db => {
        const current = await db.get(`SELECT * FROM zonlio_ops_lock WHERE name='maintenance'${lock}`);
        if (current?.locked_until > stamp()) return null;
        const token = randomUUID();
        // A crashed worker is retained as interrupted evidence, never disguised as a successful tick.
        await db.run("UPDATE zonlio_ops_runs SET status='interrupted' WHERE status='running'");
        await db.run("UPDATE zonlio_ops_lock SET claim_token=?,locked_until=? WHERE name='maintenance'", [token, new Date(now() + 240000).toISOString()]);
        await db.run('INSERT INTO zonlio_ops_runs (id,instance_id,release_id,started_at,status) VALUES (?,?,?,?,?)', [token, instanceId, releaseId, stamp(), 'running']);
        return token;
      }, true);
    },
    async finishRun(token, success) {
      return adapter.work(async db => {
        const current = await db.get(`SELECT * FROM zonlio_ops_lock WHERE name='maintenance'${lock}`);
        if (current?.claim_token !== token || current.locked_until <= stamp()) return false;
        await db.run('UPDATE zonlio_ops_runs SET finished_at=?,status=? WHERE id=?', [stamp(), success ? 'success' : 'failed', token]);
        await db.run("UPDATE zonlio_ops_lock SET claim_token=NULL,locked_until=NULL WHERE name='maintenance'");
        return true;
      }, true);
    },
    async summary() {
      return adapter.work(async db => {
        const runs = await db.all('SELECT instance_id,release_id,started_at,finished_at,status FROM zonlio_ops_runs ORDER BY started_at DESC,id DESC LIMIT 12');
        const successful = await db.get("SELECT MAX(finished_at) AS last FROM zonlio_ops_runs WHERE status='success'");
        const count = await db.get("SELECT COUNT(*) AS total,COUNT(DISTINCT instance_id) AS instances FROM zonlio_ops_runs WHERE status='success' AND finished_at>?", [new Date(now()-86400000).toISOString()]);
        const alerts = await db.all('SELECT code,status,first_seen_at,last_seen_at,resolved_at,notified_at FROM zonlio_ops_alerts ORDER BY code');
        return { lastSuccessAt:successful?.last||null, successfulTicks24h:Number(count?.total||0), observedInstances24h:Number(count?.instances||0), runs:runs.map(row=>({releaseId:row.release_id,startedAt:row.started_at,finishedAt:row.finished_at,status:row.status})), alerts:alerts.map(row=>({code:row.code,status:row.status,firstSeenAt:row.first_seen_at,lastSeenAt:row.last_seen_at,resolvedAt:row.resolved_at,notifiedAt:row.notified_at})) };
      });
    },
    async recordChecks(checks) {
      if (!Array.isArray(checks) || checks.some(check=>!OPS_CODES.includes(check.code)||typeof check.problem!=='boolean')) throw new TypeError('INVALID_OPS_CHECK');
      return adapter.work(async db => {
        await db.get(`SELECT name FROM zonlio_ops_lock WHERE name='alerts'${lock}`);
        for (const {code,problem} of checks) {
          const at=stamp();
          await db.run(`${ignore} INTO zonlio_ops_alerts (code,status,first_seen_at,last_seen_at) VALUES (?,?,?,?)`, [code,problem?'open':'resolved',at,at]);
          const current=await db.get(`SELECT * FROM zonlio_ops_alerts WHERE code=?${lock}`,[code]);
          if(problem) {
            await db.run("UPDATE zonlio_ops_alerts SET status='open',first_seen_at=?,last_seen_at=?,resolved_at=NULL WHERE code=?",[current.status==='open'?current.first_seen_at:at,at,code]);
          } else {
            await db.run("UPDATE zonlio_ops_alerts SET status='resolved',last_seen_at=?,resolved_at=?,claim_token=NULL,locked_until=NULL WHERE code=?",[at,current.status==='resolved'&&current.resolved_at?current.resolved_at:at,code]);
          }
        }
      }, true);
    },
    async claimAlertDigest() {
      return adapter.work(async db => {
        await db.get(`SELECT name FROM zonlio_ops_lock WHERE name='alerts'${lock}`);
        const since=new Date(now()-6*3600000).toISOString();
        const rows=await db.all(`SELECT code FROM zonlio_ops_alerts WHERE status='open' AND (notified_at IS NULL OR notified_at<=?) AND (locked_until IS NULL OR locked_until<=?) ORDER BY code${lock}`,[since,stamp()]);
        if(!rows.length)return null;
        const token=randomUUID();
        for(const row of rows)await db.run('UPDATE zonlio_ops_alerts SET claim_token=?,locked_until=? WHERE code=?',[token,new Date(now()+120000).toISOString(),row.code]);
        return {token,codes:rows.map(row=>row.code)};
      },true);
    },
    async finishAlertDigest(token, accepted) {
      await adapter.work(async db=>{
        await db.get(`SELECT name FROM zonlio_ops_lock WHERE name='alerts'${lock}`);
        await db.run(`UPDATE zonlio_ops_alerts SET notified_at=${accepted?'?':'notified_at'},claim_token=NULL,locked_until=? WHERE claim_token=?`,accepted?[stamp(),null,token]:[new Date(now()+15*60000).toISOString(),token]);
      },true);
    },
    async cleanup({analyticsRetentionConfirmed=false}={}) {
      await adapter.work(async db=>{
        await db.run('DELETE FROM zonlio_ops_runs WHERE started_at<?',[new Date(now()-30*86400000).toISOString()]);
        await db.run('DELETE FROM admin_sessions WHERE expires_at<=?',[stamp()]);
        if(analyticsRetentionConfirmed) {
          const cutoff=new Date(now()-90*86400000).toISOString().slice(0,10);
          await db.run('DELETE FROM analytics_events WHERE day<?',[cutoff]);
          await db.run('DELETE FROM analytics_sessions WHERE day<?',[cutoff]);
        }
      },true);
    },
  };
}
