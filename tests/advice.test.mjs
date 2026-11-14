import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createStore, LeadUpdateConflict } from '../server/store.mjs';
import { createMail } from '../server/mail.mjs';
import { renderLegalController } from '../server.mjs';
import { housingFieldErrors, followUpFieldErrors } from '../src/advice-schema.mjs';

const input=()=>({requestId:randomUUID(), name:'QA Aanvrager', channel:'phone', phone:'+31600000000',email:'qa@example.invalid',
  postcode:'2311AB',topic:'battery',message:'Alleen synthetische QA-gegevens',shareScenario:false,sourcePath:'batterij',
  consentVersion:'2026-11-14-housing-v1', contactText:'QA contactbewijs',controller:{name:'NIVO QA',email:'qa@example.invalid'},
  intake:{kind:'housing',address:{street:'Voorbeeldstraat',houseNumber:'12',addition:'A',city:'Teststad'},contactPreference:'morning'}});
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'zonlio-advice-'));let time=Date.parse('2026-11-14T12:00:00Z');
  const env={NODE_ENV:'test',SQLITE_PATH:join(dir,'qa.sqlite')};const store=await createStore({env,now:()=>time});let closed=false;
  t.after(async()=>{if(!closed)await store.close();await rm(dir,{recursive:true,force:true});});
  return {store,env,now:()=>time,advance:ms=>{time+=ms;},close:async()=>{await store.close();closed=true;}};
}

test('NAW contract validates complete Dutch address without claiming address verification',()=>{
  const source=input();const values={housing:source.intake.address,postcode:source.postcode,topic:source.topic,contactPreference:source.intake.contactPreference};
  assert.deepEqual(housingFieldErrors(values),{});
  for(const change of [{postcode:'2311'},{topic:'constructor'},{contactPreference:'constructor'},{housing:{...values.housing,houseNumber:'0'}},{housing:{...values.housing,street:'x\ny'}},{housing:{...values.housing,secret:1}}])assert.ok(Object.keys(housingFieldErrors({...values,...change})).length);
  assert.ok(followUpFieldErrors({owner:'',nextAction:'test',nextActionOn:'2026-11-15'}).nextAction);
  assert.ok(followUpFieldErrors({owner:'test',nextAction:'test',nextActionOn:'2026-02-30'}).nextActionOn);
});

test('housing and follow-up survive reopening; old-style requests remain address-free',async t=>{
  const f=await fixture(t);const saved=await f.store.createLead(input(),'housing-one');
  await f.store.updateLead(saved.lead.id,{status:'appointment',actor:'qa',expectedRevision:0,followUp:{owner:'QA team',nextAction:'Bevestig voorkeur',nextActionOn:'2026-11-16'}});
  const legacy={...input(),requestId:randomUUID()};delete legacy.intake;
  const old=await f.store.createLead(legacy,'legacy');assert.equal(old.lead.kind,'general');assert.equal(old.lead.housing,null);
  await f.close();const reopened=await createStore({env:f.env,now:f.now});
  try{const detail=await reopened.getLead(saved.lead.id);assert.equal(detail.lead.housing.street,'Voorbeeldstraat');assert.equal(detail.lead.followUp.owner,'QA team');assert.equal(detail.lead.revision,1);assert.equal(detail.history.length,2);}finally{await reopened.close();}
});

test('housing, follow-up, evidence and lead roll back together on outbox failure',async t=>{
  const f=await fixture(t);const db=new DatabaseSync(f.env.SQLITE_PATH);db.exec('DROP TABLE outbox');
  await assert.rejects(f.store.createLead(input(),'rollback'));
  for(const table of ['leads','lead_intakes','lead_followups','lead_history'])assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0,table);
  db.close();
});

test('one stale update cannot overwrite a newer follow-up',async t=>{
  const f=await fixture(t);const saved=await f.store.createLead(input(),'concurrent');
  const results=await Promise.allSettled(['QA A','QA B'].map(owner=>f.store.updateLead(saved.lead.id,{status:'assigned',actor:owner,expectedRevision:0,followUp:{owner,nextAction:'Bel',nextActionOn:'2026-11-15'}})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.ok(results.find(r=>r.status==='rejected').reason instanceof LeadUpdateConflict);
  assert.equal((await f.store.getLead(saved.lead.id)).lead.revision,1);
});

test('withdrawal cancels already claimed mail and a late worker cannot overwrite it',async t=>{
  const f=await fixture(t);const saved=await f.store.createLead(input(),'cancel');
  const claimed=await f.store.claimOutbox(2);assert.equal(claimed.length,2);
  await f.store.updateLead(saved.lead.id,{status:'withdrawn',actor:'qa'});
  for(const item of claimed)await f.store.finishMail(item,{success:true});
  assert.equal((await f.store.mailStats()).sent,0);assert.equal((await f.store.mailStats()).cancelled,2);
  assert.equal(await f.store.retryFailedMail(),0);
  assert.equal((await f.store.stats(7)).workload.actionable,0);
});

test('expired contact requests never send deferred notification or confirmation',async t=>{
  const f=await fixture(t);await f.store.createLead(input(),'expired');f.advance(31*86400000);let sent=0;
  const mail=createMail({store:f.store,env:{},now:f.now,transport:{sendMail:async()=>{sent++;}}});
  const result=await mail.processBatch({limit:2});assert.equal(sent,0);assert.equal(result.cancelled,2);
});

test('internal mail excludes NAW and phone, while customer gets text and HTML',async t=>{
  const f=await fixture(t);await f.store.createLead(input(),'safe-mail');const messages=[];
  const mail=createMail({store:f.store,env:{},now:f.now,transport:{sendMail:async m=>{messages.push(m);return {accepted:[m.to],rejected:[]};}}});
  const result=await mail.processBatch({limit:2});assert.equal(result.sent,2);
  const internal=messages.find(m=>m.to==='info@zonlio.nl');assert.ok(internal);
  assert.doesNotMatch(internal.text,/QA Aanvrager|31600000000|qa@example.invalid|Voorbeeldstraat|2311AB/);
  assert.match(internal.text,/\/admin#lead=/);
  for(const message of messages){assert.match(message.html,/Zonlio/);assert.ok(message.text);assert.doesNotMatch(message.html,/<script|<img|tracking/i);}
});

test('company marker is escaped consistently; no script or replacement expansion',()=>{
  const html='<strong><!--zonlio:controller-->Old<!--/zonlio:controller--></strong>';
  const result=renderLegalController(html,{name:'NIVO <script> & $&'});
  assert.equal(result,'<strong>NIVO &lt;script&gt; &amp; $&amp;</strong>');
  assert.equal(renderLegalController('<p>unchanged</p>',{}),'<p>unchanged</p>');
});
