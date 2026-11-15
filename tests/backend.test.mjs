import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { createBackend } from '../server/backend.mjs';
import { hashPassword } from '../server/auth.mjs';

const password = 'backend-fixture-password-2026';
const passwordHash = await hashPassword(password);

async function setup(t, overrides = {}) {
  let time = Date.parse('2026-11-14T12:00:00Z');
  const logs = [];
  const env = { NODE_ENV: 'test', SQLITE_PATH: ':memory:', PUBLIC_URL: 'http://zonlio.test',
    ADMIN_EMAIL: 'owner@example.invalid', ADMIN_PASSWORD_HASH: passwordHash,
    SESSION_SECRET: 'fixture-secret-at-least-32-characters-long', CRON_SECRET: 'fixture-cron-secret-at-least-32-characters', ...overrides.env };
  const backend = await createBackend({ env, now: () => time, logger: (event) => logs.push(event), mailTransport: overrides.mailTransport });
  const app = express();
  app.use(express.json({ limit: '24kb', strict: true }));
  app.use('/api', backend.router);
  const server = await new Promise((resolve, reject) => {
    const candidate = app.listen(0, '127.0.0.1', () => resolve(candidate));
    candidate.once('error', reject);
  }).catch(async (error) => {
    await backend.close();
    if (['EACCES', 'EPERM'].includes(error.code)) { t.skip(`Lokale HTTP-sockets geblokkeerd: ${error.code}`); return null; }
    throw error;
  });
  if (!server) return null;
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    await backend.close();
  });
  async function api(path, { method = 'GET', body, cookie, csrf, authorization, origin = env.PUBLIC_URL } = {}) {
    const headers = { Origin: origin };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    if (csrf) headers['X-CSRF-Token'] = csrf;
    if (authorization) headers.Authorization = authorization;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function application(extra = {}) {
    const form = await api('/form-token');
    return { requestId: randomUUID(), formToken: form.body.token, website: '', name: 'Test Aanvrager',
      channel: 'email', email: 'test@example.invalid', topic: 'battery', contactRequested: true,
      consentVersion: '2026-11-14-v2-nivo', shareScenario: false, sourcePath: '2027', ...extra };
  }
  const login = async () => {
    const result = await api('/admin/login', { method: 'POST', body: { email: env.ADMIN_EMAIL, password } });
    assert.equal(result.status, 200);
    return { cookie: result.cookie, csrf: result.body.csrfToken };
  };
  return { api, application, login, backend, env, logs, advance: (ms) => { time += ms; } };
}

test('aanvraagvalidatie, idempotentie, privacy en beveiligde statuswijziging', async (t) => {
  const fixture = await setup(t);
  if (!fixture) return;
  const { api, application, login, backend, logs } = fixture;
  assert.equal((await api('/admin/leads')).status, 401);
  assert.equal((await api('/admin/stats')).status, 401);
  assert.equal((await api('/admin/session')).body.authenticated, false);
  const invalid = await application({ contactRequested: false });
  assert.equal((await api('/leads', { method: 'POST', body: invalid })).status, 422);
  const addressList = await application({ email: 'another,test@example.invalid' });
  assert.equal((await api('/leads', { method: 'POST', body: addressList })).status, 422);
  const inheritedKey = await application({ shareScenario: true, scenario: { profile: { constructor: 123 } } });
  assert.equal((await api('/leads', { method: 'POST', body: inheritedKey })).status, 422);
  const input = await application();
  const first = await api('/leads', { method: 'POST', body: input });
  assert.equal(first.status, 201);
  const refreshed = await api('/form-token');
  const repeated = await api('/leads', { method: 'POST', body: { ...input, formToken: refreshed.body.token } });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.reference, first.body.reference);
  assert.equal(repeated.body.duplicate, true);
  assert.equal((await api('/leads', { method: 'POST', body: { ...input, name: 'Gewijzigd' } })).status, 409);
  assert.equal((await backend.store.stats(7)).totals.leads, 1);
  assert.equal((await backend.store.mailStats()).pending, 2);
  const session = await login();
  const list = await api('/admin/leads', session);
  assert.equal(list.body.leads.length, 1);
  const id = list.body.leads[0].id;
  const deliveryRecord=(await api(`/admin/leads/${id}`,session)).body;
  assert.deepEqual(deliveryRecord.delivery.map(item=>item.kind).sort(),['customer_confirmation','internal_notification']);
  assert.ok(deliveryRecord.delivery.every(item=>item.status==='pending'&&item.smtpAcceptedAt===null));
  assert.ok(deliveryRecord.delivery.every(item=>!('to' in item)&&!('email' in item)&&!('text' in item)));
  assert.equal((await api(`/admin/leads/${id}`, { method: 'PATCH', body: { status: 'contacted' }, cookie: session.cookie })).status, 403);
  assert.equal((await api(`/admin/leads/${id}`, { ...session, method: 'PATCH', body: { status: 'contacted', note: 'Testopvolging.' } })).status, 200);
  const detail = await api(`/admin/leads/${id}`, session);
  assert.equal(detail.body.lead.status, 'contacted');
  assert.equal(detail.body.history.length, 2);
  assert.equal(detail.body.lead.scenario, null);
  assert.doesNotMatch(JSON.stringify(logs), /Test Aanvrager|test@example.invalid/);
  assert.equal((await api('/admin/logout', { ...session, method: 'POST' })).status, 204);
  assert.equal((await api('/admin/leads', session)).status, 401);
});

