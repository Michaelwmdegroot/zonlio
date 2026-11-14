import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from '../server/backend.mjs';

test('production logs a safe database diagnostic without exposing secrets', async () => {
  const messages = [];
  const previous = console.error;
  console.error = (...args) => { messages.push(args.join(' ')); };
  let backend;
  try {
    backend = await createBackend({ env: {
      NODE_ENV: 'production', DB_HOST: '127.0.0.1',
      DB_NAME: 'secret_database_name', DB_USER: 'secret_database_user',
      DB_PASSWORD: '', SESSION_SECRET: 'fixture-only-32-character-secret-123456',
      ADMIN_PASSWORD_HASH: 'not-valid', LEAD_CONTROLLER_CONFIRMED: 'false'
    } });
  } finally {
    console.error = previous;
    await backend?.close();
  }
  assert.equal(backend.ready, false);
  const diagnostic = messages.find(message => message.includes('ZONLIO_DATABASE_UNAVAILABLE'));
  assert.ok(diagnostic);
  assert.match(diagnostic, /DATABASE_CONFIGURATION_DB_PASSWORD/);
  assert.match(diagnostic, /missingKeys/);
  assert.doesNotMatch(diagnostic, /secret_database_name|secret_database_user|fixture-only/);
});
