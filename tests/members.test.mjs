import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import {createBackend} from '../server/backend.mjs';
import {hashPassword} from '../server/auth.mjs';
import {DAYMAIL_POLICY_VERSION,cleanEnergyProfile} from '../src/member-schema.mjs';
import {OPERATOR} from '../server/operator.mjs';
import {localDate,addDays} from '../src/api.mjs';
const adminPassword='members-tests-no-live-password';
const passwordHash=await hashPassword(adminPassword);
function priceDay(date){const start=Date.parse(date+'T00:00:00+01:00');return {status:'available',date,stale:false,fetchedAt:new Date(start).toISOString(),source:{name:'QA price source',attribution:'Synthetic QA data',license:'QA only'},intervals:Array.from({length:96},(_,i)=>({start:new Date(start+i*900000).toISOString(),durationMinutes:15,marketEurMWh:100+((i%24)-12)*2}))};}
async function setup(t,overrides={},options={}){
 let time=Date.parse('2026-11-14T12:00:00Z');const messages=[],logs=[];let upstream=0;let fail=false;
 const env={NODE_ENV:'test',SQLITE_PATH:':memory:',PUBLIC_URL:'http://zonlio.test',ADMIN_EMAIL:'qa@example.invalid',ADMIN_PASSWORD_HASH:passwordHash,SESSION_SECRET:'qa-long-session-secret-at-least-32-characters',CRON_SECRET:'qa-cron-secret-at-least-32-characters',LEAD_CONTROLLER_NAME:OPERATOR.name,LEAD_CONTROLLER_CONFIRMED:'true',MEMBER_ACCOUNTS_ENABLED:'true',DAYMAIL_SIGNUP_ENABLED:'true',DAYMAIL_SEND_ENABLED:'true',SMTP_DAILY_LIMIT:'100',PORTAL_EXPORT_ENABLED:'true',PORTAL_EXPORT_TOKEN:'qa-portal-secret-at-least-32-characters',HOUSING_ADVICE_ENABLED:'true',...overrides};
 const transport={verify:async()=>true,sendMail:async message=>{if(fail)throw Object.assign(new Error('private smtp diagnostic'),typeof fail==='object'?fail:{code:'ECONNECTION'});messages.push(message);return {accepted:[message.to],rejected:[]};}};
 const backend=await createBackend({env,now:()=>time,mailTransport:transport,logger:event=>logs.push(event),market:{getDay:async date=>{upstream++;return options.priceDay?options.priceDay(date):priceDay(date);}}});
 const app=express();app.use(express.json());app.use('/api',backend.router);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 t.after(async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await backend.close();});
 async function api(path,{method='GET',body,cookie,csrf,authorization,origin=env.PUBLIC_URL,type='application/json'}={}){
  const res=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':type}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(authorization?{Authorization:authorization}:{})},body:body===undefined?undefined:type==='application/json'?JSON.stringify(body):body});
  const text=await res.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:res.status,body:data,cookie:res.headers.get('set-cookie')?.split(';')[0],setCookie:res.headers.get('set-cookie')};
 }
 async function sentToken(email,purpose='login',profile={devices:['washing'],startHour:8,endHour:22}){
  const before=messages.length;const route=purpose==='login'?'/login':'/subscribe';
  const response=await api('/member'+route,{method:'POST',body:purpose==='login'?{email}:{email,profile,edition:'evening',consent:true,policyVersion:DAYMAIL_POLICY_VERSION}});assert.equal(response.status,202,JSON.stringify(response));
  for(let i=0;i<100&&messages.length===before;i++)await new Promise(resolve=>setTimeout(resolve,5));
  const message=messages.slice(before).find(m=>m.to===email);assert.ok(message,'fake transport must receive exactly the queued confirmation');return message.text.match(/#bevestig=([A-Za-z0-9_.-]+)/)[1];
 }
 async function verify(token){return api('/member/verify',{method:'POST',body:{token}});}
 async function login(email='member@example.invalid'){
  const token=await sentToken(email);const v=await verify(token);assert.equal(v.status,200);const session=await api('/member/session',{cookie:v.cookie});assert.equal(session.body.authenticated,true);return {cookie:v.cookie,csrf:session.body.csrfToken,token};
 }
 return {api,backend,env,messages,logs,sentToken,verify,login,now:()=>time,advance:ms=>{time+=ms;},setTime:iso=>{time=Date.parse(iso);},fail:value=>{fail=value;},upstream:()=>upstream};
}