test('SMTP-fout verliest geen lead; onderhoud hervat uitsluitend fake-mail', async (t) => {
  let failing = true;
  let verifies = 0;
  const messages = [];
  const transport = {
    async verify() { verifies += 1; },
    async sendMail(message) {
      if (failing) throw Object.assign(new Error('Fake transport failure'), { code: 'ECONNECTION' });
      messages.push(message); return { accepted: [message.to], rejected: [] };
    },
  };
  const fixture = await setup(t, { env:{SMTP_DAILY_LIMIT:'50'}, mailTransport: transport });
  if (!fixture) return;
  const { api, login, application, backend, advance, env } = fixture;
  const session = await login();
  assert.equal((await api('/admin/mail/verify', { ...session, method: 'POST' })).body.ok, true);
  assert.equal(verifies, 1);
  assert.equal(messages.length, 0);
  const response = await api('/leads', { method: 'POST', body: await application() });
  assert.equal(response.status, 201);
  await new Promise(setImmediate);
  assert.equal((await backend.store.stats(7)).totals.leads, 1);
  assert.equal((await backend.store.mailStats()).pending, 2);
  failing = false;
  advance(61000);
  assert.equal((await api('/tasks/maintenance', { method: 'POST' })).status, 401);
  const maintenance = await api('/tasks/maintenance', { method: 'POST', authorization: `Bearer ${env.CRON_SECRET}` });
  assert.equal(maintenance.status, 200);
  assert.equal(maintenance.body.sent, 2);
  assert.equal(messages.length, 2);
  assert.equal((await backend.store.mailStats()).pending, 0);
});

test('statistieken vereisen expliciete toestemming en weigeren vrije persoonsgegevens', async (t) => {
  const fixture = await setup(t);
  if (!fixture) return;
  const { api, login, backend } = fixture;
  const event = { event: 'calculator_complete', sessionId: randomUUID(), path: '2027', consent: true };
  assert.equal((await api('/events', { method: 'POST', body: { ...event, consent: false } })).status, 422);
  assert.equal((await api('/events', { method: 'POST', body: { ...event, email: 'private@example.invalid' } })).status, 422);
  assert.equal((await api('/events', { method: 'POST', body: event })).status, 204);
  assert.equal((await api('/events', { method: 'POST', body: event })).status, 204);
  await backend.recordPageView();
  await backend.recordPageView();
  const stats = await api('/admin/stats?days=7', await login());
  assert.equal(stats.body.totals.pageViews, 2);
  assert.equal(stats.body.totals.consentedSessions, 1);
  assert.equal(stats.body.totals.calculatorCompleted, 1);
});

test('ontbrekende productiedatabase laat de publieke configuratie werken maar geen leads toe', async (t) => {
  const fixture = await setup(t, { env: { NODE_ENV: 'production', DB_NAME: undefined, DB_USER: undefined, DB_PASSWORD: undefined, LEAD_CONTROLLER_CONFIRMED: 'true' } });
  if (!fixture) return;
  const config = await fixture.api('/config');
  assert.equal(config.status, 200);
  assert.equal(config.body.leadEnabled, false);
  assert.equal(config.body.adminConfigured, false);
  assert.equal((await fixture.api('/leads', { method: 'POST', body: {} })).status, 503);
  assert.equal(fixture.backend.health().databaseReady, false);
});


test('woningadvies heeft een afzonderlijke gesloten gate, ook met werkende legacy-intake', async t => {
  const f = await setup(t);
  assert.equal((await f.api('/config')).body.housingAdviceEnabled, false);
  const response = await f.api('/housing-leads', { method: 'POST', body: await f.application() });
  assert.equal(response.status, 503);
  assert.equal((await f.backend.store.stats(7)).totals.leads, 0);
});

test('woningadvies: complete intake, bewijs, ontdubbeling en geen impliciete scenario-overdracht', async t => {
  const f = await setup(t, { env: { HOUSING_ADVICE_ENABLED: 'true', LEAD_CONTROLLER_CONFIRMED: 'true', LEAD_CONTROLLER_NAME: 'NIVO Groep Holland BV' } });
  const config = (await f.api('/config')).body;
  assert.equal(config.housingAdviceEnabled, true);
  const input = await f.application({ channel: 'phone', phone: '06 1234 5678', postcode: '2311 AB',
    housing: { street: 'Teststraat', houseNumber: '12', addition: 'A', city: 'Teststad' },
    contactPreference: 'afternoon', consentVersion: config.housingConsentVersion,
    scenario: { profile: { annualUse: 5000 } } });
  const response = await f.api('/housing-leads', { method: 'POST', body: input });
  assert.equal(response.status, 201);
  const again = await f.api('/housing-leads', { method: 'POST', body: input });
  assert.equal(again.status, 200); assert.equal(again.body.reference, response.body.reference);
  assert.equal((await f.api('/housing-leads', { method: 'POST', body: { ...input, housing: { ...input.housing, houseNumber: '14' } } })).status, 409);
  const session = await f.login();
  const lead = (await f.api('/admin/leads', session)).body.leads[0];
  assert.equal(lead.kind, 'housing'); assert.equal(lead.phone, '+31612345678');
  assert.equal(lead.postcode, '2311AB'); assert.equal(lead.housing.houseNumber, '12');
  assert.equal(lead.contactPreference, 'afternoon'); assert.equal(lead.scenario, null);
  assert.equal(lead.consentVersion, config.housingConsentVersion);
  assert.equal(lead.contactText, config.housingContactText);
  assert.equal(lead.controller.name, 'NIVO Groep Holland BV');
  assert.equal(lead.revision, 0);
  assert.equal((await f.backend.store.mailStats()).pending, 2);
  assert.doesNotMatch(JSON.stringify(f.logs), /Teststraat|12345678|Test Aanvrager/);
});

