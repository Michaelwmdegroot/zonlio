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
      consentVersion: '2026-11-14-v1', shareScenario: false, sourcePath: '2027', ...extra };
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
  const fixture = await setup(t, { mailTransport: transport });
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
  const f = await setup(t, { env: { HOUSING_ADVICE_ENABLED: 'true', LEAD_CONTROLLER_CONFIRMED: 'true', LEAD_CONTROLLER_NAME: 'NIVO testontvanger' } });
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
  assert.equal(lead.controller.name, 'NIVO testontvanger');
  assert.equal(lead.revision, 0);
  assert.equal((await f.backend.store.mailStats()).pending, 2);
  assert.doesNotMatch(JSON.stringify(f.logs), /Teststraat|12345678|Test Aanvrager/);
});

test('woningadvies weigert ontbrekende NAW/telefoon, verkeerde toestemming en extra marketingvelden', async t => {
  const f = await setup(t, { env: { HOUSING_ADVICE_ENABLED: 'true', LEAD_CONTROLLER_CONFIRMED: 'true', LEAD_CONTROLLER_NAME: 'NIVO testontvanger' } });
  const input = await f.application({ channel: 'phone', phone: '+31612345678', postcode: '2311AB',
    housing: { street: 'Teststraat', houseNumber: '12', city: 'Teststad' }, contactPreference: 'any', consentVersion: '2026-11-14-housing-v1' });
  for (const change of [{housing:undefined},{postcode:'2311'},{phone:''},{channel:'email'},
    {consentVersion:'2026-11-14-v1'},{marketing:true},{contactRequested:false},{housing:{...input.housing,verified:true}}]) {
    const response = await f.api('/housing-leads', { method: 'POST', body: {...input,...change} });
    assert.equal(response.status, 422, JSON.stringify(change));
  }
  assert.equal((await f.backend.store.stats(7)).totals.leads, 0);
});

test('woningadvies verlangt expliciete controller en bevestiging naast de eigen flag', async t => {
  for (const extra of [{}, {LEAD_CONTROLLER_NAME:'NIVO test'}, {LEAD_CONTROLLER_CONFIRMED:'true'}, {LEAD_CONTROLLER_CONFIRMED:'true',LEAD_CONTROLLER_NAME:'   '}]) {
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
