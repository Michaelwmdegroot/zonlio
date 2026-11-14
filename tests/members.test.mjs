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
async function setup(t,overrides={}){
 let time=Date.parse('2026-11-14T12:00:00Z');const messages=[],logs=[];let upstream=0;let fail=false;
 const env={NODE_ENV:'test',SQLITE_PATH:':memory:',PUBLIC_URL:'http://zonlio.test',ADMIN_EMAIL:'qa@example.invalid',ADMIN_PASSWORD_HASH:passwordHash,SESSION_SECRET:'qa-long-session-secret-at-least-32-characters',CRON_SECRET:'qa-cron-secret-at-least-32-characters',LEAD_CONTROLLER_NAME:OPERATOR.name,LEAD_CONTROLLER_CONFIRMED:'true',MEMBER_ACCOUNTS_ENABLED:'true',DAYMAIL_SIGNUP_ENABLED:'true',DAYMAIL_SEND_ENABLED:'true',SMTP_DAILY_LIMIT:'100',PORTAL_EXPORT_ENABLED:'true',PORTAL_EXPORT_TOKEN:'qa-portal-secret-at-least-32-characters',HOUSING_ADVICE_ENABLED:'true',...overrides};
 const transport={verify:async()=>true,sendMail:async message=>{if(fail)throw Object.assign(new Error('private smtp diagnostic'),{code:'ECONNECTION'});messages.push(message);return {accepted:[message.to],rejected:[]};}};
 const backend=await createBackend({env,now:()=>time,mailTransport:transport,logger:event=>logs.push(event),market:{getDay:async date=>{upstream++;return priceDay(date);}}});
 const app=express();app.use(express.json());app.use('/api',backend.router);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 t.after(async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await backend.close();});
 async function api(path,{method='GET',body,cookie,csrf,authorization,origin=env.PUBLIC_URL,type='application/json'}={}){
  const res=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':type}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(authorization?{Authorization:authorization}:{})},body:body===undefined?undefined:type==='application/json'?JSON.stringify(body):body});
  const text=await res.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:res.status,body:data,cookie:res.headers.get('set-cookie')?.split(';')[0]};
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
 const v=await f.verify(token);assert.equal(v.status,200);assert.match(v.cookie,/zonlio_member=/);assert.equal((await f.verify(token)).status,400);
 f.advance(121000);const expired=await f.sentToken('late@example.invalid');f.advance(16*60000);assert.equal((await f.verify(expired)).status,400);
 const bad=await f.api('/member/login',{method:'POST',body:{email:'member@example.invalid'},origin:'https://evil.invalid'});assert.equal(bad.status,403);
 assert.equal((await f.api('/member/profile')).status,401);
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
 assert.equal((await f.api('/member/profile',{...s,method:'DELETE',body:{confirm:'wrong'}})).status,422);
 assert.equal((await f.api('/member/profile',{...s,method:'DELETE',body:{confirm:'DELETE_MY_ZONLIO'}})).status,200);
 assert.equal((await f.api('/member/profile',s)).status,401);assert.equal((await f.backend.store.members.stats()).verifiedEmails,0);
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
