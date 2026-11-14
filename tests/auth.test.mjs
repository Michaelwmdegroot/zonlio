import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, createRateLimiter, hashPassword, verifyPassword } from '../server/auth.mjs';
import { createStore } from '../server/store.mjs';

const password = 'fixture-password-only-2026';
const passwordHash = await hashPassword(password);
const env = { NODE_ENV: 'production', ADMIN_EMAIL: 'owner@example.invalid', ADMIN_PASSWORD_HASH: passwordHash,
  SESSION_SECRET: 'test-secret-with-at-least-32-characters-abcdef', PUBLIC_URL: 'https://zonlio.test' };

test('scrypt-hash valideert alleen het juiste wachtwoord', async () => {
  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('another-password', passwordHash), false);
  assert.equal(await verifyPassword(password, 'not-a-password-hash'), false);
});

test('formuliertoken weigert wijziging en verstrijken', () => {
  let time = 1000000;
  const auth = createAuth({ env, now: () => time });
  const { token } = auth.issueFormToken();
  assert.equal(auth.verifyFormToken(token), true);
  assert.equal(auth.verifyFormToken(`${token}changed`), false);
  time += 2 * 3600000 + 1;
  assert.equal(auth.verifyFormToken(token), false);
});

test('beheersessie gebruikt beveiligde cookie, CSRF, verloop en intrekking', async (t) => {
  let time = Date.parse('2026-11-14T12:00:00Z');
  const store = await createStore({ env: { NODE_ENV: 'test', SQLITE_PATH: ':memory:' }, now: () => time });
  t.after(() => store.close());
  const auth = createAuth({ env, store, now: () => time });
  const request = { headers: { origin: 'https://zonlio.test', host: 'zonlio.test' }, ip: '127.0.0.1' };
  const login = await auth.login(request, env.ADMIN_EMAIL, password);
  assert.match(login.cookie, /^__Host-zonlio_admin=/);
  assert.match(login.cookie, /HttpOnly/);
  assert.match(login.cookie, /Secure/);
  assert.match(login.cookie, /SameSite=Strict/);
  request.headers.cookie = login.cookie.split(';')[0];
  const session = await auth.session(request);
  assert.equal(session.email, env.ADMIN_EMAIL);
  assert.equal(auth.csrfAllowed(request, session), false);
  request.headers['x-csrf-token'] = session.csrfToken;
  assert.equal(auth.csrfAllowed(request, session), true);
  assert.equal(auth.originAllowed({ headers: { origin: 'https://zonlio.test.attacker.invalid' } }), false);
  await auth.logout(session);
  assert.equal(await auth.session(request), null);
  const second = await auth.login(request, env.ADMIN_EMAIL, password);
  request.headers.cookie = second.cookie.split(';')[0];
  time += 8 * 3600000 + 1;
  assert.equal(await auth.session(request), null);
});

test('ontbrekende configuratie opent geen admin en counters verlopen', () => {
  assert.equal(createAuth({ env: {} }).configured, false);
  let time = 0;
  const rate = createRateLimiter({ now: () => time });
  assert.equal(rate.take('hashed-key', 1, 1000), true);
  assert.equal(rate.take('hashed-key', 1, 1000), false);
  time = 1001;
  assert.equal(rate.take('hashed-key', 1, 1000), true);
});
