import express from 'express';
import { domainToASCII } from 'node:url';
import { createStore, StoreConflict, LeadUpdateConflict } from './store.mjs';
import { HOUSING_CONSENT_VERSION, LEAD_STATUS_LABELS, housingFieldErrors, followUpFieldErrors } from '../src/advice-schema.mjs';
import { createAuth, sha256 } from './auth.mjs';
import { createMail } from './mail.mjs';

export const CONSENT_VERSION = '2026-11-14-v1';
const PATHS = ['overzicht', 'planner', '2027', 'batterij'];
const TOPICS = ['battery', 'solar', 'contract', 'charging', 'heatpump', 'other'];
const STATUSES = Object.keys(LEAD_STATUS_LABELS);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE = {
  annualUse: [0, 100000], annualSolar: [0, 100000], selfUsePct: [0, 100], targetPct: [0, 100],
  importRate: [-10, 10], exportRate: [-10, 10], exportFee: [0, 10], investment: [0, 250000],
  extraSolarStored: [0, 100000], roundTripEfficiency: [0.01, 1], annualCosts: [0, 50000], lifeYears: [1, 50],
};
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
function text(value, max, { required = false, multiline = false } = {}) {
  if (value === undefined || value === null) return required ? null : '';
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (clean.length > max || (required && !clean) || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(clean)) return null;
  return clean;
}
function emailAddress(value) {
  const clean = text(value, 254);
  if (clean === '') return '';
  if (clean === null || clean.split('@').length !== 2) return null;
  const at = clean.lastIndexOf('@');
  const local = clean.slice(0, at);
  const domain = domainToASCII(clean.slice(at + 1)).toLowerCase();
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || !domain.includes('.') || `${local}@${domain}`.length > 254
    || domain.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return `${local}@${domain}`;
}
function phoneNumber(value) {
  const clean = text(value, 40);
  if (clean === '') return '';
  if (clean === null || !/^[+\d\s().-]+$/.test(clean)) return null;
  let normalized = clean.replace(/[\s().-]/g, '');
  if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;
  else if (normalized.startsWith('0')) normalized = `+31${normalized.slice(1)}`;
  return /^\+?[1-9]\d{6,14}$/.test(normalized) ? normalized : null;
}

