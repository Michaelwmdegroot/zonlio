import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { OPERATOR, operatorConfiguration } from './operator.mjs';
import { CLOSED_STATUSES } from '../src/advice-schema.mjs';

export const PORTAL_SCHEMA = 'zonlio.portal.advice.v1';
export const PORTAL_EVENT_TYPES = Object.freeze([
  'advice.upsert', 'advice.withdrawn', 'advice.closed', 'advice.contact_expired', 'advice.erased',
]);
const hash = value => createHash('sha256').update(String(value)).digest();
const same = (a, b) => timingSafeEqual(hash(a), hash(b));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Serialize the current record, never a historical payload with obsolete contact rights. */
export function portalEvent(event, lead, observedAt) {
  if (!lead || lead.acceptanceTest || lead.kind !== 'housing' || lead.controller.name !== OPERATOR.name) return null;
  const active = Boolean(!lead.erasedAt && lead.contactRequested && !CLOSED_STATUSES.includes(lead.status)
    && Date.parse(lead.contactExpiresAt) > observedAt);
  return {
    id: event.id,
    claimToken: event.claim_token,
    leaseExpiresAt: event.locked_until,
    schema: PORTAL_SCHEMA,
    source: 'zonlio',
    type: lead.erasedAt ? 'advice.erased' : lead.status === 'withdrawn' ? 'advice.withdrawn'
      : CLOSED_STATUSES.includes(lead.status) ? 'advice.closed'
        : active ? 'advice.upsert' : 'advice.contact_expired',
    status: lead.status,
    requestId: lead.id,
    reference: lead.reference,
    revision: lead.revision,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    observedAt: new Date(observedAt).toISOString(),
    ...(lead.erasedAt ? { erasedAt: lead.erasedAt } : {}),
    controller: lead.controller,
    assignmentHint: lead.followUp.owner || 'Pim',
    contact: {
      requested: active,
      expiresAt: lead.contactExpiresAt,
      version: lead.consentVersion,
      text: lead.contactText,
    },
    ...(active ? {
      person: { name: lead.name, phone: lead.phone, email: lead.email },
      housing: lead.housing ? { ...lead.housing, postcode: lead.postcode } : null,
      topic: lead.topic,
      message: lead.message,
      sourcePath: lead.sourcePath,
      scenario: lead.shareScenario ? lead.scenario : null,
      contactPreference: lead.contactPreference,
    } : {}),
  };
}

/** Pull/ack contract for NIVO Portal. No direct Odoo access and no outbound URL. */
export function createPortalRouter({ env, store, auth, now = () => Date.now() }) {
  const router = express.Router();
  const enabled = Boolean(store && operatorConfiguration(env).confirmed
    && env.PORTAL_EXPORT_ENABLED === 'true'
    && typeof env.PORTAL_EXPORT_TOKEN === 'string' && env.PORTAL_EXPORT_TOKEN.length >= 32);
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!enabled) return res.status(503).json({ error: 'Portal-uitwisseling is niet geactiveerd.' });
    if (!same(req.headers.authorization || '', `Bearer ${env.PORTAL_EXPORT_TOKEN}`)) {
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }
    if (!auth.limiter.take(`portal:${auth.requestKey(req)}`, 60, 60000)) {
      return res.status(429).json({ error: 'Probeer later opnieuw.' });
    }
    if (!req.is('application/json')) return res.status(415).json({ error: 'Gebruik JSON.' });
    next();
  });
  router.post('/claim', async (req, res) => {
    const body = req.body;
    const limit = isObject(body) && Object.hasOwn(body, 'limit') ? body.limit : 5;
    if (!isObject(body) || !Number.isInteger(limit) || limit < 1 || limit > 10
      || Object.keys(body).some(key => key !== 'limit')) {
      return res.status(422).json({ error: 'Ongeldige batch.' });
    }
    // A previously accepted request still needs a new stop revision when its contact window ends.
    await store.expireContactRequests({ limit: 100 });
    const events = [];
    for (const claimed of await store.claimPortalEvents(limit)) {
      const record = await store.getLead(claimed.lead_id);
      const event = portalEvent(claimed, record?.lead, now());
      if (event) events.push(event);
    }
    res.json({
      events,
      note: 'Bevestig pas na duurzame opslag in NIVO Portal. Odoo-synchronisatie hoort bij de Portal, niet bij Zonlio.',
    });
  });
  router.post('/ack', async (req, res) => {
    const body = req.body;
    if (!isObject(body) || Object.keys(body).some(key => !['id', 'claimToken', 'portalReference'].includes(key))
      || typeof body.id !== 'string' || !UUID.test(body.id)
      || typeof body.claimToken !== 'string' || !UUID.test(body.claimToken)
      || typeof body.portalReference !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(body.portalReference)) {
      return res.status(422).json({ error: 'Ongeldige ontvangstbevestiging.' });
    }
    const accepted = await store.ackPortalEvent(body);
    res.status(accepted ? 200 : 409).json({
      ok: accepted,
      ...(!accepted ? { error: 'Reservering verlopen of onbekend. Vraag de batch opnieuw op.' } : {}),
    });
  });
  return { router, enabled };
}
