import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createMail } from '../server/mail.mjs';
import { createOperations } from '../server/operations.mjs';
import { operationsMarkup,salesFunnelMarkup } from '../src/admin-operations.mjs';

async function fixture(t,{env={},transport}={}) {
  let time=Date.parse('2026-11-14T12:00:00Z');
  const settings={NODE_ENV:'test',SQLITE_PATH:':memory:',SMTP_DAILY_LIMIT:'10',...env};
  const store=await createStore({env:settings,now:()=>time});
  const sent=[];
  const mail=createMail({env:settings,store,now:()=>time,transport:transport||{sendMail:async message=>{sent.push(message);return {accepted:[message.to]};}}});
  t.after(()=>store.close());
  const lead=async extra=>(await store.createLead({requestId:randomUUID(),name:'Synthetic Person',email:'synthetic@example.invalid',channel:'email',phone:'',postcode:'2311',topic:'battery',message:'Fixture only',shareScenario:false,scenario:null,sourcePath:'2027',consentVersion:'fixture',contactText:'Only a test',controller:{name:'NIVO Groep Holland BV',email:'info@zonlio.nl'},...extra},randomUUID())).lead;
  return {store,mail,sent,lead,settings,now:()=>time,advance:ms=>{time+=ms;}};
}

test('maintenance lease serializes workers, preserves restart history and rejects late completion',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'zonlio-ops-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  let time=Date.parse('2026-11-14T12:00:00Z');const env={NODE_ENV:'test',SQLITE_PATH:join(folder,'store.sqlite')};
  let store=await createStore({env,now:()=>time});
  const identities={instanceId:randomUUID(),releaseId:'test-release'};
  const leases=await Promise.all(Array.from({length:6},()=>store.operations.beginRun(identities)));
  assert.equal(leases.filter(Boolean).length,1);
  const first=leases.find(Boolean);time+=240001;
  const second=await store.operations.beginRun(identities);assert.ok(second);
  assert.equal(await store.operations.finishRun(first,true),false);
  assert.equal(await store.operations.finishRun(second,true),true);
  await store.close();store=await createStore({env,now:()=>time});t.after(()=>store.close());
  time+=300000;const third=await store.operations.beginRun({instanceId:randomUUID(),releaseId:'test-release'});await store.operations.finishRun(third,true);
  const report=await store.operations.summary();assert.equal(report.successfulTicks24h,2);assert.equal(report.observedInstances24h,2);assert.ok(report.runs.some(run=>run.status==='interrupted'));
  assert.doesNotMatch(JSON.stringify(report),/claim_token|instance_id/);
});

test('alerts are persistent, deduplicated, limited by the shared budget and contain no contact data',async t=>{
  const f=await fixture(t,{env:{OPS_EXPECT_CRON:'true',OPS_ALERTS_ENABLED:'true',OPS_ALERT_TO:'ops@example.invalid'}});
  await f.lead();f.advance(31*60000);
  const ops=createOperations({env:f.settings,store:f.store,mail:f.mail,now:f.now});
  const first=await ops.inspectAndNotify();assert.equal(first.notified,true);assert.equal(f.sent.length,1);
  assert.doesNotMatch(f.sent[0].text,/Synthetic Person|synthetic@example|Fixture only|ZON-/);
  assert.equal((await ops.inspectAndNotify()).notified,false);assert.equal(f.sent.length,1);
  const state=await f.store.operations.summary();assert.ok(state.alerts.find(row=>row.code==='cron_overdue').notifiedAt);
  assert.equal((await f.store.members.stats()).reservedAttempts24h,1);
  await assert.rejects(f.store.operations.recordChecks([{code:'arbitrary_private_string',problem:true}]),/INVALID/);
  for(let i=1;i<10;i++)await f.store.members.reserveBudget('lead',10);
  f.advance(6*3600000+1);assert.equal((await ops.inspectAndNotify()).reason,'budget');assert.equal(f.sent.length,1);
});

test('price/cron failures are distinct and an intentionally closed service is not a missed cron',async t=>{
  const f=await fixture(t);
  const market={getStatus:()=>({status:'degraded',lastSuccessAt:null}),getDay:async()=>({status:'unavailable'})};
  const ops=createOperations({env:f.settings,store:f.store,mail:f.mail,market,now:f.now});
  const report=await ops.snapshot();assert.equal(report.cronStatus,'not_required');assert.equal(report.checks.find(row=>row.code==='price_source').problem,true);
  assert.equal((await ops.warmSources()).prices,'unavailable');
  assert.equal((await ops.inspectAndNotify()).notified,false);
});