test('new services default closed; mismatched old controller cannot silently receive new requests',async t=>{
 const f=await setup(t,{MEMBER_ACCOUNTS_ENABLED:'false',DAYMAIL_SIGNUP_ENABLED:'false',DAYMAIL_SEND_ENABLED:'false'});
 assert.equal((await f.api('/member/login',{method:'POST',body:{email:'qa@example.invalid'}})).status,503);assert.equal(f.messages.length,0);
 const wrong=await setup(t,{LEAD_CONTROLLER_NAME:'Thuisbatterij Team B.V.'});
 const config=(await wrong.api('/config')).body;assert.equal(config.controller.name,OPERATOR.name);assert.equal(config.operatorConfigured,false);assert.equal(config.leadEnabled,false);assert.equal(config.members.accountsEnabled,false);
 const noQuota=await setup(t,{SMTP_DAILY_LIMIT:'0'});assert.equal((await noQuota.api('/member/config')).body.accountsEnabled,false);
 const aboveProvider=await setup(t,{SMTP_DAILY_LIMIT:'101'});assert.equal((await aboveProvider.api('/member/config')).body.accountsEnabled,false);
 assert.equal((await aboveProvider.api('/member/login',{method:'POST',body:{email:'quota@example.invalid'}})).status,503);
 assert.equal(await aboveProvider.backend.store.members.reserveBudget('login',101),false);assert.equal(aboveProvider.messages.length,0);
});

test('double opt-in creates a confirmed subscriber but no sales lead, account session or hidden marketing',async t=>{
 const f=await setup(t);const token=await f.sentToken('subscriber@example.invalid','subscribe');
 assert.equal((await f.backend.store.members.stats()).subscriptions.active,undefined);
 const v=await f.verify(token);assert.equal(v.status,200);assert.equal(v.body.purpose,'subscribe');assert.equal(v.cookie,undefined);
 assert.equal((await f.api('/member/session')).body.authenticated,false);assert.equal((await f.backend.store.members.stats()).subscriptions.active,1);
 assert.equal((await f.backend.store.stats(7)).totals.leads,0);assert.equal((await f.verify(token)).status,400);
 assert.doesNotMatch(JSON.stringify(f.logs),/subscriber@example|bevestig=/);
 const bad=await f.api('/member/subscribe',{method:'POST',body:{email:'other@example.invalid',edition:'evening',profile:{devices:['washing']},consent:true,policyVersion:DAYMAIL_POLICY_VERSION,marketing:true}});assert.equal(bad.status,422);
});

test('login link is single use, expires, has no GET side effects and uses a separate HttpOnly session',async t=>{
 const f=await setup(t);const token=await f.sentToken('member@example.invalid');
 assert.equal((await f.api('/member/session')).body.authenticated,false);
 assert.equal((await f.api('/member/verify')).status,404);
 const v=await f.verify(token);assert.equal(v.status,200);assert.match(v.cookie,/zonlio_member=/);assert.match(v.setCookie,/HttpOnly/);assert.match(v.setCookie,/SameSite=Strict/);assert.equal((await f.verify(token)).status,400);
 f.advance(121000);const expired=await f.sentToken('late@example.invalid');f.advance(16*60000);assert.equal((await f.verify(expired)).status,400);
 const bad=await f.api('/member/login',{method:'POST',body:{email:'member@example.invalid'},origin:'https://evil.invalid'});assert.equal(bad.status,403);
 assert.equal((await f.api('/member/profile')).status,401);
 f.advance(7*86400000);assert.equal((await f.api('/member/session',{cookie:v.cookie})).body.authenticated,false);
});

