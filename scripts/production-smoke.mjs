import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_ID } from '../server/release.mjs';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeMarker = value => typeof value === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(value) ? value : null;
// These are deployed HTML documents, so a successful SPA fallback is insufficient.
const landingPages = {
  '/kennis': { headline:'Begrijp je stroom. Maak je eigen keuzes.', section:'Jouw uitkomst komt eerst', tool:'/' },
  '/stroomprijzen': { headline:'Stroomprijzen vandaag en morgen begrijpen', section:'Per uur of per kwartier?', tool:'/#overzicht' },
  '/slim-stroomverbruik': { headline:'Slim stroomverbruik plannen dat past bij jouw dag', section:'Kies eerst je grenzen', tool:'/#planner' },
  '/zonnepanelen-2027': { headline:'Zonnepanelen in 2027: bereken je eigen scenario', section:'Een variabel saldo is geen volledige jaarrekening', tool:'/#2027' },
  '/terugleveren': { headline:'Terugleververgoeding en terugleverkosten uit elkaar houden', section:'Hoe rekent jouw leverancier?', tool:'/#2027' },
  '/thuisbatterij-berekenen': { headline:'Thuisbatterij berekenen: wat voegt opslag echt toe?', section:'Eerst direct verbruiken, daarna opslaan', tool:'/#batterij' },
};
const htmlText = value => value.replace(/<!--[\s\S]*?-->|<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const attribute = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(value => value !== undefined);
function landingEvidence(html, path) {
  const expected = landingPages[path];
  const head = /<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i.exec(html)?.[1] || '';
  const main = /<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/i.exec(html)?.[1] || '';
  const canonicals = [...head.matchAll(/<link\b[^>]*>/gi)].filter(([tag]) => (attribute(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical'));
  const headings = [...main.matchAll(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi)].map(([, value]) => htmlText(value));
  const sections = [...main.matchAll(/<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/gi)].map(([, value]) => htmlText(value));
  const paragraphs = [...main.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map(([, value]) => htmlText(value)).join(' ');
  return {
    canonicalMatches:canonicals.length === 1 && attribute(canonicals[0][0], 'href') === `https://zonlio.nl${path}`,
    staticContentPresent:headings.length === 1 && headings[0] === expected.headline && sections.includes(expected.section)
      && paragraphs.length >= 160 && [...main.matchAll(/<a\b[^>]*>/gi)].some(([tag]) => attribute(tag, 'href') === expected.tool),
  };
}
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
    ...Object.keys(landingPages).map(path => [path, 200, 'html']),
    ['/src/design-system.css', 200, 'css'], ['/src/admin-readiness.mjs', 200, 'js'], ['/src/admin.mjs', 200, 'workbench-js'], ['/src/member.mjs', 200, 'js'],
    ['/api/admin/readiness', 401, 'private'], ['/api/member/profile', 401, 'private'],
    ['/api/admin/operations', 401, 'private'], ['/api/admin/privacy/retention', 401, 'private'], ['/api/admin/privacy/recovery', 401, 'private'],
  ];
  const endpoints = {};
  let health = null;
  let config = null;
  for (const [path, expectedStatus, kind] of probes) {
    try {
      const expectsJson = kind === 'json' || kind === 'private';
      const response = await fetchImpl(target.origin + path, { method:'GET', redirect:'manual', signal:AbortSignal.timeout(12000), headers:{ 'User-Agent':'Zonlio-Deployment-Monitor/1.1', Accept:expectsJson ? 'application/json' : '*/*', 'Cache-Control':'no-cache' } });
      const type = (response.headers.get('content-type') || '').toLowerCase();
      const text = await boundedText(response, expectsJson ? 65536 : 262144);
      let shapeValid = false;
      let evidence = {};
      if (expectsJson && type.includes('application/json')) {
        let value;
        try { value = JSON.parse(text); } catch { /* Do not echo unexpected responses. */ }
        shapeValid = isObject(value);
        if (kind === 'private') shapeValid = shapeValid && typeof value.error === 'string' && Object.keys(value).length === 1;
        if (shapeValid && path === '/api/health') {
          health = value;
          shapeValid = value.ok === true && isObject(value.services) && typeof value.releaseId === 'string';
        }
        if (shapeValid && path === '/api/config') {
          config = value;
          shapeValid = typeof value.leadEnabled === 'boolean' && isObject(value.members);
        }
      } else if (kind === 'html') {
        shapeValid = type.includes('text/html') && /<title>[^<]*Zonlio[^<]*<\/title>/i.test(text) && text.includes('/src/design-system.css');
        if (landingPages[path]) { evidence = landingEvidence(text, path); shapeValid = shapeValid && evidence.canonicalMatches && evidence.staticContentPresent; }
      }
      else if (kind === 'css') shapeValid = type.includes('text/css') && text.includes('--zonlio-blue');
      else if (kind === 'workbench-js') { evidence = { workbenchPresent:text.includes('lead-queue-filter') && text.includes('focus-attention') && text.includes('state.queue') }; shapeValid = /(?:text|application)\/javascript/.test(type) && !/^\s*</.test(text) && evidence.workbenchPresent; }
      else if (kind === 'js') shapeValid = /(?:text|application)\/javascript/.test(type) && !/^\s*</.test(text);
      endpoints[path] = { status:response.status, expectedStatus, passed:response.status === expectedStatus && shapeValid, ...evidence };
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