test('zero mail quota is a real stop; exhausted quota defers without losing a lead or burning attempts',async t=>{
  const f=await fixture(t,{env:{SMTP_DAILY_LIMIT:'0'}});await f.lead();
  assert.equal((await f.mail.processBatch()).reason,'budget_unconfigured');assert.equal(f.sent.length,0);assert.equal((await f.store.mailStats()).pending,2);
  const g=await fixture(t,{env:{SMTP_DAILY_LIMIT:'1'}});await g.lead();await g.store.members.reserveBudget('admin_test',1);
  assert.equal((await g.mail.processBatch()).sent,0);assert.equal((await g.store.mailStats()).pending,2);
  g.advance(86400000+1);assert.equal((await g.mail.processBatch()).sent,1);assert.equal((await g.store.stats()).totals.leads,1);
});

test('suppression blocks customer email but preserves internal notification; closure blocks queued work',async t=>{
  const f=await fixture(t);await f.lead();await f.store.members.suppressEmail('synthetic@example.invalid','complaint');
  const result=await f.mail.processBatch();assert.equal(result.sent,1);assert.equal(result.cancelled,1);assert.equal(f.sent[0].to,'portal@nivogroepholland.nl');
  const lead=await f.lead({email:'second@example.invalid'});await f.store.updateLead(lead.id,{status:'closed',actor:'qa'});
  assert.equal((await f.mail.processBatch()).cancelled,2);assert.equal(f.sent.length,1);
});

test('a hard bounce during a contact correction blocks only the attempted address and cannot revive cancelled mail',async t=>{
  const original='before-correction@example.invalid',corrected='after-correction@example.invalid';
  const attempted=[];
  let f,lead;
  f=await fixture(t,{transport:{sendMail:async message=>{
    attempted.push(message.to);
    if(message.to===original) {
      await f.store.privacy.correctLead(lead.id,{expectedRevision:0,actor:'qa',fields:{email:corrected}});
      throw Object.assign(new Error('Synthetic SMTP rejection'),{code:'EENVELOPE',response:'550 5.1.1 recipient unknown'});
    }
    return {accepted:[message.to]};
  }}});
  lead=await f.lead({email:original});
  const result=await f.mail.processBatch();
  assert.equal(result.failed,1);
  assert.equal((await f.store.members.suppressionForEmail(original)).reason,'hard_bounce');
  assert.equal(await f.store.members.suppressionForEmail(corrected),null);
  assert.equal((await f.store.getLead(lead.id)).lead.email,corrected);
  const confirmation=(await f.store.privacy.exportLead(lead.id)).mail.find(item=>item.kind==='customer_confirmation');
  assert.equal(confirmation.status,'cancelled','The late SMTP failure must not restore the privacy-cancelled claim');
  assert.equal((await f.store.mailStats()).pending,0);
  f.advance(60001);
  assert.equal((await f.mail.processBatch({retryFailed:true})).processed,0);
  assert.equal(attempted.filter(address=>address===original).length,1);
  assert.equal(attempted.includes(corrected),false);
});

test('expired lease cannot send; ambiguous SMTP acceptance retries and does not claim inbox success',async t=>{
  const f=await fixture(t,{transport:{sendMail:async()=>({})}});await f.lead();
  const items=await f.store.claimOutbox();f.advance(90001);assert.equal(await f.store.mailClaimActive(items[0]),false);
  const result=await f.mail.processBatch();assert.equal(result.sent,0);assert.equal(result.failed,2);assert.equal((await f.store.mailStats()).pending,2);
});

test('sales milestones survive later status changes, count each dossier once and do not invent skipped steps',async t=>{
  const f=await fixture(t);const lead=await f.lead();
  for(const status of ['contacted','qualified','qualified','won'])await f.store.updateLead(lead.id,{status,actor:'qa'});
  const stats=await f.store.stats(30);const source=stats.acquisition.find(row=>row.sourcePath==='2027');
  assert.equal(source.leads,1);assert.equal(source.milestones.contacted,1);assert.equal(source.milestones.qualified,1);assert.equal(source.milestones.won,1);assert.equal(source.milestones.appointment,0);
  assert.doesNotMatch(JSON.stringify(stats),/synthetic@example|Synthetic Person/);
});

test('admin operation and sales markup escapes dynamic data and states evidence limits',()=>{
  const html=operationsMarkup({checks:[{problem:true,label:'<script>private</script>'}],budget:{limit:50,used:2,remaining:48},runs:[{releaseId:'<img>',status:'failed'}]});
  assert.doesNotMatch(html,/<script>|<img>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/mail-suppression-form/);assert.match(html,/Geen bewijs van inboxbezorging/);
  assert.match(salesFunnelMarkup([{sourcePath:'2027',leads:1,milestones:{won:1}}]),/overgeslagen stappen worden niet verondersteld/);
});
