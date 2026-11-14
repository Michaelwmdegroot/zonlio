const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const stamp = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('nl-NL', { timeZone:'Europe/Amsterdam', dateStyle:'short', timeStyle:'short' }).format(new Date(value)) : 'Nog niet gecontroleerd';
/** Presentation only: every state comes from the authenticated running backend. */
export function readinessMarkup(data, { open = false, loading = false, error = false } = {}) {
  const issueCount = data?.checks?.filter(check => check.status !== 'pass').length ?? 0;
  const state = error ? 'Controle niet beschikbaar' : loading ? 'Runtime controleren…' : data ? `${issueCount} configuratiepunt${issueCount === 1 ? '' : 'en'} met aandacht` : 'Nog niet gecontroleerd';
  return `<section class="panel admin-panel readiness-panel" aria-label="Testen en activering"><details id="testen" ${open ? 'open' : ''}>
    <summary><span><strong>Testen & activering</strong><small>${esc(state)}</small></span><span class="badge">${esc(data?.releaseId || 'Configuratie')}</span></summary>
    <div class="readiness-content"><p>Deze controle leest de draaiende app. Zij activeert niets en bewijst geen volledige productietest.</p>
    ${error ? '<p class="form-message error" role="alert">De controle kon niet worden geladen. Er wordt geen groene status aangenomen.</p>' : ''}
    ${data ? `<p class="admin-mini">Gecontroleerd: ${stamp(data.checkedAt)} · ${esc(data.environment)}</p>
    <h3>1. Configuratie</h3><div class="readiness-checks">${data.checks.map(check => `<article class="readiness-item"><div><strong>${esc(check.label)}</strong><span class="health-badge ${check.status === 'pass' ? 'good' : 'warn'}">${check.status === 'pass' ? 'Correct' : 'Aandacht'}</span></div><p>${esc(check.action)}</p><code>${esc(check.keys.join(' · '))}</code></article>`).join('')}</div>
    <h3>2. Afzonderlijke functieschakelaars</h3><p class="admin-mini">Een juiste bedrijfsnaam zet deze functies niet vanzelf aan. Zet dagelijkse verzending en Portal pas aan na hun afzonderlijke proef.</p>
    <div class="readiness-features">${data.features.map(feature => `<div class="readiness-item"><div><strong>${esc(feature.label)}</strong><span class="health-badge ${feature.enabled ? 'good' : feature.status === 'blocked' ? 'warn' : ''}">${feature.enabled ? 'Actief in runtime' : feature.status === 'blocked' ? 'Geblokkeerd' : 'Uitgeschakeld'}</span></div><code>${esc(feature.key)}</code><p>${feature.requested && !feature.enabled ? 'Aangevraagd, maar voorwaarden zijn nog niet compleet.' : !feature.requested ? 'Bewust uit; geen automatische activering.' : 'De technische schakelaar staat aan. Controleer de echte gebruikersroute.'}</p></div>`).join('')}</div>
    <h3>3. Werkelijke testbewijzen</h3><div class="readiness-evidence"><p><strong>SMTP-verbinding:</strong> ${data.smtpCheck ? `${data.smtpCheck.ok ? 'Verbinding geslaagd' : 'Verbinding niet geslaagd'} · ${stamp(data.smtpCheck.at)}. Geen bewijs van inboxbezorging.` : 'Nog niet gecontroleerd sinds de start van dit proces.'}</p><p><strong>Laatste echte SMTP-testmail:</strong> ${data.deliveryTest ? `${data.deliveryTest.accepted ? 'Door SMTP geaccepteerd' : 'Niet door SMTP bevestigd'} · ${stamp(data.deliveryTest.at)}. Inbox/spam nog zelf controleren.` : 'Nog niet verstuurd vanuit dit proces.'}</p><p><strong>Laatste onderhoudsregistratie:</strong> ${stamp(data.maintenanceAt)}. Eén registratie bewijst geen periodieke uitvoering.</p></div>
    <ul class="readiness-manual">${data.operationalChecks.map(check => `<li><strong>${esc(check.label)}</strong><span>Nog afzonderlijk te bevestigen</span><p>${esc(check.action)}</p></li>`).join('')}</ul>
    <p class="admin-mini">${esc(data.note)}</p>` : ''}
    <div class="readiness-actions"><button class="button button-secondary" data-admin-action="refresh" ${loading ? 'disabled' : ''}>Controle verversen</button><button class="button button-secondary" data-admin-action="verify-mail">SMTP-verbinding testen</button><a class="button button-secondary" href="/mijn" target="_blank" rel="noopener">Open Mijn Zonlio</a><a class="button button-secondary" href="/#2027" target="_blank" rel="noopener">Open woningadviesroute</a></div>
    <form id="admin-testmail-form" class="admin-testmail" aria-labelledby="testmail-title">
      <h4 id="testmail-title">Echte testmail naar je eigen inbox</h4>
      <p>Verstuurt uitsluitend na jouw klik één bericht via de Zonlio-app. Er wordt geen lead of dagplan aangemaakt. Dit gebruikt één bericht uit het ingestelde appbudget.</p>
      <div class="field"><label for="testmail-address">Test-e-mailadres</label><input id="testmail-address" name="recipient" type="email" autocomplete="email" maxlength="254" placeholder="jouw-testadres@voorbeeld.nl" required></div>
      <label class="testmail-confirm"><input name="confirmed" type="checkbox" required> Ik beheer dit adres en wil nu één testmail ontvangen.</label>
      <button type="submit" class="button button-primary">Verstuur één testmail</button>
      <p class="admin-mini" id="testmail-result" role="status" aria-live="polite">Na SMTP-acceptatie controleer je zelf je inbox en spammap.</p>
    </form>
    <p class="admin-mini">Gebruik alleen het toegestane eigenaarstestdossier. De SMTP-knop verstuurt geen bericht. Deel nooit wachtwoorden, tokens of volledige klantdossiers in screenshots.</p></div>
  </details></section>`;
}