test('profile persists across sessions, validates all fields and enforces ownership, CSRF and revision',async t=>{
 const f=await setup(t);const a=await f.login('a@example.invalid'),b=await f.login('b@example.invalid');
 const profile=cleanEnergyProfile({scenario:{annualUse:4100},devices:['washing'],contract:{type:'dynamic',confirmed:true,resolution:'hour',markup:.02,energyTax:.1,vat:.21},startHour:8,endHour:20});
 assert.equal((await f.api('/member/profile',{method:'PUT',cookie:a.cookie,body:{profile,expectedRevision:0}})).status,403);
 const save=await f.api('/member/profile',{...a,method:'PUT',body:{profile,expectedRevision:0}});assert.equal(save.status,200);assert.equal(save.body.member.revision,1);
 assert.equal((await f.api('/member/profile',{...a,method:'PUT',body:{profile,expectedRevision:0}})).status,409);
 assert.deepEqual((await f.api('/member/profile',a)).body.member.profile,profile);assert.equal((await f.api('/member/profile',b)).body.member.profile.scenario.annualUse,undefined);
 assert.equal((await f.api('/member/profile',{...a,method:'PUT',body:{profile:{...profile,name:'not allowed'},expectedRevision:1}})).status,422);
 assert.equal((await f.api('/member/profile',{...a,method:'PUT',body:{profile,memberId:'another-user',expectedRevision:1}})).status,422);
 const exported=await f.api('/member/export',a);assert.equal(exported.body.member.email,'a@example.invalid');assert.doesNotMatch(JSON.stringify(exported.body),/token_hash|session_hash|qa-long-session-secret/);
 assert.equal((await f.api('/member/logout',{...a,method:'POST',body:{}})).status,204);assert.equal((await f.api('/member/profile',a)).status,401);
 f.advance(121000);const relogged=await f.login('a@example.invalid');
 assert.deepEqual((await f.api('/member/profile',relogged)).body.member.profile,profile);
});

test('anonymous repeat requests do not overwrite an active subscriber profile or edition',async t=>{
 const f=await setup(t);await f.verify(await f.sentToken('repeat@example.invalid','subscribe',{devices:['washing'],scenario:{annualUse:4500}}));
 f.advance(121000);await f.verify(await f.sentToken('repeat@example.invalid','subscribe',{devices:['car'],scenario:{annualUse:1}}));
 f.advance(121000);const s=await f.login('repeat@example.invalid');const p=(await f.api('/member/profile',s)).body;
 assert.equal(p.member.profile.scenario.annualUse,4500);assert.deepEqual(p.member.profile.devices,['washing']);
 assert.equal((await f.api('/member/subscription',{...s,method:'PUT',body:{choice:{edition:'morning',status:'active'},expectedRevision:p.subscription.revision,policyVersion:DAYMAIL_POLICY_VERSION,consent:false}})).status,422);
});

test('scheduler uses shared published data, emits one logical daily mail, labels real basis and supports one-click',async t=>{
 const f=await setup(t);await f.verify(await f.sentToken('daily@example.invalid','subscribe'));
 f.setTime('2026-11-14T17:01:00Z'); // 18:01 in the Netherlands.
 const first=await f.backend.memberService.maintenance();assert.equal(first.schedule.queued,1);assert.equal(first.sent.accepted,1);
 const daily=f.messages.find(m=>m.subject.includes('dagplan ·'));assert.ok(daily);assert.match(daily.text,/2026-11-15/);assert.match(daily.text,/Alleen beurskosten/);assert.match(daily.headers['List-Unsubscribe-Post'],/^List-Unsubscribe=One-Click$/);
 assert.doesNotMatch(daily.text,/bespaar je|automatisch draaien|NIVO belt/);assert.ok(daily.html.includes('KvK 95227768'));
 await f.backend.memberService.maintenance();assert.equal(f.messages.filter(m=>m.subject.includes('dagplan ·')).length,1);assert.equal(f.upstream(),1);
 const url=new URL(daily.headers['List-Unsubscribe'].slice(1,-1));
 assert.equal((await f.api('/member/one-click'+url.search)).status,405);
 const result=await f.api('/member/one-click'+url.search,{method:'POST',type:'application/x-www-form-urlencoded',body:'List-Unsubscribe=One-Click',origin:'https://mail-client.invalid'});assert.equal(result.status,204);
 assert.equal((await f.backend.store.members.stats()).subscriptions.unsubscribed,1);
 const stop=url.searchParams.get('token');assert.equal((await f.verify(stop)).status,400);
});

