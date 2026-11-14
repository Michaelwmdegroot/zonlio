import nodemailer from 'nodemailer';

function errorCode(error) {
  const allowed = ['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'EENVELOPE', 'EMESSAGE'];
  return allowed.includes(error?.code) ? error.code : 'SMTP_ERROR';
}

export function createMail({ env = process.env, store, transport, logger = () => {} } = {}) {
  const password = env.SMTP_PASSWORD || env.SMTP_PASS;
  const configured = Boolean(store && (transport || password));
  const from = env.SMTP_USER || 'info@zonlio.nl';
  const recipient = env.LEAD_NOTIFY_TO || 'info@zonlio.nl';
  const publicUrl = env.PUBLIC_URL || env.APP_URL || 'https://zonlio.nl';
  const port = Number(env.SMTP_PORT || 465);
  const smtp = transport || (configured ? nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.hostinger.com', port, secure: port === 465,
    requireTLS: port !== 465, auth: { user: from, pass: password },
    connectionTimeout: 6000, greetingTimeout: 6000, socketTimeout: 10000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  }) : null);

  function messageFor(lead, item) {
    const customer = item.kind === 'customer_confirmation';
    const subject = customer ? `Je adviesaanvraag bij Zonlio: ${lead.reference}` : `Zonlio adviesaanvraag ${lead.reference}`;
    const text = customer
      ? [`Beste ${lead.name},`, '', `Je adviesaanvraag ${lead.reference} is ontvangen.`,
        `Je hebt ${lead.controller.name} gevraagd om via ${lead.channel === 'phone' ? 'telefoon' : 'e-mail'} te reageren op je vraag over ${lead.topic}.`,
        '', 'Je aanvraag is vrijblijvend. Dit is geen nieuwsbriefinschrijving.',
        `Voor een wijziging of intrekking kun je antwoorden op deze e-mail of mailen naar ${lead.controller.email}.`,
        '', 'Zonlio', publicUrl].join('\n')
      : [`Nieuwe adviesaanvraag ${lead.reference}`, `Ontvangen: ${lead.createdAt}`,
        `Onderwerp: ${lead.topic}`, `Contactkanaal: ${lead.channel}`,
        `Naam: ${lead.name}`, lead.email ? `E-mail: ${lead.email}` : '', lead.phone ? `Telefoon: ${lead.phone}` : '',
        lead.postcode ? `Postcode: ${lead.postcode}` : '', '',
        `Bekijk de aanvraag: ${publicUrl.replace(/\/$/, '')}/admin#lead=${lead.id}`,
        '', `Contactverzoek: ${lead.contactText}`, ''].filter(Boolean).join('\n');
    return {
      from: { name: 'Zonlio', address: from }, to: customer ? lead.email : recipient,
      replyTo: customer ? lead.controller.email : lead.email || from,
      messageId: `<zonlio.${item.id}@zonlio.nl>`, subject, text,
      disableFileAccess: true, disableUrlAccess: true,
    };
  }

  return {
    configured,
    async verify() {
      if (!configured) return { ok: false, configured: false, error: 'E-mailverzending is nog niet geconfigureerd.' };
      try { await smtp.verify(); return { ok: true, configured: true }; }
      catch (error) { return { ok: false, configured: true, error: 'De SMTP-verbinding kon niet worden bevestigd.', code: errorCode(error) }; }
    },
    async processBatch({ limit = 3, retryFailed = false } = {}) {
      if (!configured) return { ok: false, configured: false, processed: 0, sent: 0, failed: 0, pending: store ? (await store.mailStats()).pending : 0 };
      if (retryFailed) await store.retryFailedMail(limit);
      const items = await store.claimOutbox(limit);
      let sent = 0; let failed = 0;
      for (const item of items) {
        try {
          const record = await store.getLead(item.lead_id);
          if (!record) throw new Error('LEAD_UNAVAILABLE');
          const result = await smtp.sendMail(messageFor(record.lead, item));
          if (Array.isArray(result?.rejected) && result.rejected.length) throw Object.assign(new Error('RECIPIENT_REJECTED'), { code: 'EENVELOPE' });
          await store.finishMail(item, { success: true });
          sent += 1;
        } catch (error) {
          const code = errorCode(error);
          await store.finishMail(item, { success: false, errorCode: code });
          logger({ event: 'mail_attempt_failed', code });
          failed += 1;
        }
      }
      return { ok: true, configured: true, processed: items.length, sent, failed, pending: (await store.mailStats()).pending };
    },
    close() { smtp?.close?.(); },
  };
}
