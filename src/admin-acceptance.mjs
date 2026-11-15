// Only rendered after an authenticated admin session. Never a public intake form.
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function acceptanceMarkup({ email, result } = {}) {
  const status = result?.reference ? `<div class="form-message" role="status">
    <strong>${result.duplicate ? 'Bestaande test teruggevonden' : 'Eigenaarstest opgeslagen'}:</strong>
    ${esc(result.reference)}. ${result.mailPaused
      ? 'De mailpauze is actief; bevestig geen inboxontvangst totdat de wachtrij werkelijk is verwerkt.'
      : 'De notificaties staan in de werkelijke mailwachtrij; SMTP-acceptatie en inbox moeten nog afzonderlijk worden gecontroleerd.'}
    <button class="button button-secondary" type="button" data-open-lead="${esc(result.id)}">Open privé testdossier</button>
  </div>` : '';
  return `<section class="panel admin-panel" id="acceptatietest">
    <div class="panel-head"><div><h2>Productieacceptatie · eigen test</h2>
    <p>Test veilig de echte MySQL-opslag, Pim-registratie en twee soorten aanvraagmail zonder bezoekersformulieren te openen.</p></div>
    <span class="badge">Alleen beheer</span></div>
    <p class="admin-mini">Uitsluitend jouw eigen beheeradres. Testdossiers worden buiten consumentenstatistieken, gewone saleswerkvoorraad en Portal-export gehouden. Hoogstens drie aanvragen per 24 uur.</p>
    <details><summary>Maak één gecontroleerde eigen testaanvraag</summary>
      <form id="admin-acceptance-form" autocomplete="on">
        <div class="field"><label for="acceptance-kind">Wat wil je testen?</label>
        <select id="acceptance-kind" name="kind"><option value="general">Algemene NIVO-adviesvraag</option><option value="housing">NIVO-woningadvies met telefoon</option></select></div>
        <div class="field"><label for="acceptance-name">Jouw naam</label>
        <input id="acceptance-name" name="name" maxlength="120" required autocomplete="name"></div>
        <div class="field"><label for="acceptance-email">Bevestiging naar je eigen beheeradres</label>
        <input id="acceptance-email" name="email" type="email" readonly required value="${esc(email)}"></div>
        <div class="field"><label for="acceptance-topic">Onderwerp</label><select id="acceptance-topic" name="topic">
        <option value="battery">Thuisbatterij</option><option value="solar">Zonnepanelen</option>
        <option value="charging">Laadvoorziening</option><option value="heatpump">Verwarming</option>
        <option value="other">Andere vraag</option></select></div>
        <div class="field"><label for="acceptance-postcode">Postcode (bij woningadvies verplicht)</label>
        <input id="acceptance-postcode" name="postcode" maxlength="10" autocomplete="postal-code" placeholder="1234 AB"></div>
        <div data-acceptance-housing hidden>
          <div class="field"><label for="acceptance-phone">Jouw telefoonnummer</label>
          <input id="acceptance-phone" name="phone" type="tel" maxlength="40" autocomplete="tel"></div>
          <div class="field"><label for="acceptance-street">Straatnaam</label>
          <input id="acceptance-street" name="street" maxlength="120" autocomplete="address-line1"></div>
          <div class="field"><label for="acceptance-number">Huisnummer</label>
          <input id="acceptance-number" name="houseNumber" maxlength="5" inputmode="numeric"></div>
          <div class="field"><label for="acceptance-addition">Toevoeging (optioneel)</label>
          <input id="acceptance-addition" name="addition" maxlength="20"></div>
          <div class="field"><label for="acceptance-city">Woonplaats</label>
          <input id="acceptance-city" name="city" maxlength="100" autocomplete="address-level2"></div>
          <div class="field"><label for="acceptance-preference">Voorkeur</label><select id="acceptance-preference" name="contactPreference">
          <option value="any">Geen voorkeur</option><option value="morning">Ochtend</option>
          <option value="afternoon">Middag</option><option value="evening">Avond</option></select></div>
        </div>
        <div class="field"><label for="acceptance-message">Korte eigen testvraag (optioneel)</label>
        <textarea id="acceptance-message" name="message" rows="2" maxlength="2000"></textarea></div>
        <label class="testmail-confirm"><input name="confirmed" type="checkbox" required>
        Ik bevestig dat dit mijn eigen gegevens zijn en dat ik één echte interne testaanvraag bij NIVO doe.
        Dit geeft geen toestemming voor algemene marketing.</label>
        <button class="button button-primary" type="submit">Test opslaan en mailketen testen</button>
        <p id="acceptance-error" class="form-message" role="alert"></p>
      </form>
    </details>${status}
    <p class="admin-mini">Bevestig zelf in de inbox de interne melding en klantbevestiging. Gebruik daarna bij het testdossier de normale opvolging, intrekking en eventueel privacywissing; deel geen persoonsgegevens in GitHub.</p>
  </section>`;
}

export function setAcceptanceKind(form) {
  const housing = form.elements.kind.value === 'housing';
  form.querySelector('[data-acceptance-housing]').hidden = !housing;
  for (const name of ['phone', 'street', 'houseNumber', 'city']) form.elements[name].required = housing;
  form.elements.postcode.required = housing;
}

export function acceptancePayload(form) {
  const housing = form.elements.kind.value === 'housing';
  const value = name => form.elements[name].value.trim();
  const lead = {
    requestId: form.dataset.requestId || crypto.randomUUID(),
    name: value('name'), channel: housing ? 'phone' : 'email', email: value('email'),
    postcode: value('postcode'), topic: value('topic'), message: value('message'),
    ...(housing ? {phone: value('phone'), contactPreference: value('contactPreference'),
      housing: {street: value('street'), houseNumber: value('houseNumber'),
        addition: value('addition'), city: value('city')}} : {}),
  };
  form.dataset.requestId = lead.requestId; // Reuse on a network retry; server remains idempotent.
  return {kind: housing ? 'housing' : 'general', confirmed: form.elements.confirmed.checked, lead};
}