test('unsubscribe invalidates older opt-in links and stops a queued/claimed daymail',async t=>{
 const f=await setup(t);await f.verify(await f.sentToken('stop@example.invalid','subscribe'));f.advance(121000);const session=await f.login('stop@example.invalid');
 const {member,subscription}= (await f.api('/member/profile',session)).body;
 f.advance(121000);const old=await f.sentToken('stop@example.invalid','subscribe');
 const date=addDays(localDate(f.now()),1);const rows=await f.backend.store.members.dueSubscribers('evening',date);await f.backend.store.members.queuePlan(rows[0],date,{status:'available',validUntil:new Date(f.now()+3600000).toISOString()});
 const claimed=await f.backend.store.members.claimMail();assert.ok(claimed.some(i=>i.kind==='daily'));
 const stopped=await f.api('/member/subscription',{...session,method:'PUT',body:{choice:{edition:'evening',status:'unsubscribed'},expectedRevision:subscription.revision}});assert.equal(stopped.status,200);
 assert.equal((await f.verify(old)).status,400);
 for(const item of claimed)assert.equal(await f.backend.store.members.mailContext(item),null);
 assert.equal((await f.api('/member/profile',session)).body.member.id,member.id);
});

test('mail failures retry safely, no raw diagnostics leak and the rolling budget is persistent/concurrent',async t=>{
 const f=await setup(t);const repo=f.backend.store.members;
 const reservations=await Promise.all(Array.from({length:20},()=>repo.reserveBudget('daily',10)));assert.equal(reservations.filter(Boolean).length,8);
 assert.equal(await repo.reserveBudget('login',10),true);assert.equal(await repo.reserveBudget('login',10),true);assert.equal(await repo.reserveBudget('login',10),false);
 f.advance(86400001);assert.equal(await repo.reserveBudget('daily',10),true);
 f.fail(true);assert.equal((await f.api('/member/login',{method:'POST',body:{email:'retry@example.invalid'}})).status,202);
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(f.messages.length,0);assert.ok((await repo.stats()).mail.pending>=1);
 f.advance(60001);f.fail(false);await f.backend.memberService.processMail();assert.equal(f.messages.length,1);
 assert.doesNotMatch(JSON.stringify(await repo.stats()),/private smtp diagnostic|retry@example/);
});

test('profile deletion removes active account data and pending mail, not unrelated housing leads',async t=>{
 const f=await setup(t);const s=await f.login('delete@example.invalid');
 const previousId=(await f.api('/member/profile',s)).body.member.id;
 assert.equal((await f.api('/member/profile',{...s,method:'DELETE',body:{confirm:'wrong'}})).status,422);
 assert.equal((await f.api('/member/profile',{...s,method:'DELETE',body:{confirm:'DELETE_MY_ZONLIO'}})).status,200);
 assert.equal((await f.api('/member/profile',s)).status,401);assert.equal((await f.backend.store.members.stats()).verifiedEmails,0);
 f.advance(121000);const newSession=await f.login('delete@example.invalid');
 assert.notEqual((await f.api('/member/profile',newSession)).body.member.id,previousId,'Explicitly verifying again creates a new account, never revives the erased identity.');
});