function validateLead(body, { auth, controller, contactTexts, housing = false }) {
  const errors = {};
  if (!isObject(body)) return { errors: { form: 'Vul het aanvraagformulier in.' } };
  const allowed = new Set(['requestId', 'formToken', 'website', 'name', 'channel', 'email', 'phone', 'postcode',
    'topic', 'message', 'contactRequested', 'consentVersion', 'shareScenario', 'scenario', 'sourcePath',
    ...(housing ? ['housing', 'contactPreference'] : [])]);
  if (Object.keys(body).some((key) => !allowed.has(key))) errors.form = 'Het formulier bevat niet-ondersteunde velden.';
  if (!UUID.test(body.requestId || '')) errors.requestId = 'Start een nieuwe aanvraag.';
  if (!auth.verifyFormToken(body.formToken)) errors.formToken = 'Het formulier is verlopen. Open het opnieuw en probeer het nog eens.';
  if (body.website !== '' && body.website !== undefined) errors.website = 'Laat het extra websiteveld leeg.';
  const name = text(body.name, 120, { required: true });
  if (!name || name.length < 2) errors.name = 'Vul je naam in (2–120 tekens).';
  if (!['email', 'phone'].includes(body.channel)) errors.channel = 'Kies e-mail of telefonisch contact.';
  const email = emailAddress(body.email);
  const phone = phoneNumber(body.phone);
  if (email === null || (body.channel === 'email' && !email)) errors.email = 'Vul een geldig e-mailadres in.';
  if (phone === null || (body.channel === 'phone' && !phone)) errors.phone = 'Vul een geldig telefoonnummer in.';
  const rawPostcode = text(body.postcode, 10);
  const postcode = rawPostcode?.replace(/\s/g, '').toUpperCase();
  if (rawPostcode === null || (postcode && !/^[1-9]\d{3}(?:[A-Z]{2})?$/.test(postcode))) errors.postcode = 'Vul vier cijfers of een volledige Nederlandse postcode in.';
  if (!TOPICS.includes(body.topic)) errors.topic = 'Kies het onderwerp van je aanvraag.';
  const message = text(body.message, 2000, { multiline: true });
  if (message === null) errors.message = 'Gebruik maximaal 2000 tekens voor je vraag.';
  if (body.contactRequested !== true) errors.contactRequested = 'Bevestig dat je persoonlijk advies aanvraagt.';
  if (body.consentVersion !== (housing ? HOUSING_CONSENT_VERSION : CONSENT_VERSION)) errors.consentVersion = 'Het formulier is bijgewerkt. Open het opnieuw.';
  if (typeof body.shareScenario !== 'boolean') errors.shareScenario = 'Kies of je deze berekening wilt delen.';
  if (!PATHS.includes(body.sourcePath)) errors.sourcePath = 'Start de aanvraag vanuit een Zonlio-berekening.';
  if (housing) {
    Object.assign(errors, housingFieldErrors(body));
    if (body.channel !== 'phone') errors.channel = 'Woningadvies bevat een door jou gevraagd telefoongesprek.';
  }
  let scenario = null;
  if (body.shareScenario) {
    if (!isObject(body.scenario) || Object.keys(body.scenario).some((key) => key !== 'profile')
      || !isObject(body.scenario.profile) || !Object.keys(body.scenario.profile).length) {
      errors.scenario = 'De gedeelde berekening is ongeldig.';
    } else {
      const profile = {};
      for (const key of Object.keys(body.scenario.profile).sort()) {
        const value = body.scenario.profile[key];
        const bounds = Object.hasOwn(PROFILE, key) ? PROFILE[key] : null;
        if (!bounds || typeof value !== 'number' || !Number.isFinite(value) || value < bounds[0] || value > bounds[1]) errors.scenario = 'De gedeelde berekening bevat een ongeldige waarde.';
        else profile[key] = value;
      }
      scenario = { profile };
    }
  }
  return {
    errors,
    value: { requestId: body.requestId?.toLowerCase(), name, channel: body.channel, email, phone, postcode: postcode || '',
      topic: body.topic, message, shareScenario: body.shareScenario, scenario, sourcePath: body.sourcePath,
      consentVersion: housing ? HOUSING_CONSENT_VERSION : CONSENT_VERSION, contactText: contactTexts[body.channel], controller,
      ...(housing && !Object.keys(errors).length ? { intake: { kind: 'housing',
        address: Object.fromEntries(['street', 'houseNumber', 'addition', 'city'].map(key => [key, (body.housing[key] || '').trim()])),
        contactPreference: body.contactPreference } } : {}) },
  };
}

