import nodemailer from 'nodemailer';

function errorCode(error) {
  const allowed = ['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'EENVELOPE', 'EMESSAGE'];
  return allowed.includes(error?.code) ? error.code : 'SMTP_ERROR';
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createMail({ env = process.env, store, transport, logger = () => {}, now = () => Date.now() } = {}) {
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
        lead.kind === 'housing' ? 'Type: woningadvies' : 'Type: algemene adviesvraag', '',
        `Bekijk de aanvraag na inloggen: ${publicUrl.replace(/\/$/, '')}/admin#lead=${lead.id}`,
        '', 'Contactgegevens, woningadres en contactbewijs staan uitsluitend in het beveiligde dossier.', ''].filter(Boolean).join('\n');
    return {
      from: { name: 'Zonlio', address: from }, to: customer ? lead.email : recipient,
      replyTo: customer ? lead.controller.email : lead.email || from,
      messageId: `<zonlio.${item.id}@zonlio.nl>`, subject, text,
      html: `<!doctype html><html lang="nl"><meta charset="utf-8"><body style="margin:0;background:#edf3fd;color:#031a37;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;max-width:600px;margin:0 auto;padding:24px"><tr><td style="padding:24px;background:#ffffff;border-radius:20px"><p style="font-size:24px;font-weight:bold;margin-top:0">Zonlio<span style="color:#0765f1">.</span></p><h1 style="font-size:22px">${customer ? 'Je aanvraag is ontvangen.' : 'Een nieuwe adviesvraag.'}</h1>${text.split('\n').map(line => line ? `<p style="line-height:1.6;overflow-wrap:anywhere">${escape(line)}</p>` : '').join('')}<p style="font-size:13px;color:#526585">Jouw stroom. Helder in beeld.</p>${customer ? '' : `<p><a href="${escape(publicUrl.replace(/\/$/, '') + '/admin#lead=' + lead.id)}" style="color:#0765f1">Open het beveiligde dossier</a></p>`}</td></tr></table></body></html>`,
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
      let sent = 0; let failed = 0; let cancelled = 0;
      for (const item of items) {
        try {
          const record = await store.getLead(item.lead_id);
          if (!record) throw new Error('LEAD_UNAVAILABLE');
          // Recheck after claiming: queued work must respect withdrawal and expiry.
          if (!record.lead.contactRequested || record.lead.status === 'withdrawn' || Date.parse(record.lead.contactExpiresAt) <= now()) {
            await store.cancelMail(item); cancelled += 1; continue;
          }
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
      return { ok: true, configured: true, processed: items.length, sent, failed, cancelled, pending: (await store.mailStats()).pending };
    },
    close() { smtp?.close?.(); },
  };
}