test('NIVO Portal claim/ack is gated, idempotent and withdrawal exports no NAW',async t=>{
 const f=await setup(t);const config=(await f.api('/config')).body;
 const token=(await f.api('/form-token')).body.token;
 const response=await f.api('/housing-leads',{method:'POST',body:{requestId:randomUUID(),formToken:token,website:'',name:'Portal QA',channel:'phone',phone:'0600000000',postcode:'1234AB',housing:{street:'Teststraat',houseNumber:'1',city:'Teststad',addition:''},topic:'battery',contactPreference:'any',contactRequested:true,consentVersion:config.housingConsentVersion,shareScenario:false,sourcePath:'batterij'}});assert.equal(response.status,201);
 assert.equal((await f.api('/portal/claim',{method:'POST',body:{limit:5}})).status,401);
 const auth={authorization:`Bearer ${f.env.PORTAL_EXPORT_TOKEN}`};
 const claims=await f.api('/portal/claim',{...auth,method:'POST',body:{limit:5}});assert.equal(claims.status,200);assert.equal(claims.body.events.length,1);
 const e=claims.body.events[0];assert.equal(e.assignmentHint,'Pim');assert.equal(e.person.name,'Portal QA');assert.equal(e.scenario,null);
 const ack={id:e.id,claimToken:e.claimToken,portalReference:'portal-test-1'};
 assert.equal((await f.api('/portal/ack',{...auth,method:'POST',body:ack})).body.ok,true);assert.equal((await f.api('/portal/ack',{...auth,method:'POST',body:ack})).body.ok,true);
 assert.equal((await f.api('/portal/claim',{...auth,method:'POST',body:{}})).body.events.length,0);
 await f.backend.store.updateLead(e.requestId,{status:'withdrawn',actor:'QA'});
 const withdrawn=(await f.api('/portal/claim',{...auth,method:'POST',body:{}})).body.events[0];assert.equal(withdrawn.type,'advice.withdrawn');assert.equal(withdrawn.person,undefined);assert.equal(withdrawn.housing,undefined);assert.equal(withdrawn.contact.requested,false);
});

test('a queued plan with an old profile or expired start never reaches the mail transport',async t=>{
 const f=await setup(t);await f.verify(await f.sentToken('changed-plan@example.invalid','subscribe'));
 const repo=f.backend.store.members;const date=addDays(localDate(f.now()),1);
 const [row]=await repo.dueSubscribers('evening',date);
 await repo.queuePlan(row,date,{status:'available',validUntil:new Date(f.now()+3600000).toISOString()});
 const before=f.messages.length;
 await repo.saveProfile(row.id,cleanEnergyProfile({devices:['car']}),Number(row.revision));
 const result=await f.backend.memberService.processMail();assert.equal(result.cancelled,1);assert.equal(f.messages.length,before);
 const [latest]=await repo.dueSubscribers('evening',addDays(date,1));
 await repo.queuePlan(latest,addDays(date,1),{status:'available',validUntil:new Date(f.now()+1000).toISOString()});
 f.advance(1001);await f.backend.memberService.processMail();assert.equal(f.messages.length,before);
 assert.equal((await repo.stats()).mail.expired,1);
});

test('one-click multipart is a stop-only action; bad signature cannot read account or unsubscribe',async t=>{
 const f=await setup(t);await f.verify(await f.sentToken('one-click@example.invalid','subscribe'));
 const [row]=await f.backend.store.members.dueSubscribers('evening',addDays(localDate(f.now()),1));
 const stop=f.backend.memberService.tokenFor(row.id,'unsubscribe');
 const payload='--qa-boundary\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--qa-boundary--\r\n';
 const request={method:'POST',type:'multipart/form-data; boundary=qa-boundary',body:payload,origin:'https://mail-client.invalid'};
 assert.equal((await f.api('/member/one-click?token='+stop.slice(0,-2)+'xx',request)).status,400);
 assert.equal((await f.api('/member/profile',{cookie:'zonlio_member='+stop})).status,401);
 assert.equal((await f.api('/member/one-click?token='+stop,request)).status,204);
 assert.equal((await f.backend.store.members.stats()).subscriptions.unsubscribed,1);
});

test('a confirmed signup fills an existing account planner without replacing its saved tariffs or scenario',async t=>{
 const f=await setup(t);const session=await f.login('existing-profile@example.invalid');
 const saved=cleanEnergyProfile({scenario:{annualUse:3200},contract:{type:'fixed',confirmed:true,importRate:.27}});
 assert.equal((await f.api('/member/profile',{...session,method:'PUT',body:{profile:saved,expectedRevision:0}})).status,200);
 f.advance(121000);
 const token=await f.sentToken('existing-profile@example.invalid','subscribe',{devices:['dishwasher'],startHour:10,endHour:18});
 assert.match(f.messages.at(-1).text,/vaatwasser/);
 assert.equal((await f.verify(token)).status,200);
 const result=(await f.api('/member/profile',session)).body;
 assert.equal(result.subscription.status,'active');assert.deepEqual(result.member.profile.devices,['dishwasher']);
 assert.equal(result.member.profile.startHour,10);assert.equal(result.member.profile.endHour,18);
 assert.deepEqual(result.member.profile.contract,saved.contract);assert.deepEqual(result.member.profile.scenario,saved.scenario);
 assert.equal(result.member.revision,2);
 f.setTime('2026-11-14T17:01:00Z');
 assert.equal((await f.backend.memberService.maintenance()).sent.accepted,1);
});