test('woningadvies weigert ontbrekende NAW/telefoon, verkeerde toestemming en extra marketingvelden', async t => {
  const f = await setup(t, { env: { HOUSING_ADVICE_ENABLED: 'true', LEAD_CONTROLLER_CONFIRMED: 'true', LEAD_CONTROLLER_NAME: 'NIVO Groep Holland BV' } });
  const input = await f.application({ channel: 'phone', phone: '+31612345678', postcode: '2311AB',
    housing: { street: 'Teststraat', houseNumber: '12', city: 'Teststad' }, contactPreference: 'any', consentVersion: '2026-11-14-housing-v2-nivo' });
  for (const change of [{housing:undefined},{postcode:'2311'},{phone:''},{channel:'email'},
    {consentVersion:'2026-11-14-v1'},{marketing:true},{contactRequested:false},{housing:{...input.housing,verified:true}}]) {
    const response = await f.api('/housing-leads', { method: 'POST', body: {...input,...change} });
    assert.equal(response.status, 422, JSON.stringify(change));
  }
  assert.equal((await f.backend.store.stats(7)).totals.leads, 0);
});

test('woningadvies vereist bevestiging en blokkeert afwijkende ontvangerconfiguratie', async t => {
  for (const extra of [{}, {LEAD_CONTROLLER_NAME:'NIVO test'}, {LEAD_CONTROLLER_CONFIRMED:'true',LEAD_CONTROLLER_NAME:'Thuisbatterij Team B.V.'}, {LEAD_CONTROLLER_CONFIRMED:'true',LEAD_CONTROLLER_NAME:'   '}]) {
    const f = await setup(t, {env:{HOUSING_ADVICE_ENABLED:'true',...extra}});
    assert.equal((await f.api('/config')).body.housingAdviceEnabled, false);
  }
});

test('beheeropvolging: CSRF, revisieconflict en intrekking stoppen wachtrij', async t => {
  const f = await setup(t);
  await f.api('/leads',{method:'POST',body:await f.application()});
  const session=await f.login();
  const lead=(await f.api('/admin/leads',session)).body.leads[0];
  const path='/admin/leads/'+lead.id;
  const body={status:'assigned',expectedRevision:0,followUp:{owner:'Team test',nextAction:'Bespreek de hulpvraag',nextActionOn:'2026-11-14'}};
  assert.equal((await f.api(path,{cookie:session.cookie,method:'PATCH',body})).status,403);
  let result=await f.api(path,{...session,method:'PATCH',body});
  assert.equal(result.status,200);assert.equal(result.body.lead.revision,1);
  assert.equal((await f.api(path,{...session,method:'PATCH',body})).status,409);
  const stats=(await f.api('/admin/stats',session)).body;
  assert.equal(stats.workload.due,1);assert.equal(stats.workload.unassigned,0);
  assert.equal(stats.acquisition.find(row=>row.sourcePath==='2027').leads,1);
  result=await f.api(path,{...session,method:'PATCH',body:{status:'withdrawn',expectedRevision:1}});
  assert.equal(result.status,200);assert.equal(result.body.lead.contactRequested,false);
  assert.equal(result.body.lead.followUp.nextActionOn,'');
  assert.equal((await f.backend.store.mailStats()).pending,0);
  assert.equal((await f.backend.store.mailStats()).cancelled,2);
  assert.equal((await f.api(path,{...session,method:'PATCH',body:{status:'new',expectedRevision:2}})).status,409);
});

test('opvolging weigert extra velden, ongeldige datum en actie na contacttermijn', async t => {
  const f=await setup(t);await f.api('/leads',{method:'POST',body:await f.application()});
  const session=await f.login();const lead=(await f.api('/admin/leads',session)).body.leads[0];const path='/admin/leads/'+lead.id;
  for(const body of [{status:'new',newsletter:true},{status:'new',expectedRevision:-1},{status:'new',followUp:{owner:'Test',nextAction:'Bel',nextActionOn:'2026-02-30'}},{status:'new',followUp:{owner:'',nextAction:'Bel',nextActionOn:'2026-11-16'}}]) {
    assert.equal((await f.api(path,{...session,method:'PATCH',body})).status,422);
  }
  assert.equal((await f.api(path,{...session,method:'PATCH',body:{status:'new',followUp:{owner:'Test',nextAction:'Bel',nextActionOn:'2027-01-01'}}})).status,409);
});

test('readiness is admin-only, read-only and distinguishes operator keys without leaking values', async t => {
  const fixture=await setup(t,{env:{LEAD_CONTROLLER_NAME:'old private company',LEAD_CONTROLLER_EMAIL:'private@example.invalid',SMTP_PASSWORD:'smtp-private-value',SMTP_DAILY_LIMIT:'0'}});
  if(!fixture)return;
  assert.equal((await fixture.api('/admin/readiness')).status,401);
  const admin=await fixture.login();
  const report=await fixture.api('/admin/readiness',admin);
  assert.equal(report.status,200);
  assert.equal(report.body.checks.find(c=>c.id==='database').status,'pass');
  assert.equal(report.body.checks.find(c=>c.id==='operator_name').status,'blocked');
  assert.equal(report.body.checks.find(c=>c.id==='operator_contact').status,'blocked');
  assert.equal(report.body.productionEndToEndVerified,false);
  assert.doesNotMatch(JSON.stringify(report.body),/old private company|private@example|smtp-private-value|fixture-secret|fixture-cron/);
  assert.equal((await fixture.api('/config')).body.housingAdviceEnabled,false);
  assert.equal((await fixture.backend.store.stats(7)).totals.leads,0);
  assert.equal((await fixture.backend.store.members.stats()).verifiedEmails,0);
  assert.equal(fixture.backend.health().operatorNameMatches,false);
  assert.equal(fixture.backend.health().operatorContactMatches,false);
});