/** All routes are relative to /api. The parent app installs its bounded JSON parser. */
export async function createBackend({ env = process.env, now = () => Date.now(), logger, mailTransport } = {}) {
  const log = typeof logger === 'function' ? logger : () => {};
  let store = null;
  try { store = await createStore({ env, now }); }
  catch (error) {
    // Do not expose SQL, host/user/password, stack or driver message in public health.
    // Hostinger's Runtime Logs will contain only a safe error code and missing key names.
    const configMatch = /^DATABASE_CONFIGURATION_(DB_NAME|DB_USER|DB_PASSWORD)$/.exec(error?.message || '');
    const safeDriverCodes = new Set([
      'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH',
      'ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR',
      'ER_TABLEACCESS_DENIED_ERROR', 'ER_PARSE_ERROR', 'PROTOCOL_CONNECTION_LOST',
      'ER_NOT_SUPPORTED_AUTH_MODE', 'ER_CON_COUNT_ERROR', 'ER_TOO_MANY_USER_CONNECTIONS'
    ]);
    const code = configMatch ? error.message : safeDriverCodes.has(error?.code) ? error.code : 'OTHER_DATABASE_ERROR';
    const missingKeys = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
      .filter(key => typeof env[key] !== 'string' || !env[key].trim());
    if (env.NODE_ENV === 'production') {
      console.error('ZONLIO_DATABASE_UNAVAILABLE', JSON.stringify({ code, missingKeys }));
    }
    log({ event: 'database_unavailable' });
  }
  const auth = createAuth({ env, store, now });
  const mail = createMail({ env, store, transport: mailTransport, logger: log, now });
  const router = express.Router();
  const jobs = new Set();
  const configuredController = text(env.LEAD_CONTROLLER_NAME, 200);
  const controller = { name: configuredController || 'Thuisbatterij Team B.V.', email: env.LEAD_CONTROLLER_EMAIL || 'info@zonlio.nl' };
  const contactTexts = Object.fromEntries(['email', 'phone'].map((channel) => [channel,
    `Met deze aanvraag vraag je ${controller.name} om binnen 30 dagen ${channel === 'phone' ? 'telefonisch' : 'per e-mail'} te reageren over het gekozen onderwerp. Zonlio gebruikt daarvoor je ingevulde contactgegevens en, als je dat kiest, je berekening. Je kunt je aanvraag intrekken via ${controller.email}. Dit is geen nieuwsbriefinschrijving.`]));
  const enabled = Boolean(store && (!auth.production || (env.LEAD_CONTROLLER_CONFIRMED === 'true' && auth.configured)));
  // A separate, explicit gate: deployment or design approval never enables the new intake.
  const housingAdviceEnabled = enabled && env.HOUSING_ADVICE_ENABLED === 'true'
    && env.LEAD_CONTROLLER_CONFIRMED === 'true' && Boolean(configuredController);
  const housingContactText = `Ik vraag ${controller.name} om binnen 30 dagen telefonisch te reageren over mijn gekozen woningvraag. Hiervoor worden mijn contactgegevens en woningadres gebruikt en alleen als ik dat kies mijn rekenprofiel. Mijn voorkeursmoment is geen bevestigde afspraak. Ik kan mijn verzoek intrekken via ${controller.email}. Dit is geen nieuwsbriefinschrijving of toestemming voor algemene marketing.`;
  const analyticsEnabled = Boolean(store && env.ANALYTICS_ENABLED !== 'false' && (!auth.production || auth.secretConfigured));
  const disabledReason = !store ? 'Aanvragen kunnen tijdelijk niet worden opgeslagen. Probeer het later opnieuw.'
    : !enabled ? 'Het contactformulier is nog niet geactiveerd. Je kunt contact opnemen via info@zonlio.nl.' : null;

  function backgroundMail() {
    if (!mail.configured) return;
    const job = mail.processBatch({ limit: 2 }).catch(() => log({ event: 'mail_batch_failed' }));
    jobs.add(job);
    job.finally(() => jobs.delete(job));
  }
  function origin(request, response, next) {
    if (!auth.originAllowed(request)) return response.status(403).json({ error: 'Dit verzoek komt niet van de Zonlio-website.' });
    if (!request.is('application/json')) return response.status(415).json({ error: 'Gebruik een JSON-verzoek.' });
    next();
  }
  async function administrator(request, response, next) {
    const session = await auth.session(request);
    if (!session) return response.status(401).json({ error: 'Log in om het beheer te openen.' });
    request.adminSession = session;
    next();
  }
  function csrf(request, response, next) {
    if (!auth.csrfAllowed(request, request.adminSession)) return response.status(403).json({ error: 'Bevestig je beheersessie opnieuw.' });
    next();
  }
  const mailStatus = async () => ({ configured: mail.configured, ...(store ? await store.mailStats() : { pending: 0, failed: 0, sent: 0, lastSuccessAt: null }) });

  router.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/config', (_request, response) => response.json({ version: env.APP_VERSION || '0.2.0', leadEnabled: enabled,
    disabledReason, controller, consentVersion: CONSENT_VERSION, contactTexts, analyticsEnabled, adminConfigured: auth.configured,
    housingAdviceEnabled, housingConsentVersion: HOUSING_CONSENT_VERSION, housingContactText }));
  router.get('/form-token', (request, response) => {
    if (!enabled) return response.status(503).json({ error: disabledReason });
    if (!auth.limiter.take(`form:${auth.requestKey(request)}`, 120, 10 * 60000)) return response.status(429).json({ error: 'Probeer het over enkele minuten opnieuw.' });
    response.json(auth.issueFormToken());
  });

  router.post('/leads', origin, async (request, response) => {
    if (!enabled) return response.status(503).json({ error: disabledReason });
    if (!auth.limiter.take(`lead:${auth.requestKey(request)}`, 10, 10 * 60000)) return response.status(429).json({ error: 'Er zijn te veel pogingen. Probeer het later opnieuw.' });
    const { value, errors } = validateLead(request.body, { auth, controller, contactTexts });
    if (Object.keys(errors).length) return response.status(422).json({ error: 'Controleer de gemarkeerde velden.', fieldErrors: errors });
    const saved = await store.createLead(value, sha256(JSON.stringify(value)));
    response.status(saved.duplicate ? 200 : 201).json({ ok: true, reference: saved.lead.reference, notification: 'queued', duplicate: saved.duplicate });
    if (!saved.duplicate) backgroundMail();
  });

  router.post('/housing-leads', origin, async (request, response) => {
    if (!housingAdviceEnabled) return response.status(503).json({ error: 'Woningadvies is nog niet vrijgegeven. Er is niets verzonden.' });
    if (!auth.limiter.take(`lead:${auth.requestKey(request)}`, 10, 10 * 60000)) return response.status(429).json({ error: 'Er zijn te veel pogingen. Probeer het later opnieuw.' });
    const { value, errors } = validateLead(request.body, { auth, controller, housing: true,
      contactTexts: { phone: housingContactText } });
    if (Object.keys(errors).length) return response.status(422).json({ error: 'Controleer de gemarkeerde velden.', fieldErrors: errors });
    const saved = await store.createLead(value, sha256(JSON.stringify(value)));
    response.status(saved.duplicate ? 200 : 201).json({ ok: true, reference: saved.lead.reference, notification: 'queued', duplicate: saved.duplicate });
    if (!saved.duplicate) backgroundMail();
  });

  router.post('/events', origin, async (request, response) => {
    if (!analyticsEnabled) return response.status(503).json({ error: 'Statistieken zijn niet beschikbaar.' });
    const body = request.body;
    if (!isObject(body) || Object.keys(body).some((key) => !['event', 'sessionId', 'consent', 'path'].includes(key))
      || !['page_view', 'calculator_complete', 'advice_open'].includes(body.event)
      || !UUID.test(body.sessionId || '') || body.consent !== true || !PATHS.includes(body.path)) {
      return response.status(422).json({ error: 'Ongeldige statistiekgebeurtenis.' });
    }
    if (!auth.limiter.take(`event:${auth.requestKey(request)}`, 240, 10 * 60000)) return response.status(429).json({ error: 'Te veel gebeurtenissen.' });
    await store.recordEvent({ event: body.event, path: body.path, sessionHash: sha256(auth.fingerprint('analytics', body.sessionId.toLowerCase())) });
    response.status(204).end();
  });

  router.get('/admin/session', async (request, response) => {
    const session = await auth.session(request);
    response.json(session ? { authenticated: true, email: session.email, csrfToken: session.csrfToken } : { authenticated: false });
  });
  router.post('/admin/login', origin, async (request, response) => {
    const result = await auth.login(request, request.body?.email, request.body?.password);
    if (result.error) return response.status(result.status).json({ error: result.error });
    response.setHeader('Set-Cookie', result.cookie);
    response.json(result.session);
  });
  router.post('/admin/logout', administrator, csrf, async (request, response) => {
    response.setHeader('Set-Cookie', await auth.logout(request.adminSession));
    response.status(204).end();
  });
  router.get('/admin/stats', administrator, async (request, response) => {
    const days = Number(request.query.days || 30);
    if (![7, 30, 90].includes(days)) return response.status(422).json({ error: 'Kies 7, 30 of 90 dagen.' });
    response.json({ ...await store.stats(days), mail: await mailStatus() });
  });
  router.get('/admin/leads', administrator, async (request, response) => {
    const { status, cursor } = request.query;
    const limit = Number(request.query.limit || 30);
    if ((status && !STATUSES.includes(status)) || (cursor && !UUID.test(cursor)) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return response.status(422).json({ error: 'Ongeldig filter of paginanummer.' });
    }
    response.json(await store.listLeads({ status, cursor, limit }));
  });
  router.get('/admin/leads/:id', administrator, async (request, response) => {
    if (!UUID.test(request.params.id)) return response.status(404).json({ error: 'Aanvraag niet gevonden.' });
    const record = await store.getLead(request.params.id);
    if (!record) return response.status(404).json({ error: 'Aanvraag niet gevonden.' });
    response.json(record);
  });
  router.patch('/admin/leads/:id', administrator, csrf, async (request, response) => {
    const fields = request.body;
    if (!isObject(fields) || Object.keys(fields).some(key => !['status', 'note', 'followUp', 'expectedRevision'].includes(key))) return response.status(422).json({ error: 'Ongeldige opvolgvelden.' });
    if (fields.followUp !== undefined) {
      const errors = followUpFieldErrors(fields.followUp);
      if (Object.keys(errors).length) return response.status(422).json({ error: 'Controleer de opvolggegevens.', fieldErrors: errors });
    }
    if (fields.expectedRevision !== undefined && (!Number.isSafeInteger(fields.expectedRevision) || fields.expectedRevision < 0)) return response.status(422).json({ error: 'Ongeldige dossierversie.' });
    const note = text(request.body?.note, 1000, { multiline: true });
    if (!UUID.test(request.params.id) || !STATUSES.includes(request.body?.status) || note === null) {
      return response.status(422).json({ error: 'Kies een geldige status en een notitie van maximaal 1000 tekens.' });
    }
    const lead = await store.updateLead(request.params.id, { status: request.body.status, note, actor: request.adminSession.email,
      followUp: fields.followUp, expectedRevision: fields.expectedRevision });
    if (!lead) return response.status(404).json({ error: 'Aanvraag niet gevonden.' });
    response.json({ ok: true, lead });
  });
  router.post('/admin/mail/verify', administrator, csrf, async (_request, response) => response.json(await mail.verify()));
  router.post('/admin/mail/retry', administrator, csrf, async (request, response) => {
    if (!auth.limiter.take(`mail:${request.adminSession.email}`, 6, 60000)) return response.status(429).json({ error: 'Wacht even voor een volgende verzendpoging.' });
    if (!mail.configured) return response.status(503).json({ error: 'E-mailverzending is nog niet geconfigureerd.', configured: false });
    response.json(await mail.processBatch({ limit: 3, retryFailed: true }));
  });

  router.post('/tasks/maintenance', async (request, response) => {
    if (!auth.cronAllowed(request)) return response.status(401).json({ error: 'Niet geautoriseerd.' });
    if (!store) return response.status(503).json({ error: 'Database niet beschikbaar.' });
    if (!auth.limiter.take('maintenance', 6, 60000)) return response.status(429).json({ error: 'Wacht even voor een volgende taak.' });
    response.json({ ...await mail.processBatch({ limit: 3 }), mail: await mailStatus() });
  });

  router.use((error, _request, response, _next) => {
    if (error instanceof LeadUpdateConflict) return response.status(409).json({ error: error.message });
    if (error instanceof StoreConflict || error.code === 'IDEMPOTENCY_CONFLICT') return response.status(409).json({ error: 'Deze aanvraagcode hoort bij andere gegevens. Start een nieuwe aanvraag.' });
    log({ event: 'backend_operation_failed' });
    response.status(503).json({ error: 'Dit verzoek kon niet worden verwerkt. Probeer het opnieuw.' });
  });

  return {
    router, store, controller: Object.freeze({ ...controller }), ready: Boolean(store),
    health: () => ({ databaseReady: Boolean(store), adminConfigured: auth.configured, mailConfigured: mail.configured, leadEnabled: enabled, housingAdviceEnabled }),
    async recordPageView(path = 'overzicht') {
      if (!store || !PATHS.includes(path)) return;
      try { await store.recordPageView(path); } catch { log({ event: 'page_count_failed' }); }
    },
    async close() { await Promise.allSettled([...jobs]); mail.close(); auth.limiter.clear(); await store?.close(); },
  };
}
