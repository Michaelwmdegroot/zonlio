import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_ID } from '../server/release.mjs';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeMarker = value => typeof value === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(value) ? value : null;
async function boundedText(response, maximum = 65536) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new Error('RESPONSE_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}

/** Fixed GET probes only; never submit a lead, send mail, authenticate or run maintenance. */
export async function observeProduction({ origin = 'https://zonlio.nl', fetchImpl = fetch, expectedRelease = RELEASE_ID, now = Date.now } = {}) {
  const target = new URL(origin);
  if (target.username || target.password || target.pathname !== '/' || target.search || target.hash
    || !(target.origin === 'https://zonlio.nl' || (target.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(target.hostname)))) throw new Error('UNSUPPORTED_OBSERVATION_ORIGIN');
  const probes = [
    ['/api/health', 200, 'json'], ['/api/config', 200, 'json'],
    ['/', 200, 'html'], ['/mijn', 200, 'html'], ['/admin', 200, 'html'],
    ['/privacy', 200, 'html'], ['/contact', 200, 'html'],
    ['/src/design-system.css', 200, 'css'], ['/src/admin-readiness.mjs', 200, 'js'], ['/src/member.mjs', 200, 'js'],
    ['/api/admin/readiness', 401, 'private'], ['/api/member/profile', 401, 'private'],
  ];
  const endpoints = {};
  let health = null;
  let config = null;
  for (const [path, expectedStatus, kind] of probes) {
    try {
      const response = await fetchImpl(target.origin + path, { method:'GET', redirect:'manual', signal:AbortSignal.timeout(12000), headers:{ 'User-Agent':'Zonlio-Deployment-Monitor/1.1', Accept:kind === 'json' ? 'application/json' : '*/*', 'Cache-Control':'no-cache' } });
      const type = (response.headers.get('content-type') || '').toLowerCase();
      const text = await boundedText(response, kind === 'json' ? 65536 : 262144);
      let shapeValid = kind === 'private';
      if (kind === 'json' && type.includes('application/json')) {
        let value;
        try { value = JSON.parse(text); } catch { /* Do not echo unexpected responses. */ }
        shapeValid = isObject(value);
        if (shapeValid && path === '/api/health') {
          health = value;
          shapeValid = value.ok === true && isObject(value.services) && typeof value.releaseId === 'string';
        }
        if (shapeValid && path === '/api/config') {
          config = value;
          shapeValid = typeof value.leadEnabled === 'boolean' && isObject(value.members);
        }
      } else if (kind === 'html') shapeValid = type.includes('text/html') && /<title>[^<]*Zonlio[^<]*<\/title>/i.test(text) && text.includes('/src/design-system.css');
      else if (kind === 'css') shapeValid = type.includes('text/css') && text.includes('--zonlio-blue');
      else if (kind === 'js') shapeValid = /(?:text|application)\/javascript/.test(type) && !/^\s*</.test(text);
      endpoints[path] = { status:response.status, expectedStatus, passed:response.status === expectedStatus && shapeValid };
    } catch (error) {
      endpoints[path] = { passed:false, error:error?.message === 'RESPONSE_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : 'FETCH_FAILED' };
    }
  }
  const booleans = (source, keys) => Object.fromEntries(keys.filter(key => typeof source?.[key] === 'boolean').map(key => [key, source[key]]));
  const services = booleans(health?.services, ['databaseReady','adminConfigured','mailConfigured','leadEnabled','housingAdviceEnabled','operatorConfigured','operatorNameMatches','operatorContactMatches','portalExportEnabled']);
  const members = booleans(config?.members, ['accountsEnabled','subscriptionsEnabled','dailySendEnabled']);
  const releaseMatches = health?.releaseId === expectedRelease;
  return {
    checkedAt:new Date(now()).toISOString(), scope:'Openbare GET-controle; geen login, SMTP, inbox, cron, restore of Portal-ketentest.',
    expectedRelease, observedRelease:safeMarker(health?.releaseId), releaseMatches, endpoints,
    publicChecksPassed:releaseMatches && Object.values(endpoints).every(probe => probe.passed),
    configuration:{ ...services, ...booleans(config, ['operatorConfigured']), ...members },
    productionEndToEndVerified:false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = await observeProduction();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.publicChecksPassed ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ publicChecksPassed:false, error:'OBSERVATION_FAILED', productionEndToEndVerified:false }));
    process.exitCode = 1;
  }
}