test('SMTP verification evidence is safe and rate limited; it never sends a test message', async t => {
  let verified=0,sent=0;
  const fixture=await setup(t,{mailTransport:{verify:async()=>{verified++;return true;},sendMail:async()=>{sent++;return {};}}});
  if(!fixture)return;
  const admin=await fixture.login();
  assert.equal((await fixture.api('/admin/mail/verify',{method:'POST',cookie:admin.cookie,body:{}})).status,403);
  const result=await fixture.api('/admin/mail/verify',{...admin,method:'POST',body:{}});
  assert.equal(result.status,200);assert.equal(result.body.ok,true);
  const report=(await fixture.api('/admin/readiness',admin)).body;
  assert.equal(report.smtpCheck.ok,true);assert.equal(report.operationalChecks.find(c=>c.id==='delivery').status,'unverified');
  for(let n=1;n<6;n++)assert.equal((await fixture.api('/admin/mail/verify',{...admin,method:'POST',body:{}})).status,200);
  assert.equal((await fixture.api('/admin/mail/verify',{...admin,method:'POST',body:{}})).status,429);
  assert.equal(verified,6);assert.equal(sent,0);
});

test('echte SMTP-proef is admin-only, CSRF-beveiligd, expliciet en begrensd zonder lead of abonnement', async t => {
  const messages=[];
  const transport={ async sendMail(message) { messages.push(message); return { accepted: [message.to], rejected: [] }; } };
  const f=await setup(t,{env:{SMTP_DAILY_LIMIT:'50',LEAD_CONTROLLER_NAME:'NIVO Groep Holland BV'},mailTransport:transport});
  if(!f)return;
  const body={recipient:'delivery-fixture@example.invalid',confirmed:true};
  assert.equal((await f.api('/admin/mail/test-delivery',{method:'POST',body})).status,401);
  const session=await f.login();
  assert.equal((await f.api('/admin/mail/test-delivery',{method:'POST',body,cookie:session.cookie})).status,403);
  assert.equal((await f.api('/admin/mail/test-delivery',{...session,method:'POST',body:{...body,confirmed:false}})).status,422);
  assert.equal((await f.api('/admin/mail/test-delivery',{...session,method:'POST',body:{...body,recipient:'invalid'}})).status,422);
  assert.equal((await f.api('/admin/mail/test-delivery',{...session,method:'POST',body:{...body,arbitrary:'extra'}})).status,422);
  assert.equal(messages.length,0);
  const accepted=await f.api('/admin/mail/test-delivery',{...session,method:'POST',body});
  assert.equal(accepted.status,200);assert.equal(accepted.body.smtpAccepted,true);
  assert.match(accepted.body.reference,/^[A-F0-9]{8}$/);
  assert.equal(messages.length,1);
  assert.equal(messages[0].to,body.recipient);
  assert.match(messages[0].text,/SMTP|testmail/i);
  assert.equal((await f.api('/admin/stats',session)).body.totals.leads,0);
  assert.equal((await f.backend.store.members.stats()).members,undefined); // No member created by testmail.
  const readiness=(await f.api('/admin/readiness',session)).body;
  assert.equal(readiness.deliveryTest.accepted,true);
  assert.doesNotMatch(JSON.stringify(readiness),/delivery-fixture@example.invalid/);
  assert.doesNotMatch(JSON.stringify(f.logs),/delivery-fixture@example.invalid/);
  assert.equal((await f.api('/admin/mail/test-delivery',{...session,method:'POST',body})).status,200);
  assert.equal((await f.api('/admin/mail/test-delivery',{...session,method:'POST',body})).status,429);
  assert.equal(messages.length,2);
});

test('SMTP-afleverproef weigert ontbrekend budget en verhult verzendfouten', async t => {
  const messages=[];
  const transport={async sendMail(message){ messages.push(message);throw Object.assign(new Error('private SMTP server error'),{code:'ECONNECTION'});} };
  const f=await setup(t,{env:{SMTP_DAILY_LIMIT:'0'},mailTransport:transport});
  if(!f)return;
  const session=await f.login();
  const body={recipient:'owner-fixture@example.invalid',confirmed:true};
  assert.equal((await f.api('/admin/mail/test-delivery',{...session,method:'POST',body})).status,503);
  assert.equal(messages.length,0);
  const failed=await setup(t,{env:{SMTP_DAILY_LIMIT:'10'},mailTransport:transport});
  if(!failed)return;
  const auth=await failed.login();
  const response=await failed.api('/admin/mail/test-delivery',{...auth,method:'POST',body});
  assert.equal(response.status,502);assert.equal(response.body.code,'ECONNECTION');
  assert.doesNotMatch(JSON.stringify(response),/private SMTP|owner-fixture/);
  const readiness=(await failed.api('/admin/readiness',auth)).body;
  assert.equal(readiness.deliveryTest.accepted,false);
  assert.doesNotMatch(JSON.stringify(readiness),/owner-fixture@example.invalid/);
  assert.doesNotMatch(JSON.stringify(failed.logs),/owner-fixture@example.invalid/);
});

