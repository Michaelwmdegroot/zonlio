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
