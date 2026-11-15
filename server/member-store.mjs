import { randomUUID, createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const SCHEMA = [
 `CREATE TABLE IF NOT EXISTS zonlio_members (id VARCHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL, email_key VARCHAR(64) NOT NULL UNIQUE, profile_json TEXT NOT NULL, revision INTEGER NOT NULL, delivery_blocked INTEGER NOT NULL, created_at VARCHAR(27) NOT NULL, verified_at VARCHAR(27) NOT NULL, updated_at VARCHAR(27) NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS zonlio_member_sessions (id_hash VARCHAR(64) PRIMARY KEY, member_id VARCHAR(36) NOT NULL, expires_at VARCHAR(27) NOT NULL, FOREIGN KEY (member_id) REFERENCES zonlio_members(id))`,
 `CREATE TABLE IF NOT EXISTS zonlio_challenges (id VARCHAR(36) PRIMARY KEY, purpose VARCHAR(16) NOT NULL, email VARCHAR(254) NOT NULL, email_key VARCHAR(64) NOT NULL, token_hash VARCHAR(64) NOT NULL UNIQUE, payload_json TEXT NOT NULL, created_at VARCHAR(27) NOT NULL, expires_at VARCHAR(27) NOT NULL, consumed_at VARCHAR(27))`,
 `CREATE TABLE IF NOT EXISTS zonlio_subscriptions (member_id VARCHAR(36) PRIMARY KEY, edition VARCHAR(16) NOT NULL, status VARCHAR(16) NOT NULL, revision INTEGER NOT NULL, consent_version VARCHAR(64) NOT NULL, consent_text TEXT NOT NULL, created_at VARCHAR(27) NOT NULL, updated_at VARCHAR(27) NOT NULL, FOREIGN KEY (member_id) REFERENCES zonlio_members(id))`,
 `CREATE TABLE IF NOT EXISTS zonlio_consent_history (id VARCHAR(36) PRIMARY KEY, member_id VARCHAR(36) NOT NULL, purpose VARCHAR(24) NOT NULL, state VARCHAR(16) NOT NULL, version VARCHAR(64) NOT NULL, text_value TEXT NOT NULL, created_at VARCHAR(27) NOT NULL, FOREIGN KEY (member_id) REFERENCES zonlio_members(id))`,
 `CREATE TABLE IF NOT EXISTS zonlio_member_mail (id VARCHAR(36) PRIMARY KEY, unique_key VARCHAR(120) NOT NULL UNIQUE, member_id VARCHAR(36), challenge_id VARCHAR(36), kind VARCHAR(16) NOT NULL, payload_json TEXT NOT NULL, status VARCHAR(16) NOT NULL, attempts INTEGER NOT NULL, next_attempt_at VARCHAR(27) NOT NULL, expires_at VARCHAR(27) NOT NULL, locked_until VARCHAR(27), claim_token VARCHAR(36), last_error VARCHAR(40), created_at VARCHAR(27) NOT NULL, sent_at VARCHAR(27))`,
 `CREATE TABLE IF NOT EXISTS zonlio_service_state (name VARCHAR(40) PRIMARY KEY, value_text TEXT NOT NULL, locked_until VARCHAR(27), claim_token VARCHAR(36))`,
 `CREATE TABLE IF NOT EXISTS zonlio_send_budget (id VARCHAR(36) PRIMARY KEY, kind VARCHAR(24) NOT NULL, reserved_at VARCHAR(27) NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS zonlio_price_snapshots (day VARCHAR(10) PRIMARY KEY, payload_json TEXT NOT NULL, fetched_at VARCHAR(27) NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS zonlio_delivery_suppressions (email_key VARCHAR(64) PRIMARY KEY, reason VARCHAR(24) NOT NULL, created_at VARCHAR(27) NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS zonlio_member_erasure (member_id VARCHAR(36) PRIMARY KEY, email_key VARCHAR(64) NOT NULL, erased_at VARCHAR(27) NOT NULL)`,
];
export class MemberConflict extends Error { constructor(message='Deze gegevens zijn gewijzigd. Vernieuw en probeer opnieuw.') { super(message); this.code='MEMBER_CONFLICT'; } }
function member(row) { return row ? {id:row.id,email:row.email,profile:JSON.parse(row.profile_json),revision:Number(row.revision),deliveryBlocked:Boolean(row.delivery_blocked),createdAt:row.created_at} : null; }
function subscription(row) { return row ? {edition:row.edition,status:row.status,revision:Number(row.revision),consentVersion:row.consent_version,consentText:row.consent_text,confirmedAt:row.created_at,updatedAt:row.updated_at} : null; }
export async function createMemberRepository({ adapter, now }) {
  const mysql = adapter.dialect === 'mysql', lock = mysql?' FOR UPDATE':'';
  const ignore = mysql?'INSERT IGNORE':'INSERT OR IGNORE';
  const stamp = () => new Date(now()).toISOString();
  for (const sql of SCHEMA) await adapter.work(db=>db.run(sql+(mysql?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':'')));
  for (const name of ['mail-budget','scheduler','maintenance']) await adapter.work(db=>db.run(`${ignore} INTO zonlio_service_state (name,value_text) VALUES (?,?)`,[name,'']));
  async function evidence(db,id,purpose,state,version,text) {
    await db.run('INSERT INTO zonlio_consent_history (id,member_id,purpose,state,version,text_value,created_at) VALUES (?,?,?,?,?,?,?)',[randomUUID(),id,purpose,state,version,text,stamp()]);
  }
  const emailKey = email => hash(String(email).trim().toLowerCase());
  async function suppress(db,key,reason) {
    if (!['hard_bounce','complaint','owner_request'].includes(reason)) throw new TypeError('Ongeldige reden voor de verzendstop.');
    await db.get(`SELECT name FROM zonlio_service_state WHERE name='mail-budget'${lock}`);
    const at=stamp();
    await db.run(`${ignore} INTO zonlio_delivery_suppressions (email_key,reason,created_at) VALUES (?,?,?)`,[key,reason,at]);
    await db.run('UPDATE zonlio_members SET delivery_blocked=1,updated_at=? WHERE email_key=?',[at,key]);
    await db.run("UPDATE zonlio_member_mail SET status='cancelled',claim_token=NULL,locked_until=NULL,last_error='DELIVERY_BLOCKED' WHERE status IN ('pending','processing','failed') AND (member_id IN (SELECT id FROM zonlio_members WHERE email_key=?) OR challenge_id IN (SELECT id FROM zonlio_challenges WHERE email_key=?))",[key,key]);
    await db.run('UPDATE zonlio_challenges SET consumed_at=? WHERE email_key=? AND consumed_at IS NULL',[at,key]);
  }
  const repo = {
    async queueChallenge({purpose,email,payload,tokenFor}) {
      return adapter.work(async db=>{
        // Persistent per-address bounds also apply across processes. No email enumeration in responses.
        await db.get(`SELECT name FROM zonlio_service_state WHERE name='mail-budget'${lock}`);
        const key = emailKey(email), at=stamp();
        if (await db.get('SELECT email_key FROM zonlio_delivery_suppressions WHERE email_key=?',[key])) return false;
        const attempts = await db.get('SELECT COUNT(*) AS total,MAX(created_at) AS latest FROM zonlio_challenges WHERE email_key=? AND created_at>?',[key,new Date(now()-86400000).toISOString()]);
        if (Number(attempts.total)>=5 || (attempts.latest && Date.parse(attempts.latest)>now()-120000)) return false;
        const id=randomUUID(), token=tokenFor(id,purpose), expires=new Date(now()+(purpose==='login'?15*60000:86400000)).toISOString();
        await db.run('INSERT INTO zonlio_challenges (id,purpose,email,email_key,token_hash,payload_json,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)',[id,purpose,email,key,hash(token),JSON.stringify(payload),at,expires]);
        await db.run('INSERT INTO zonlio_member_mail (id,unique_key,challenge_id,kind,payload_json,status,attempts,next_attempt_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[randomUUID(),`challenge:${id}`,id,purpose,'{}','pending',0,at,expires,at]);
        return true;
      },true);
    },
    // Verify a narrowly marked owner-login challenge without ever enabling public accounts.
    async isOwnerAcceptanceChallenge(tokenHash, adminEmail) {
      if (!adminEmail) return false;
      return adapter.work(async db => {
        const row=await db.get(
          'SELECT purpose,email_key,payload_json,expires_at,consumed_at FROM zonlio_challenges WHERE token_hash=?',
          [tokenHash]);
        return Boolean(row && row.purpose==='login' && !row.consumed_at
          && row.expires_at>stamp() && row.email_key===emailKey(adminEmail)
          && row.payload_json==='{"ownerAcceptance":true}');
      });
    },
    async consumeChallenge({tokenHash,sessionHash,sessionExpires,emptyProfile,accountVersion,daymailVersion,daymailText}) {
      return adapter.work(async db=>{
        // Serialize identity creation without relying on MySQL gap locks for a previously absent address.
        await db.get(`SELECT name FROM zonlio_service_state WHERE name='mail-budget'${lock}`);
        const c=await db.get(`SELECT * FROM zonlio_challenges WHERE token_hash=?${lock}`,[tokenHash]);
        if (!c || c.consumed_at || c.expires_at<=stamp() || await db.get('SELECT email_key FROM zonlio_delivery_suppressions WHERE email_key=?',[c.email_key])) return null;
        const payload=JSON.parse(c.payload_json); const at=stamp();
        let row=await db.get(`SELECT * FROM zonlio_members WHERE email_key=?${lock}`,[c.email_key]);
        if (!row) {
          const id=randomUUID();
          await db.run('INSERT INTO zonlio_members (id,email,email_key,profile_json,revision,delivery_blocked,created_at,verified_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',[id,c.email,c.email_key,JSON.stringify(c.purpose==='subscribe'?payload.profile:emptyProfile),0,0,at,at,at]);
          row=await db.get('SELECT * FROM zonlio_members WHERE id=?',[id]);
        }
        await db.run('UPDATE zonlio_challenges SET consumed_at=? WHERE id=?',[at,c.id]);
        if (c.purpose==='subscribe') {
          const existing=await db.get('SELECT * FROM zonlio_subscriptions WHERE member_id=?',[row.id]);
          // An untrusted signup request never overwrites an existing active subscriber's preferences.
          if (!existing || existing.status!=='active') {
            // The mailbox owner has now confirmed these planner choices. Keep any
            // saved contract/scenario, which the public signup form does not edit.
            const currentProfile=JSON.parse(row.profile_json);
            const nextProfile={...currentProfile,devices:payload.profile.devices,startHour:payload.profile.startHour,endHour:payload.profile.endHour};
            if (JSON.stringify(currentProfile)!==JSON.stringify(nextProfile)) {
              await db.run('UPDATE zonlio_members SET profile_json=?,revision=revision+1,updated_at=? WHERE id=?',[JSON.stringify(nextProfile),at,row.id]);
              row=await db.get('SELECT * FROM zonlio_members WHERE id=?',[row.id]);
            }
            if (!existing) await db.run('INSERT INTO zonlio_subscriptions (member_id,edition,status,revision,consent_version,consent_text,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[row.id,payload.edition,'active',0,daymailVersion,daymailText,at,at]);
            else await db.run("UPDATE zonlio_subscriptions SET edition=?,status='active',revision=revision+1,consent_version=?,consent_text=?,updated_at=? WHERE member_id=?",[payload.edition,daymailVersion,daymailText,at,row.id]);
            await evidence(db,row.id,'dayplan','active',daymailVersion,daymailText);
          }
        } else {
          await db.run('INSERT INTO zonlio_member_sessions (id_hash,member_id,expires_at) VALUES (?,?,?)',[sessionHash,row.id,sessionExpires]);
          await evidence(db,row.id,'account','verified',accountVersion,'E-mailadres bevestigd voor toegang tot Mijn Zonlio; geen nieuwsbrief- of beltoestemming.');
        }
        return {purpose:c.purpose,member:member(row)};
      },true);
    },
    async session(hashValue) {
      return adapter.work(async db=>member(await db.get('SELECT m.* FROM zonlio_member_sessions s JOIN zonlio_members m ON m.id=s.member_id WHERE s.id_hash=? AND s.expires_at>?',[hashValue,stamp()])));
    },
    async revokeSession(hashValue) { await adapter.work(db=>db.run('DELETE FROM zonlio_member_sessions WHERE id_hash=?',[hashValue])); },
    async get(id) {
      return adapter.work(async db=>({member:member(await db.get('SELECT * FROM zonlio_members WHERE id=?',[id])),subscription:subscription(await db.get('SELECT * FROM zonlio_subscriptions WHERE member_id=?',[id]))}));
    },
    async saveProfile(id,profile,revision) {
      return adapter.work(async db=>{
        const row=await db.get(`SELECT * FROM zonlio_members WHERE id=?${lock}`,[id]);
        if (!row || Number(row.revision)!==revision) throw new MemberConflict();
        await db.run('UPDATE zonlio_members SET profile_json=?,revision=revision+1,updated_at=? WHERE id=?',[JSON.stringify(profile),stamp(),id]);
        return member(await db.get('SELECT * FROM zonlio_members WHERE id=?',[id]));
      },true);
    },
    async setSubscription(id,choice,revision,version,text) {
      return adapter.work(async db=>{
        await db.get(`SELECT name FROM zonlio_service_state WHERE name='mail-budget'${lock}`);
        const m=await db.get(`SELECT id,email_key,delivery_blocked FROM zonlio_members WHERE id=?${lock}`,[id]);
        if (!m) throw new MemberConflict();
        if (choice.status==='active'&&m.delivery_blocked) throw new TypeError('Voor dit adres geldt een verzendstop.');
        const existing=await db.get('SELECT * FROM zonlio_subscriptions WHERE member_id=?',[id]);
        if ((existing?Number(existing.revision):-1)!==revision) throw new MemberConflict();
        const at=stamp();
        if (existing) await db.run('UPDATE zonlio_subscriptions SET edition=?,status=?,revision=revision+1,consent_version=?,consent_text=?,updated_at=? WHERE member_id=?',[choice.edition,choice.status,version,text,at,id]);
        else await db.run('INSERT INTO zonlio_subscriptions (member_id,edition,status,revision,consent_version,consent_text,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[id,choice.edition,choice.status,0,version,text,at,at]);
        await evidence(db,id,'dayplan',choice.status,version,text);
        if (choice.status!=='active') {
          await db.run("UPDATE zonlio_member_mail SET status='cancelled',claim_token=NULL,locked_until=NULL WHERE member_id=? AND kind='daily' AND status IN ('pending','processing','failed')",[id]);
          await db.run("UPDATE zonlio_challenges SET consumed_at=? WHERE email_key=? AND purpose='subscribe' AND consumed_at IS NULL",[at,m.email_key]);
        }
        return subscription(await db.get('SELECT * FROM zonlio_subscriptions WHERE member_id=?',[id]));
      },true);
    },
    async unsubscribe(id,version,text) {
      // No optimistic version required for the narrow, signed stop-only operation.
      return adapter.work(async db=>{
        await db.get(`SELECT name FROM zonlio_service_state WHERE name='mail-budget'${lock}`);
        const m=await db.get(`SELECT id,email_key FROM zonlio_members WHERE id=?${lock}`,[id]);
        if (!m) return;
        const sub = await db.get('SELECT status FROM zonlio_subscriptions WHERE member_id=?',[id]);
        // A repeated stop also cancels an opt-in requested since the previous stop.
        // It must remain effective even if the subscription is already stopped.
        await db.run("UPDATE zonlio_challenges SET consumed_at=? WHERE email_key=? AND purpose='subscribe' AND consumed_at IS NULL",[stamp(),m.email_key]);
        await db.run("UPDATE zonlio_member_mail SET status='cancelled',claim_token=NULL,locked_until=NULL WHERE member_id=? AND kind='daily' AND status IN ('pending','processing','failed')",[id]);
        if (!sub || sub.status==='unsubscribed') return;
        await db.run("UPDATE zonlio_subscriptions SET status='unsubscribed',revision=revision+1,updated_at=? WHERE member_id=?",[stamp(),id]);
        await evidence(db,id,'dayplan','unsubscribed',version,text);
      },true);
    },
    async blockDelivery(id,reason='hard_bounce') {
      await adapter.work(async db=>{
        const row=await db.get('SELECT email_key FROM zonlio_members WHERE id=?',[id]);
        if(row)await suppress(db,row.email_key,reason);
      },true);
    },
    async suppressEmail(email,reason) { await adapter.work(db=>suppress(db,emailKey(email),reason),true); },
    async suppressionForEmail(email) { return adapter.work(async db=>{const row=await db.get('SELECT reason,created_at FROM zonlio_delivery_suppressions WHERE email_key=?',[emailKey(email)]);return row?{reason:row.reason,createdAt:row.created_at}:null;}); },
    async claimMail(limit=3) {
      return adapter.work(async db=>{
        const at=stamp();
        await db.run("UPDATE zonlio_member_mail SET status='expired',claim_token=NULL,locked_until=NULL WHERE expires_at<=? AND status IN ('pending','processing')",[at]);
        const rows=await db.all(`SELECT * FROM zonlio_member_mail WHERE (status='pending' AND next_attempt_at<=?) OR (status='processing' AND locked_until<=?) ORDER BY CASE WHEN kind='daily' THEN 1 ELSE 0 END,created_at,id LIMIT ${Math.max(1,Math.min(5,limit))}${lock}`,[at,at]);
        for (const row of rows) {
          row.claim_token=randomUUID(); row.attempts=Number(row.attempts)+1;
          await db.run("UPDATE zonlio_member_mail SET status='processing',attempts=?,claim_token=?,locked_until=? WHERE id=?",[row.attempts,row.claim_token,new Date(now()+90000).toISOString(),row.id]);
        }
        return rows;
      },true);
    },
    // On a closed public account system, claim ONLY owner-authenticated challenge mail.
    // Ordinary pending account/subscription/daymail is neither sent nor cancelled.
    async claimOwnerAcceptanceMail(adminEmail, limit=1) {
      if (!adminEmail) return [];
      return adapter.work(async db=>{
        const at=stamp();
        const rows=await db.all(`SELECT m.* FROM zonlio_member_mail m
          JOIN zonlio_challenges c ON c.id=m.challenge_id
          WHERE m.kind='login' AND c.email_key=? AND c.payload_json=?
            AND m.expires_at>? AND c.consumed_at IS NULL
            AND ((m.status='pending' AND m.next_attempt_at<=?)
              OR (m.status='processing' AND m.locked_until<=?))
          ORDER BY m.created_at,m.id LIMIT ${Math.max(1,Math.min(3,limit))}${lock}`,
          [emailKey(adminEmail),'{"ownerAcceptance":true}',at,at,at]);
        for(const row of rows){
          row.claim_token=randomUUID();row.attempts=Number(row.attempts)+1;
          await db.run("UPDATE zonlio_member_mail SET status='processing',attempts=?,claim_token=?,locked_until=? WHERE id=?",
            [row.attempts,row.claim_token,new Date(now()+90000).toISOString(),row.id]);
        }
        return rows;
      },true);
    },
    async mailContext(item) {
      return adapter.work(async db=>{
        const current=await db.get("SELECT id FROM zonlio_member_mail WHERE id=? AND claim_token=? AND status='processing' AND expires_at>? AND locked_until>?",[item.id,item.claim_token,stamp(),stamp()]);
        if (!current) return null;
        if (item.challenge_id) {
          const c=await db.get('SELECT * FROM zonlio_challenges WHERE id=? AND consumed_at IS NULL AND expires_at>?',[item.challenge_id,stamp()]);
          if(!c||await db.get('SELECT email_key FROM zonlio_delivery_suppressions WHERE email_key=?',[c.email_key]))return null;
          return {challenge:c};
        }
        return {member:member(await db.get('SELECT * FROM zonlio_members WHERE id=?',[item.member_id])),subscription:subscription(await db.get('SELECT * FROM zonlio_subscriptions WHERE member_id=?',[item.member_id]))};
      });
    },
    async finishMail(item,status,error=null) {
      const next=new Date(now()+Math.min(6*3600000,60000*3**Math.min(item.attempts-1,6))).toISOString();
      if (status==='retry' && item.attempts>=8) status='failed';
      await adapter.work(db=>db.run("UPDATE zonlio_member_mail SET status=?,next_attempt_at=?,claim_token=NULL,locked_until=NULL,last_error=?,sent_at=? WHERE id=? AND claim_token=? AND status='processing'",[status==='retry'?'pending':status,next,error,status==='accepted'?stamp():null,item.id,item.claim_token]));
    },
    async deferMail(item) {
      await adapter.work(db=>db.run("UPDATE zonlio_member_mail SET status='pending',attempts=attempts-1,next_attempt_at=?,claim_token=NULL,locked_until=NULL,last_error='SEND_BUDGET' WHERE id=? AND claim_token=? AND status='processing'",[new Date(now()+15*60000).toISOString(),item.id,item.claim_token]));
    },
    async reserveBudget(kind,limit) {
      if (!Number.isInteger(limit) || limit<1 || limit>100) return false;
      return adapter.work(async db=>{
        await db.get(`SELECT name FROM zonlio_service_state WHERE name='mail-budget'${lock}`);
        const since=new Date(now()-86400000).toISOString();
        const count=await db.get('SELECT COUNT(*) AS total FROM zonlio_send_budget WHERE reserved_at>?',[since]);
        // Twenty percent of configured capacity is reserved for account and request communications.
        const ceiling=kind==='daily'?Math.floor(limit*.8):limit;
        if (Number(count.total)>=ceiling) return false;
        await db.run('INSERT INTO zonlio_send_budget (id,kind,reserved_at) VALUES (?,?,?)',[randomUUID(),kind,stamp()]);
        return true;
      },true);
    },
    async acquireTask(name,seconds=90) {
      return adapter.work(async db=>{
        const row=await db.get(`SELECT * FROM zonlio_service_state WHERE name=?${lock}`,[name]);
        if (!row || (row.locked_until && row.locked_until>stamp())) return null;
        const token=randomUUID();await db.run('UPDATE zonlio_service_state SET locked_until=?,claim_token=? WHERE name=?',[new Date(now()+seconds*1000).toISOString(),token,name]);return token;
      },true);
    },
    async finishTask(name,token,result) { await adapter.work(db=>db.run('UPDATE zonlio_service_state SET locked_until=NULL,claim_token=NULL,value_text=? WHERE name=? AND claim_token=?',[JSON.stringify({at:stamp(),...result}),name,token])); },
    async dueSubscribers(edition,date,limit=30) {
      const unique = mysql ? "CONCAT('daily:',m.id,':',?)" : "'daily:' || m.id || ':' || ?";
      return adapter.work(db=>db.all(`SELECT m.id,m.profile_json,m.revision,s.revision AS subscription_revision FROM zonlio_members m JOIN zonlio_subscriptions s ON s.member_id=m.id WHERE s.status='active' AND s.edition=? AND m.delivery_blocked=0 AND NOT EXISTS (SELECT 1 FROM zonlio_member_mail q WHERE q.unique_key=${unique}) ORDER BY m.id LIMIT ${Math.min(100,Math.max(1,limit))}`,[edition,date]));
    },
    async queuePlan(row,date,plan) {
      const at=stamp();
      return adapter.work(db=>db.run(`${ignore} INTO zonlio_member_mail (id,unique_key,member_id,kind,payload_json,status,attempts,next_attempt_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,[randomUUID(),`daily:${row.id}:${date}`,row.id,'daily',JSON.stringify({plan,profileRevision:Number(row.revision),subscriptionRevision:Number(row.subscription_revision)}),plan.status==='available'?'pending':'skipped',0,at,plan.validUntil||at,at]));
    },
    async priceSnapshot(day) { return adapter.work(async db=>{const r=await db.get('SELECT * FROM zonlio_price_snapshots WHERE day=? AND fetched_at>?',[day,new Date(now()-15*60000).toISOString()]);return r?JSON.parse(r.payload_json):null;}); },
    async savePriceSnapshot(day,data) {
      const suffix=mysql?'ON DUPLICATE KEY UPDATE payload_json=VALUES(payload_json),fetched_at=VALUES(fetched_at)':'ON CONFLICT(day) DO UPDATE SET payload_json=excluded.payload_json,fetched_at=excluded.fetched_at';
      await adapter.work(db=>db.run(`INSERT INTO zonlio_price_snapshots (day,payload_json,fetched_at) VALUES (?,?,?) ${suffix}`,[day,JSON.stringify(data),stamp()]));
    },
    async stats() {
      return adapter.work(async db=>{
        const members=await db.get('SELECT COUNT(*) AS total,SUM(delivery_blocked) AS blocked FROM zonlio_members');
        const suppressions=await db.get('SELECT COUNT(*) AS total FROM zonlio_delivery_suppressions');
        const subscriptions=await db.all('SELECT status,COUNT(*) AS total FROM zonlio_subscriptions GROUP BY status');
        const mails=await db.all('SELECT status,COUNT(*) AS total FROM zonlio_member_mail GROUP BY status');
        const last=await db.get("SELECT value_text FROM zonlio_service_state WHERE name='maintenance'");
        const scheduler=await db.get("SELECT value_text FROM zonlio_service_state WHERE name='scheduler'");
        const queue=await db.get("SELECT MIN(created_at) AS oldest FROM zonlio_member_mail WHERE status IN ('pending','processing')");
        const sent=await db.get("SELECT MAX(sent_at) AS latest FROM zonlio_member_mail WHERE status='accepted'");
        const budget=await db.get('SELECT COUNT(*) AS total FROM zonlio_send_budget WHERE reserved_at>?',[new Date(now()-86400000).toISOString()]);
        return {verifiedEmails:Number(members.total),deliveryBlocked:Number(members.blocked||0),suppressedAddresses:Number(suppressions.total),subscriptions:Object.fromEntries(subscriptions.map(r=>[r.status,Number(r.total)])),mail:Object.fromEntries(mails.map(r=>[r.status,Number(r.total)])),oldestPendingAt:queue.oldest||null,latestAcceptedAt:sent.latest||null,reservedAttempts24h:Number(budget.total),maintenance:last?.value_text?JSON.parse(last.value_text):null,scheduler:scheduler?.value_text?JSON.parse(scheduler.value_text):null,definition:'Geverifieerde e-mailadressen en expliciete abonnementen; geen belbare leads. Accepted betekent SMTP-acceptatie, niet bewezen aflevering.'};
      });
    },
    async exportMember(id) {
      return adapter.work(async db=>{
        const row=await db.get('SELECT * FROM zonlio_members WHERE id=?',[id]);
        const stop=row?await db.get('SELECT reason,created_at FROM zonlio_delivery_suppressions WHERE email_key=?',[row.email_key]):null;
        return {member:member(row),subscription:subscription(await db.get('SELECT * FROM zonlio_subscriptions WHERE member_id=?',[id])),choices:await db.all('SELECT purpose,state,version,text_value,created_at FROM zonlio_consent_history WHERE member_id=? ORDER BY created_at',[id]),deliveryStop:stop?{reason:stop.reason,createdAt:stop.created_at}:null};
      });
    },
    async deleteMember(id) {
      await adapter.work(async db=>{
        await db.get(`SELECT name FROM zonlio_service_state WHERE name='mail-budget'${lock}`);
        const m=await db.get(`SELECT * FROM zonlio_members WHERE id=?${lock}`,[id]);if(!m)return;
        // Recovery stop for older backups. A later explicitly confirmed account
        // receives another id and is not silently confused with this erased one.
        await db.run(`${ignore} INTO zonlio_member_erasure (member_id,email_key,erased_at) VALUES (?,?,?)`,[m.id,m.email_key,stamp()]);
        await db.run('DELETE FROM zonlio_member_sessions WHERE member_id=?',[id]);
        await db.run('DELETE FROM zonlio_subscriptions WHERE member_id=?',[id]);
        await db.run('DELETE FROM zonlio_consent_history WHERE member_id=?',[id]);
        await db.run('DELETE FROM zonlio_member_mail WHERE member_id=? OR challenge_id IN (SELECT id FROM zonlio_challenges WHERE email_key=?)',[id,m.email_key]);
        await db.run('DELETE FROM zonlio_challenges WHERE email_key=?',[m.email_key]);
        await db.run('DELETE FROM zonlio_members WHERE id=?',[id]);
        // A minimal hashed delivery stop is intentionally retained: deleting an
        // account must not silently re-enable an address stopped after a complaint.
      },true);
    },
    async cleanup() {
      await adapter.work(async db=>{
        await db.run('DELETE FROM zonlio_member_sessions WHERE expires_at<=?',[stamp()]);
        const cutoff=new Date(now()-7*86400000).toISOString();
        await db.run('DELETE FROM zonlio_member_mail WHERE challenge_id IN (SELECT id FROM zonlio_challenges WHERE created_at<?)',[cutoff]);
        await db.run('DELETE FROM zonlio_challenges WHERE created_at<?',[cutoff]);
        await db.run("DELETE FROM zonlio_member_mail WHERE created_at<? AND kind='daily' AND status IN ('accepted','cancelled','expired','skipped','failed')",[new Date(now()-30*86400000).toISOString()]);
        await db.run('DELETE FROM zonlio_send_budget WHERE reserved_at<?',[new Date(now()-2*86400000).toISOString()]);
        await db.run('DELETE FROM zonlio_price_snapshots WHERE fetched_at<?',[cutoff]);
      },true);
    },
  };
  return repo;
}