test('accounts and housing have independent approval gates while general advice remains closed',async t=>{
  const f=await setup(t,{env:{LEAD_ENABLED:'false',LEAD_CONTROLLER_CONFIRMED:'true',MEMBER_ACCOUNTS_ENABLED:'true',HOUSING_ADVICE_ENABLED:'true',SMTP_DAILY_LIMIT:'50'},mailTransport:{sendMail:async m=>({accepted:[m.to]})}});
  const config=(await f.api('/config')).body;assert.equal(config.leadEnabled,false);assert.equal(config.housingAdviceEnabled,true);assert.equal(config.members.accountsEnabled,true);
  assert.equal((await f.api('/form-token')).status,200);assert.equal((await f.api('/leads',{method:'POST',body:await f.application()})).status,503);
  const onlyAccounts=await setup(t,{env:{LEAD_ENABLED:'false',LEAD_CONTROLLER_CONFIRMED:'true',MEMBER_ACCOUNTS_ENABLED:'true',SMTP_DAILY_LIMIT:'50'},mailTransport:{sendMail:async m=>({accepted:[m.to]})}});
  assert.equal((await onlyAccounts.api('/form-token')).status,503);assert.equal((await onlyAccounts.api('/config')).body.members.accountsEnabled,true);
});

test('privacy endpoints enforce session, CSRF, verified request, correct reference and revision without reviving contact',async t=>{
  const f=await setup(t);await f.api('/leads',{method:'POST',body:await f.application()});
  const auth=await f.login();const lead=(await f.api('/admin/leads',auth)).body.leads[0];const base='/admin/leads/'+lead.id;
  for(const path of [base+'/export','/admin/privacy/recovery','/admin/privacy/retention','/admin/operations'])assert.equal((await f.api(path)).status,401);
  const correction={expectedRevision:0,fields:{name:'Corrected synthetic'},requestVerified:true};
  assert.equal((await f.api(base+'/contact',{cookie:auth.cookie,method:'PATCH',body:correction})).status,403);
  assert.equal((await f.api(base+'/contact',{...auth,method:'PATCH',body:{...correction,requestVerified:false}})).status,422);
  assert.equal((await f.api(base+'/contact',{...auth,method:'PATCH',body:correction})).status,200);
  assert.equal((await f.api(base+'/contact',{...auth,method:'PATCH',body:correction})).status,409);
  const exported=(await f.api(base+'/export',auth)).body;assert.equal(exported.lead.name,'Corrected synthetic');assert.doesNotMatch(JSON.stringify(exported),/payload_hash|claim_token|id_hash/);
  const erase={expectedRevision:1,requestVerified:true,confirm:'ERASE_LEAD_PERSONAL_DATA',reference:'wrong'};
  assert.equal((await f.api(base+'/erase',{...auth,method:'POST',body:erase})).status,422);
  assert.equal((await f.api(base+'/erase',{...auth,method:'POST',body:{...erase,reference:lead.reference}})).status,200);
  assert.equal((await f.api(base,{...auth,method:'PATCH',body:{status:'new',note:'Must not restore',expectedRevision:2}})).status,409);
  const erased=(await f.api(base+'/export',auth)).body;assert.equal(erased.lead.email,'');assert.equal(erased.lead.contact.requested,false);assert.ok(erased.privacy.erasedAt);
  assert.doesNotMatch(JSON.stringify(f.logs),/Corrected synthetic|Test Aanvrager|test@example/);
  assert.equal((await f.api('/admin/privacy/retention',auth)).body.dryRun,true);
});

test('suppression and global mail pause are checked before a delivery test consumes the shared budget',async t=>{
  for(const paused of [false,true]) {
    let sent=0;const f=await setup(t,{env:{SMTP_DAILY_LIMIT:'50',MAIL_SEND_PAUSED:String(paused)},mailTransport:{sendMail:async()=>{sent++;return {accepted:['unused']};}}});
    const auth=await f.login();
    const suppression={email:'test-stop@example.invalid',reason:'complaint',confirmed:true};
    assert.equal((await f.api('/admin/mail/suppress',{cookie:auth.cookie,method:'POST',body:suppression})).status,403);
    assert.equal((await f.api('/admin/mail/suppress',{...auth,method:'POST',body:suppression})).status,200);
    assert.equal((await f.api('/admin/mail/test-delivery',{...auth,method:'POST',body:{recipient:paused?'different@example.invalid':suppression.email,confirmed:true}})).status,409);
    assert.equal(sent,0);assert.equal((await f.backend.store.members.stats()).reservedAttempts24h,0);
  }
});

test('maintenance heartbeat is persistent evidence and refuses to claim success after losing its lease',async t=>{
  const f=await setup(t,{env:{OPS_EXPECT_CRON:'true'}});
  assert.equal((await f.backend.operationalHealth()).cronStatus,'never_run');
  const tick=()=>f.api('/tasks/maintenance',{method:'POST',authorization:`Bearer ${f.env.CRON_SECRET}`});
  assert.equal((await tick()).body.maintenanceCompleted,true);f.advance(300000);assert.equal((await tick()).body.maintenanceCompleted,true);
  assert.equal((await f.backend.store.operations.summary()).successfulTicks24h,2);assert.equal((await f.backend.operationalHealth()).cronStatus,'current');
  f.advance(16*60000);assert.equal((await f.backend.operationalHealth()).cronStatus,'overdue');
  f.backend.store.operations.finishRun=async()=>false;
  const lost=await tick();assert.equal(lost.status,503);assert.equal(lost.body.maintenanceCompleted,false);
});