test('repeating an old stop link also cancels an opt-in pending after an earlier unsubscribe',async t=>{
 const f=await setup(t);await f.verify(await f.sentToken('repeated-stop@example.invalid','subscribe'));
 const repo=f.backend.store.members;const [row]=await repo.dueSubscribers('evening','2026-11-15');
 const stop=f.backend.memberService.tokenFor(row.id,'unsubscribe');
 const unsubscribe=()=>f.api('/member/unsubscribe',{method:'POST',body:{token:stop}});
 assert.equal((await unsubscribe()).status,200);
 f.advance(121000);const pending=await f.sentToken('repeated-stop@example.invalid','subscribe');
 assert.equal((await unsubscribe()).status,200);
 assert.equal((await f.verify(pending)).status,400);
 assert.equal((await repo.get(row.id)).subscription.status,'unsubscribed');
});

test('an expired mail lease cannot deliver or finish a replacement workers claim',async t=>{
 const f=await setup(t);const repo=f.backend.store.members;
 await repo.queueChallenge({purpose:'login',email:'lease@example.invalid',payload:{},tokenFor:f.backend.memberService.tokenFor});
 const [old]=await repo.claimMail(1);assert.ok(await repo.mailContext(old));
 f.advance(90001);assert.equal(await repo.mailContext(old),null);
 const [replacement]=await repo.claimMail(1);assert.equal(replacement.id,old.id);assert.notEqual(replacement.claim_token,old.claim_token);
 await repo.finishMail(old,'accepted');assert.ok(await repo.mailContext(replacement));
 await repo.finishMail(replacement,'accepted');assert.equal((await repo.stats()).mail.accepted,1);
});

test('a delivery stop blocks queued and future messages, remains after account deletion, and exposes no address in stats',async t=>{
 const f=await setup(t);const email='complaint@example.invalid';await f.verify(await f.sentToken(email,'subscribe'));
 f.advance(121000);const session=await f.login(email);const repo=f.backend.store.members;
 const {member}= (await f.api('/member/profile',session)).body;
 f.advance(121000);let issued;
 await repo.queueChallenge({purpose:'login',email,payload:{},tokenFor:(id,purpose)=>{issued=f.backend.memberService.tokenFor(id,purpose);return issued;}});
 const [row]=await repo.dueSubscribers('evening','2026-11-15');
 await repo.queuePlan(row,'2026-11-15',{status:'available',validUntil:new Date(f.now()+3600000).toISOString()});
 const claims=await repo.claimMail();assert.equal(claims.length,2);
 await repo.suppressEmail(email,'complaint');
 for(const item of claims)assert.equal(await repo.mailContext(item),null);
 assert.equal((await f.verify(issued)).status,400);
 assert.equal((await f.api('/member/profile',session)).status,200,'An existing authenticated session retains privacy controls.');
 assert.equal((await repo.get(member.id)).member.deliveryBlocked,true);
 assert.deepEqual(await repo.dueSubscribers('evening','2026-11-16'),[]);
 assert.equal((await repo.suppressionForEmail('COMPLAINT@EXAMPLE.INVALID')).reason,'complaint');
 await repo.deleteMember(member.id);f.advance(121000);
 assert.equal(await repo.queueChallenge({purpose:'login',email,payload:{},tokenFor:f.backend.memberService.tokenFor}),false);
 const stats=await repo.stats();assert.equal(stats.suppressedAddresses,1);assert.equal(stats.verifiedEmails,0);
 assert.doesNotMatch(JSON.stringify(stats),/complaint@example/);
 const before=f.messages.length;assert.equal((await f.api('/member/login',{method:'POST',body:{email}})).status,202);
 assert.equal(f.messages.length,before);
 await assert.rejects(repo.suppressEmail('invalid-reason@example.invalid','made_up'),TypeError);
});

