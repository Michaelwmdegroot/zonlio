import { OPERATOR, operatorConfiguration } from './operator.mjs';
import { RELEASE_ID } from './release.mjs';

/** Read-only diagnosis of this running process. Never return raw environment values. */
export function buildReadiness({ env = {}, runtime = {}, now = Date.now, smtpCheck = null, deliveryTest = null, maintenance = null } = {}) {
  const operator = operatorConfiguration(env);
  const production = env.NODE_ENV === 'production';
  const quota = Number(env.SMTP_DAILY_LIMIT || 0);
  const quotaValid = Number.isInteger(quota) && quota > 0 && quota <= 100;
  const cronPresent = typeof env.CRON_SECRET === 'string' && env.CRON_SECRET.length >= 32;
  const cronSeparate = cronPresent && env.CRON_SECRET !== env.SESSION_SECRET;
  let originValid = false;
  let aliasesAgree = true;
  try {
    const url = new URL(env.PUBLIC_URL || env.APP_URL || 'https://zonlio.nl');
    originValid = !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
      && (production ? url.origin === 'https://zonlio.nl' : ['http:', 'https:'].includes(url.protocol));
    if (env.PUBLIC_URL && env.APP_URL) aliasesAgree = new URL(env.PUBLIC_URL).origin === new URL(env.APP_URL).origin;
  } catch { /* Invalid configuration is a failed check, not an exception or echoed value. */ }
  const checks = [];
  const check = (id, label, ok, keys, action, group = 'foundation') => {
    checks.push({ id, label, status: ok ? 'pass' : 'blocked', keys, action: ok ? 'In deze runtime gecontroleerd.' : action, group });
  };
  check('database', 'Database lezen', runtime.databaseReady === true, ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'], 'Controleer de databaseverbinding en rechten. Deze controle leest alleen geaggregeerde gegevens.');
  check('admin', 'Beheer en sessies', runtime.adminConfigured === true, ['ADMIN_PASSWORD_HASH', 'SESSION_SECRET'], 'Controleer de bestaande beheerconfiguratie veilig in hPanel. Deel geen geheimen.');
  check('operator_name', 'Juridische bedrijfsnaam', operator.nameMatches, ['LEAD_CONTROLLER_NAME'], `Gebruik ${OPERATOR.name}. Sla op en herstart of herimplementeer de bestaande app.`);
  check('operator_contact', 'Contactadres voor Zonlio', operator.contactMatches, ['LEAD_CONTROLLER_EMAIL'], `Gebruik ${OPERATOR.email}. Controleer ook dubbele of oude instellingen en herstart de app.`);
  check('origin', 'Website-origin', originValid && aliasesAgree, ['APP_URL', 'PUBLIC_URL'], 'Gebruik https://zonlio.nl. Verwijder een tegenstrijdige PUBLIC_URL-alias of maak beide gelijk.');
  check('operator_confirmation', 'Afzonderlijke activeringsbevestiging', env.LEAD_CONTROLLER_CONFIRMED === 'true', ['LEAD_CONTROLLER_CONFIRMED'], 'Staat bewust uit totdat de operationele controles zijn afgerond. Een juiste bedrijfsnaam is niet dezelfde instelling als deze activeringsbevestiging.');
  check('smtp', 'SMTP-configuratie aanwezig', runtime.mailConfigured === true, ['SMTP_USER', 'SMTP_PASSWORD'], 'Controleer de bestaande SMTP-configuratie. Gebruik daarna Verbinding controleren; dit is nog geen afleverproef.', 'mail');
  check('mail_budget', 'Uitgaand appbudget ingesteld', quotaValid, ['SMTP_DAILY_LIMIT'], 'Gebruik een appbudget van 1–100 binnen de bevestigde mailboxlimiet van 100/24 uur. Houd ruimte vrij voor webmail en andere apps; voorstel 50.', 'mail');
  check('cron', 'Afzonderlijke onderhoudssleutel', cronSeparate, ['CRON_SECRET'], 'Gebruik een eigen sleutel van minimaal 32 tekens, anders dan SESSION_SECRET. Deze controle bewijst niet dat cron draait.', 'maintenance');
  const passed = id => checks.find(item => item.id === id)?.status === 'pass';
  const base = ['database', 'admin', 'operator_name', 'operator_contact', 'origin', 'operator_confirmation'];
  const mailBase = [...base, 'smtp', 'mail_budget'];
  const definitions = [
    ['leads', 'Algemene adviesvragen', 'LEAD_ENABLED', runtime.leadEnabled, base],
    ['housing', 'Woningadvies', 'HOUSING_ADVICE_ENABLED', runtime.housingAdviceEnabled, base],
    ['accounts', 'Mijn Zonlio-accounts', 'MEMBER_ACCOUNTS_ENABLED', runtime.accountsEnabled, mailBase],
    ['signup', 'Dagplan inschrijven', 'DAYMAIL_SIGNUP_ENABLED', runtime.subscriptionsEnabled, mailBase],
    ['sending', 'Dagplannen automatisch versturen', 'DAYMAIL_SEND_ENABLED', runtime.dailySendEnabled, [...mailBase, 'cron']],
    ['portal', 'Overdracht naar NIVO Portal', 'PORTAL_EXPORT_ENABLED', runtime.portalEnabled, base],
  ];
  const features = definitions.map(([id, label, key, effective, dependencies]) => {
    const requested = env[key] === 'true';
    const invalidFlag = env[key] !== undefined && env[key] !== '' && !['true', 'false'].includes(env[key]);
    const blockedBy = dependencies.filter(dependency => !passed(dependency));
    if (invalidFlag) blockedBy.push('flag_value');
    if (id === 'portal' && requested && !(typeof env.PORTAL_EXPORT_TOKEN === 'string' && env.PORTAL_EXPORT_TOKEN.length >= 32)) blockedBy.push('portal_token');
    if (requested && !effective && !blockedBy.length) blockedBy.push('runtime_not_ready');
    return { id, label, key, requested, enabled: effective === true,
      status: invalidFlag || (requested && !effective) ? 'blocked' : effective ? 'enabled' : 'off', blockedBy };
  });
  const operationalChecks = [
    ['delivery', 'Echte inbox- en spamproef', 'Controleer één toegestane aanvraag- en accountmail bij de ontvanger. SMTP-acceptatie is geen inboxbewijs.'],
    ['mail_dns', 'SPF, DKIM, DMARC en afmeldheaders', 'Controleer de werkelijke domeinrecords en ontvangen headers.'],
    ['scheduler', 'Periodieke verwerking', 'Controleer herhaalde uitvoering na een deployment; één handmatige verwerking bewijst geen werkende cron.'],
    ['restore', 'Back-up en afzonderlijke herstelproef', 'Herstel alleen naar een aparte database; overschrijf productie niet.'],
    ['privacy', 'Intrekking, gegevensrechten en bewaarbeleid', 'Doorloop de eigen test en de afgesproken verwerking van gegevensrechten.'],
    ['portal_receipt', 'Ontvangst in NIVO Portal', 'Pas na een echte ontvangsttest vrijgeven; een Zonlio-API is nog geen aangesloten Portal of Odoo.'],
  ].map(([id, label, action]) => ({ id, label, status: 'unverified', action }));
  // Only controlled scalar evidence, never raw provider errors, credentials or task payloads.
  const smtpEvidence = smtpCheck && typeof smtpCheck.ok === 'boolean' && Number.isFinite(Date.parse(smtpCheck.at))
    ? { ok: smtpCheck.ok, at: smtpCheck.at } : null;
  const deliveredTestEvidence = deliveryTest && typeof deliveryTest.accepted === 'boolean' && Number.isFinite(Date.parse(deliveryTest.at))
    ? { accepted: deliveryTest.accepted, at: deliveryTest.at } : null;
  const maintenanceAt = Number.isFinite(Date.parse(maintenance?.at)) ? maintenance.at : null;
  return { releaseId: RELEASE_ID, checkedAt: new Date(now()).toISOString(), environment: production ? 'production' : 'test-or-development',
    scope: 'Configuratie van het draaiende proces en een databaseleesproef. Geen automatische livegang of volledige ketentest.',
    checks, features, operationalChecks, smtpCheck: smtpEvidence, deliveryTest: deliveredTestEvidence, maintenanceAt,
    productionEndToEndVerified: false,
    note: 'Opslaan in hPanel verandert een draaiend proces niet aantoonbaar: controleer na herstart de runtime opnieuw. Bewuste uit-schakelaars zijn geen softwarefout.' };
}
