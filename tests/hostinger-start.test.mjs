import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { request } from 'node:http';

const entry = pathToFileURL(fileURLToPath(new URL('../server.mjs', import.meta.url))).href;

test('Hostinger importing server.mjs in production calls listen before initialization', { timeout: 12000 }, async (t) => {
  // Hostinger imports the ESM entry as a module, so process.argv[1] does NOT
  // contain our entry filename. A direct-entry-only guard must not block startup.
  const child = spawn(process.execPath, [
    '--input-type=module', '-e', `await import(${JSON.stringify(entry)})`
  ], {
    env: {
      PATH: process.env.PATH || '',
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0',
      // Production intentionally lacks MySQL credentials in this test.
      // That must disable lead intake, not prevent the public server starting.
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const exit = new Promise((resolve) => child.once('exit', resolve));
  t.after(async () => {
    child.kill('SIGTERM');
    await exit;
  });
  let stdout = '';
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not open within the Hostinger 3-second window.')), 2900);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error(`Server exited before listen: ${stderr.slice(0, 300)}`)); });
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (!stdout.includes('Zonlio 1.0.0 luistert op poort ')) return;
      const match = /luistert op poort (\d+)/.exec(stdout);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
  });
  const status = await new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: '/api/health' }, (res) => {
      const parts = [];
      res.on('data', (part) => parts.push(part));
      res.once('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(parts).toString()) }));
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(status.status, 200);
  assert.equal(status.data.services.databaseReady, false);
  assert.equal(status.data.services.leadEnabled, false);
});
