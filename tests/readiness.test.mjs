import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadiness } from '../server/readiness.mjs';
import { operatorConfiguration, OPERATOR } from '../server/operator.mjs';
import { readinessMarkup } from '../src/admin-readiness.mjs';

const env = { NODE_ENV:'production', APP_URL:'https://zonlio.nl', LEAD_CONTROLLER_NAME:OPERATOR.name, LEAD_CONTROLLER_EMAIL:OPERATOR.email,
  LEAD_CONTROLLER_CONFIRMED:'true', SMTP_DAILY_LIMIT:'40', CRON_SECRET:'readiness-fixture-cron-secret-32-chars', SESSION_SECRET:'readiness-fixture-session-secret-32-chars' };
const runtime = { databaseReady:true, adminConfigured:true, mailConfigured:true };
const check = (report, id) => report.checks.find(item => item.id === id);

test('readiness distinguishes correct company data from explicit confirmation and disabled features', () => {
  const report = buildReadiness({ env:{ ...env, LEAD_CONTROLLER_CONFIRMED:'false' }, runtime });
  assert.equal(check(report,'operator_name').status,'pass');
  assert.equal(check(report,'operator_contact').status,'pass');
  assert.equal(check(report,'operator_confirmation').status,'blocked');
  assert.ok(report.features.every(feature => feature.status === 'off'));
  assert.equal(report.productionEndToEndVerified,false);
  assert.ok(report.operationalChecks.every(check => check.status === 'unverified'));
});

test('name and contact mismatches are separate diagnoses without raw environment disclosure', () => {
  const report = buildReadiness({ env:{ ...env, LEAD_CONTROLLER_NAME:'Private old company', LEAD_CONTROLLER_EMAIL:'private-old@example.invalid', DB_PASSWORD:'not-for-output', PORTAL_EXPORT_TOKEN:'not-for-output' }, runtime });
  assert.equal(check(report,'operator_name').status,'blocked');
  assert.equal(check(report,'operator_contact').status,'blocked');
  assert.doesNotMatch(JSON.stringify(report),/Private old company|private-old@example|not-for-output|readiness-fixture-/);
  assert.equal(operatorConfiguration({LEAD_CONTROLLER_NAME:' NIVO Groep Holland B.V. ',LEAD_CONTROLLER_EMAIL:' INFO@ZONLIO.NL '}).matches,true);
});

test('requested accounts with absent quota remain blocked, with a useful reason', () => {
  const report = buildReadiness({ env:{ ...env, MEMBER_ACCOUNTS_ENABLED:'true', SMTP_DAILY_LIMIT:'0' }, runtime });
  const feature = report.features.find(feature => feature.id === 'accounts');
  assert.equal(feature.status,'blocked');assert.ok(feature.blockedBy.includes('mail_budget'));
  for (const value of ['-1','NaN','100001','1.5']) assert.equal(check(buildReadiness({env:{...env,SMTP_DAILY_LIMIT:value},runtime}),'mail_budget').status,'blocked');
});

test('conflicting origin aliases and reused cron secret are diagnosed, not echoed', () => {
  const report = buildReadiness({ env:{ ...env, PUBLIC_URL:'https://other.example.invalid', CRON_SECRET:env.SESSION_SECRET }, runtime });
  assert.equal(check(report,'origin').status,'blocked');assert.equal(check(report,'cron').status,'blocked');
  assert.doesNotMatch(JSON.stringify(report),/other.example.invalid|readiness-fixture-session/);
});

test('bad flag values never appear as effective activation; runtime booleans are authoritative', () => {
  const report = buildReadiness({env:{...env,MEMBER_ACCOUNTS_ENABLED:'True'},runtime});
  assert.equal(report.features.find(item=>item.id==='accounts').status,'blocked');
  const active = buildReadiness({env:{...env,MEMBER_ACCOUNTS_ENABLED:'true'},runtime:{...runtime,accountsEnabled:true}});
  assert.equal(active.features.find(item=>item.id==='accounts').status,'enabled');
  assert.equal(active.productionEndToEndVerified,false);
});

test('SMTP evidence is limited to a result and date, never represented as delivery', () => {
  const report = buildReadiness({env,runtime,smtpCheck:{ok:true,at:'2026-11-14T16:00:00Z',error:'private diagnostic'},maintenance:{at:'2026-11-14T16:01:00Z',secret:'private diagnostic'}});
  assert.deepEqual(report.smtpCheck,{ok:true,at:'2026-11-14T16:00:00Z'});
  assert.equal(report.maintenanceAt,'2026-11-14T16:01:00Z');assert.equal(report.operationalChecks[0].status,'unverified');
  assert.doesNotMatch(JSON.stringify(report),/private diagnostic/);
});

test('admin readiness view is escaped, labels missing checks and has no activation form', () => {
  const report = buildReadiness({env,runtime});
  report.checks[0].action='<img src=x onerror=alert(1)>';
  const html=readinessMarkup(report,{open:true});
  assert.match(html,/&lt;img/);assert.doesNotMatch(html, /<img|LEAD_CONTROLLER_CONFIRMED=|data-admin-action=\"enable/);
  assert.match(html,/admin-testmail-form/);
  assert.match(html,/Geen bewijs van inboxbezorging|geen volledige productietest/);
  assert.match(readinessMarkup(null,{error:true}),/geen groene status/);
});