test('a confirmed SMTP nonexistent-address error suppresses even the first login challenge; policy rejections do not',async t=>{
 const f=await setup(t);const repo=f.backend.store.members;
 f.fail({code:'EENVELOPE',response:'550 5.1.1 synthetic mailbox unavailable'});
 await f.api('/member/login',{method:'POST',body:{email:'nonexistent@example.invalid'}});
 for(let i=0;i<100&&!await repo.suppressionForEmail('nonexistent@example.invalid');i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal((await repo.suppressionForEmail('nonexistent@example.invalid')).reason,'hard_bounce');
 assert.equal(f.messages.length,0);
 f.fail({code:'EENVELOPE',response:'550 5.7.1 synthetic temporary policy denial'});
 await f.api('/member/login',{method:'POST',body:{email:'policy@example.invalid'}});
 for(let i=0;i<100&&(await repo.stats()).mail.pending!==1;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(await repo.suppressionForEmail('policy@example.invalid'),null);
 assert.doesNotMatch(JSON.stringify(await repo.stats()),/synthetic mailbox|nonexistent@example/);
});

test('scheduler records actual no-work and source-unavailable status without queuing false daily advice',async t=>{
 const empty=await setup(t);empty.setTime('2026-11-14T17:01:00Z');
 assert.equal((await empty.backend.memberService.maintenance()).schedule.status,'nothing_due');
 assert.equal((await empty.backend.store.members.stats()).scheduler.status,'nothing_due');
 const unavailable=await setup(t,{}, {priceDay:date=>({status:'not_published',date})});
 await unavailable.verify(await unavailable.sentToken('unavailable@example.invalid','subscribe'));
 unavailable.setTime('2026-11-14T17:01:00Z');
 const result=await unavailable.backend.memberService.maintenance();assert.equal(result.schedule.status,'source_unavailable');assert.equal(result.sent.accepted,0);
 assert.equal((await unavailable.backend.store.members.stats()).scheduler.status,'source_unavailable');
 assert.equal(unavailable.messages.filter(m=>m.subject.includes('dagplan ·')).length,0);
});

test('a stopped delivery address cannot reactivate subscription while retaining authenticated privacy access',async t=>{
 const f=await setup(t);await f.verify(await f.sentToken('cannot-resume@example.invalid','subscribe'));f.advance(121000);
 const session=await f.login('cannot-resume@example.invalid');const repo=f.backend.store.members;
 const {member,subscription}=(await f.api('/member/profile',session)).body;
 await repo.suppressEmail(member.email,'owner_request');
 const choice={edition:'morning',status:'active'};
 const result=await f.api('/member/subscription',{...session,method:'PUT',body:{choice,expectedRevision:subscription.revision,consent:true,policyVersion:DAYMAIL_POLICY_VERSION}});
 assert.equal(result.status,422);
 await assert.rejects(repo.setSubscription(member.id,choice,subscription.revision,DAYMAIL_POLICY_VERSION,'QA'),TypeError);
 const exported=await f.api('/member/export',session);assert.equal(exported.status,200);assert.equal(exported.body.deliveryStop.reason,'owner_request');
 assert.equal((await f.api('/member/profile',{...session,method:'DELETE',body:{confirm:'DELETE_MY_ZONLIO'}})).status,200);
});

test('emergency mail pause leaves queued confirmations intact without creating or sending dayplans',async t=>{
 const f=await setup(t,{MAIL_SEND_PAUSED:'true'});const repo=f.backend.store.members;
 assert.equal((await f.api('/member/login',{method:'POST',body:{email:'paused@example.invalid'}})).status,202);
 const result=await f.backend.memberService.maintenance();
 assert.equal(result.sent.enabled,false);assert.equal(result.sent.reason,'paused');assert.equal(result.schedule.status,'paused');
 assert.equal(f.messages.length,0);assert.equal((await repo.stats()).mail.pending,1);
});