test('attention queue is private, rejects unknown filters and excludes withdrawn leads',async t=>{
  const f=await setup(t);if(!f)return;
  await f.api('/leads',{method:'POST',body:await f.application()});
  assert.equal((await f.api('/admin/leads?queue=attention')).status,401);
  const session=await f.login();
  assert.equal((await f.api('/admin/leads?queue=invalid',session)).status,422);
  assert.equal((await f.api('/admin/leads?queue=attention&queue=attention',session)).status,422);
  const active=await f.api('/admin/leads?queue=attention&limit=1',session);
  assert.equal(active.status,200);assert.equal(active.body.leads.length,1);
  const id=active.body.leads[0].id;
  assert.equal((await f.api('/admin/leads/'+id,{...session,method:'PATCH',body:{status:'withdrawn',expectedRevision:0}})).status,200);
  assert.equal((await f.api('/admin/leads?queue=attention',session)).body.leads.length,0);
  assert.equal((await f.api('/admin/leads',session)).body.leads.length,1);
});


test('owner acceptance uses live lead pipeline with closed public flags, without marketing or Portal pollution', async t => {
  const messages = [];
  const transport = { sendMail: async message => {
    messages.push(message);return {accepted:[message.to],rejected:[]};
  } };
  const f = await setup(t,{env:{LEAD_ENABLED:'false',HOUSING_ADVICE_ENABLED:'false',
    LEAD_CONTROLLER_CONFIRMED:'true',LEAD_CONTROLLER_NAME:'NIVO Groep Holland BV',
    LEAD_NOTIFY_TO:'owner@example.invalid',SMTP_DAILY_LIMIT:'50'},mailTransport:transport});
  if(!f)return;
  const config=(await f.api('/config')).body;
  assert.equal(config.leadEnabled,false);
  assert.equal(config.housingAdviceEnabled,false);
  assert.equal((await f.api('/form-token')).status,503);
  assert.equal((await f.api('/leads',{method:'POST',body:{}})).status,503);
  const input={kind:'general',confirmed:true,lead:{
    requestId:randomUUID(),name:'Eigenaar Test',channel:'email',
    email:f.env.ADMIN_EMAIL,topic:'battery',message:'Eigen acceptatie',postcode:'2311AB'}};
  assert.equal((await f.api('/admin/acceptance/lead',{method:'POST',body:input})).status,401);
  const session=await f.login();
  assert.equal((await f.api('/admin/acceptance/lead',{cookie:session.cookie,method:'POST',body:input})).status,403);
  assert.equal((await f.api('/admin/acceptance/lead',{...session,method:'POST',body:{...input,confirmed:false}})).status,422);
  assert.equal((await f.api('/admin/acceptance/lead',{...session,method:'POST',body:{
    ...input,lead:{...input.lead,email:'third-party@example.invalid'}}})).status,422);
  assert.equal((await f.api('/admin/acceptance/lead',{...session,method:'POST',body:{
    ...input,lead:{...input.lead,contactRequested:true}}})).status,422);
  const accepted=await f.api('/admin/acceptance/lead',{...session,method:'POST',body:input});
  assert.equal(accepted.status,201);
  assert.equal(accepted.body.acceptanceTest,true);
  assert.equal(accepted.body.publicLeadEnabled,false);
  assert.equal(accepted.body.publicHousingEnabled,false);
  assert.equal(accepted.body.mailPaused,false);
  const again=await f.api('/admin/acceptance/lead',{...session,method:'POST',body:input});
  assert.equal(again.status,200);
  assert.equal(again.body.reference,accepted.body.reference);
  assert.equal(again.body.duplicate,true);
  assert.equal((await f.backend.store.stats(7)).totals.leads,0);
  assert.equal((await f.backend.store.stats(7)).workload.attention,0);
  assert.equal((await f.api('/admin/leads?queue=attention',session)).body.leads.length,0);
  assert.equal((await f.api('/admin/leads',session)).body.leads.length,0);
  const ownerList=await f.api('/admin/leads?queue=acceptance',session);
  assert.equal(ownerList.body.leads.length,1);
  assert.equal(ownerList.body.leads[0].acceptanceTest,true);
  assert.equal(ownerList.body.leads[0].followUp.owner,'Pim');
  assert.equal((await f.backend.store.portalStats()).pending||0,0);
  for(let n=0;n<40&&messages.length<2;n++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(messages.length,2);
  assert.ok(messages.every(message=>message.to===f.env.ADMIN_EMAIL && message.subject.startsWith('[TEST]')));
  assert.match(messages.find(message=>message.subject.includes('Je adviesaanvraag')).text,/eigenaarstest/);
  assert.doesNotMatch(JSON.stringify(f.logs),/Eigenaar Test|owner@example.invalid/);
});


test('private P0 owner acceptance works while commercial controller confirmation and all public gates remain held', async t => {
  const messages = [];
  const f = await setup(t, { env: {
    LEAD_CONTROLLER_NAME: 'NIVO Groep Holland BV', LEAD_CONTROLLER_CONFIRMED: 'false',
    LEAD_ENABLED: 'false', HOUSING_ADVICE_ENABLED: 'false', PORTAL_EXPORT_ENABLED: 'false',
    MAIL_SEND_PAUSED: 'true', SMTP_DAILY_LIMIT: '50',
  }, mailTransport: { sendMail: async message => {
    messages.push(message); return { accepted: [message.to], rejected: [] };
  } } });
  if (!f) return;
  const session = await f.login();
  const input = { kind: 'general', confirmed: true, lead: {
    requestId: randomUUID(), name: 'Private Owner QA', channel: 'email',
    email: f.env.ADMIN_EMAIL, topic: 'battery', postcode: '2311AB', message: 'Synthetic private acceptance',
  } };
  assert.equal((await f.api('/form-token')).status, 503);
  assert.equal((await f.api('/leads', { method: 'POST', body: {} })).status, 503);
  assert.equal((await f.api('/housing-leads', { method: 'POST', body: {} })).status, 503);
  assert.equal((await f.api('/admin/acceptance/lead', { method: 'POST', body: input })).status, 401);
  assert.equal((await f.api('/admin/acceptance/lead', { cookie: session.cookie, method: 'POST', body: input })).status, 403);
  const response = await f.api('/admin/acceptance/lead', { ...session, method: 'POST', body: input });
  assert.equal(response.status, 201, 'Private QA does not depend on the commercial activation flag');
  assert.equal(response.body.mailPaused, true);
  assert.equal(response.body.publicLeadEnabled, false);
  assert.equal(response.body.publicHousingEnabled, false);
  assert.equal((await f.api('/admin/acceptance/lead', { ...session, method: 'POST', body: input })).body.duplicate, true);
  assert.equal((await f.api('/admin/leads?queue=acceptance', session)).body.leads.length, 1);
  assert.equal((await f.backend.store.mailStats()).pending, 2);
  assert.equal((await f.backend.store.portalStats()).pending || 0, 0);
  assert.equal(messages.length, 0, 'The private test never overrides MAIL_SEND_PAUSED');
  assert.equal((await f.api('/admin/readiness', session)).body.checks.find(c => c.id === 'operator_confirmation').status, 'blocked');
});

test('private owner acceptance still rejects a mismatched NIVO receiver even with admin login', async t => {
  const f = await setup(t, { env: {
    LEAD_CONTROLLER_NAME: 'Incorrect third-party business', LEAD_CONTROLLER_CONFIRMED: 'false',
    LEAD_ENABLED: 'false', HOUSING_ADVICE_ENABLED: 'false',
  } });
  if (!f) return;
  const session = await f.login();
  const request = { kind: 'general', confirmed: true, lead: {
    requestId: randomUUID(), name: 'Private QA', channel: 'email',
    email: f.env.ADMIN_EMAIL, topic: 'battery',
  } };
  const denied = await f.api('/admin/acceptance/lead', { ...session, method: 'POST', body: request });
  assert.equal(denied.status, 503);
  assert.equal((await f.api('/admin/leads?queue=acceptance', session)).body.leads.length, 0);
});

test('owner acceptance housing never creates Portal events, even after withdrawal and privacy erasure',async t=>{
  const f=await setup(t,{env:{LEAD_ENABLED:'false',HOUSING_ADVICE_ENABLED:'false',
    LEAD_CONTROLLER_CONFIRMED:'true',LEAD_CONTROLLER_NAME:'NIVO Groep Holland BV',
    MAIL_SEND_PAUSED:'true',SMTP_DAILY_LIMIT:'50'}});
  if(!f)return;
  const session=await f.login();
  const input={kind:'housing',confirmed:true,lead:{
    requestId:randomUUID(),name:'Eigen Woning QA',channel:'phone',
    email:f.env.ADMIN_EMAIL,phone:'0612345678',topic:'battery',
    postcode:'2311AB',contactPreference:'afternoon',
    housing:{street:'Voorbeeldstraat',houseNumber:'12',city:'Leiden'}}};
  const accepted=await f.api('/admin/acceptance/lead',{...session,method:'POST',body:input});
  assert.equal(accepted.status,201);
  assert.equal(accepted.body.mailPaused,true);
  const record=(await f.api('/admin/leads?queue=acceptance',session)).body.leads[0];
  assert.equal(record.kind,'housing');
  assert.equal(record.followUp.owner,'Pim');
  assert.equal((await f.backend.store.mailStats()).pending,2);
  assert.equal((await f.backend.store.portalStats()).pending||0,0);
  const id=record.id;
  const withdrawn=await f.api('/admin/leads/'+id,{...session,method:'PATCH',
    body:{status:'withdrawn',expectedRevision:0}});
  assert.equal(withdrawn.status,200);
  assert.equal((await f.backend.store.mailStats()).pending,0);
  assert.equal((await f.backend.store.portalStats()).pending||0,0);
  const erased=await f.api('/admin/leads/'+id+'/erase',{...session,method:'POST',
    body:{expectedRevision:1,requestVerified:true,confirm:'ERASE_LEAD_PERSONAL_DATA',
      reference:record.reference}});
  assert.equal(erased.status,200);
  assert.equal((await f.backend.store.portalStats()).pending||0,0);
  assert.equal((await f.backend.store.stats(7)).totals.leads,0);
});


test('owner-only member acceptance uses signed magic link without opening public account or daymail gates',async t=>{
  const messages=[];
  const transport={sendMail:async message=>{messages.push(message);return {accepted:[message.to],rejected:[]};}};
  const f=await setup(t,{env:{LEAD_ENABLED:'false',HOUSING_ADVICE_ENABLED:'false',
    MEMBER_ACCOUNTS_ENABLED:'false',DAYMAIL_SIGNUP_ENABLED:'false',DAYMAIL_SEND_ENABLED:'false',
    LEAD_CONTROLLER_CONFIRMED:'true',LEAD_CONTROLLER_NAME:'NIVO Groep Holland BV',
    SMTP_DAILY_LIMIT:'50'},mailTransport:transport});
  if(!f)return;
  assert.equal((await f.api('/member/config')).body.accountsEnabled,false);
  assert.equal((await f.api('/member/config')).body.subscriptionsEnabled,false);
  assert.equal((await f.api('/member/login',{method:'POST',body:{email:f.env.ADMIN_EMAIL}})).status,503);
  assert.equal((await f.api('/member/subscribe',{method:'POST',body:{email:f.env.ADMIN_EMAIL}})).status,503);
  const url='/admin/acceptance/member-login', body={confirmed:true};
  assert.equal((await f.api(url,{method:'POST',body})).status,401);
  const session=await f.login();
  assert.equal((await f.api(url,{cookie:session.cookie,method:'POST',body})).status,403);
  assert.equal((await f.api(url,{...session,method:'POST',body:{confirmed:false}})).status,422);
  assert.equal((await f.api(url,{...session,method:'POST',body:{confirmed:true,email:'third-party@example.invalid'}})).status,422);
  const accepted=await f.api(url,{...session,method:'POST',body});
  assert.equal(accepted.status,202);
  assert.equal(accepted.body.acceptanceTest,true);
  assert.equal(accepted.body.publicAccountsEnabled,false);
  for(let n=0;n<50&&!messages.length;n++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(messages.length,1);
  const msg=messages[0];
  assert.equal(msg.to,f.env.ADMIN_EMAIL);
  assert.ok(msg.subject.startsWith('[TEST]'));
  assert.match(msg.text,/gecontroleerde eigenaarstest/);
  const token=msg.text.match(/#bevestig=([A-Za-z0-9_.-]+)/)?.[1];
  assert.ok(token);
  assert.equal((await f.api('/member/verify',{method:'POST',body:{token:token.slice(0,-2)+'xx'}})).status,400);
  const verified=await f.api('/member/verify',{method:'POST',body:{token}});
  assert.equal(verified.status,200);
  assert.equal(verified.body.purpose,'login');
  assert.ok(verified.cookie);
  assert.equal((await f.api('/member/verify',{method:'POST',body:{token}})).status,400);
  const signedIn=await f.api('/member/session',{cookie:verified.cookie});
  assert.equal(signedIn.body.authenticated,true);
  assert.equal(signedIn.body.email,f.env.ADMIN_EMAIL);
  const profile=await f.api('/member/profile',{cookie:verified.cookie});
  assert.equal(profile.status,200);
  assert.equal(profile.body.member.email,f.env.ADMIN_EMAIL);
  assert.equal((await f.api('/member/config')).body.accountsEnabled,false);
  assert.equal((await f.api('/member/config')).body.dailySendEnabled,false);
  assert.equal((await f.api('/admin/leads',session)).body.leads.length,0);
  assert.equal((await f.backend.store.stats(7)).totals.leads,0);
});

test('owner acceptance login respects global mail pause and never sends pending public challenges',async t=>{
  const messages=[];
  const f=await setup(t,{env:{MEMBER_ACCOUNTS_ENABLED:'false',
    DAYMAIL_SIGNUP_ENABLED:'false',DAYMAIL_SEND_ENABLED:'false',
    LEAD_CONTROLLER_CONFIRMED:'true',LEAD_CONTROLLER_NAME:'NIVO Groep Holland BV',
    MAIL_SEND_PAUSED:'true',SMTP_DAILY_LIMIT:'50'},mailTransport:{
    sendMail:async message=>{messages.push(message);return {accepted:[message.to],rejected:[]};}
  }});
  if(!f)return;
  const session=await f.login();
  const result=await f.api('/admin/acceptance/member-login',{...session,method:'POST',body:{confirmed:true}});
  assert.equal(result.status,202);
  assert.equal(result.body.mailPaused,true);
  assert.equal(messages.length,0);
  assert.equal((await f.backend.memberService.repository.stats()).mail.pending,1);
  const task=await f.backend.memberService.processMail();
  assert.equal(task.enabled,false);
  assert.equal(messages.length,0);
  assert.equal((await f.api('/member/login',{method:'POST',body:{email:'random@example.invalid'}})).status,503);
});


test('owner login acceptance never drains a public member challenge while public services are closed',async t=>{
  const messages=[];
  const f=await setup(t,{env:{MEMBER_ACCOUNTS_ENABLED:'false',DAYMAIL_SIGNUP_ENABLED:'false',
    DAYMAIL_SEND_ENABLED:'false',LEAD_CONTROLLER_CONFIRMED:'true',
    LEAD_CONTROLLER_NAME:'NIVO Groep Holland BV',SMTP_DAILY_LIMIT:'50'},
    mailTransport:{sendMail:async m=>{messages.push(m);return {accepted:[m.to],rejected:[]};}}});
  if(!f)return;
  const service=f.backend.memberService,repo=service.repository;
  const injected=await repo.queueChallenge({purpose:'login',email:'unrelated@example.invalid',
    payload:{},tokenFor:service.tokenFor});
  assert.equal(injected,true);
  const session=await f.login();
  assert.equal((await f.api('/admin/acceptance/member-login',
    {...session,method:'POST',body:{confirmed:true}})).status,202);
  for(let i=0;i<50&&messages.length<1;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(messages.length,1);
  assert.equal(messages[0].to,f.env.ADMIN_EMAIL);
  const after=await repo.stats();
  assert.equal(after.mail.pending,1,'unrelated pending mail stays queued, not cancelled and not delivered');
  assert.equal(after.mail.accepted,1);
  const batch=await service.processMail();
  assert.equal(batch.accepted,0);
  assert.equal(messages.length,1);
  assert.equal((await repo.stats()).mail.pending,1);
});
