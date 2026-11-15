import {readinessMarkup} from './admin-readiness.mjs';
import {operationsMarkup,salesFunnelMarkup} from './admin-operations.mjs';
import {privacyToolsMarkup,privacyOperationsMarkup} from './admin-privacy.mjs';
import {api} from './api.mjs';
import {acceptanceMarkup,acceptancePayload,setAcceptanceKind} from './admin-acceptance.mjs';
import {compareSelfUse,batteryScenario} from './domain.mjs';
import {LEAD_STATUS_LABELS, CONTACT_PREFERENCES, CLOSED_STATUSES} from './advice-schema.mjs';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number.isFinite(value)?new Intl.NumberFormat('nl-NL',{maximumFractionDigits:1}).format(value):'—';
const money=value=>Number.isFinite(value)?new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value):'—';
const date=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
const statuses=LEAD_STATUS_LABELS;
const topics={battery:'Thuisbatterij',solar:'Eigen zonnestroom',contract:'Stroomcontract',charging:'Laadvoorziening',heatpump:'Verwarming',other:'Andere vraag'};
const notifications={queued:'In wachtrij',pending:'In wachtrij',sent:'Verzonden via SMTP',failed:'Melding mislukt',cancelled:'Verzending gestopt'};
const state={session:null,config:null,days:30,status:'',queue:'attention',stats:null,statsState:'loading',leads:[],leadsState:'loading',nextCursor:null,selected:null,selectedRevision:0,refreshing:false,readiness:null,readinessError:false,acceptanceResult:null};
let returnFocus=null;

function toast(message){const target=$('#admin-toast');target.textContent=message;target.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>target.classList.remove('show'),4500);}
function setDialog(content){const dialog=$('#admin-dialog');if(!dialog.open)returnFocus=document.activeElement;$('#admin-dialog-content').innerHTML=content;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;}
function closeDialog(){const dialog=$('#admin-dialog');dialog.close();state.selected=null;if(returnFocus?.isConnected)returnFocus.focus();}
async function adminApi(path,options={}) {
  try{return await api('/api/admin'+path,{...options,headers:{...(options.method&&options.method!=='GET'?{'X-CSRF-Token':state.session?.csrfToken||''}:{}),...options.headers}});}
  catch(error){if(error.status===401){state.session=null;state.stats=null;state.leads=[];state.readiness=null;if($('#admin-dialog').open)closeDialog();renderLogin('Je sessie is verlopen. Log opnieuw in.');}throw error;}
}
function renderLogin(message='') {
  $('#admin-account').innerHTML='';
  const unconfigured=state.config?.adminConfigured===false;
  $('#admin-main').innerHTML=`<section class="admin-login panel"><div class="login-symbol" aria-hidden="true">↗</div><span class="eyebrow">ZONLIO BEHEER</span><h1>${unconfigured?'Beheer wordt klaargezet.':'Welkom terug.'}</h1><p>${unconfigured?'Er is nog geen beheeraccount geconfigureerd voor deze omgeving. Er worden geen voorbeeldgegevens getoond.':'Log in om echte aanvragen en de voortgang van opvolging te bekijken.'}</p>${unconfigured?'<a class="button button-secondary" href="/">Terug naar Zonlio</a>':`<form id="login-form"><div class="field"><label for="admin-email">E-mailadres</label><input id="admin-email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="admin-password">Wachtwoord</label><input id="admin-password" name="password" type="password" autocomplete="current-password" required></div><div id="login-error" class="form-message error ${message?'':'hidden'}" role="alert">${esc(message)}</div><button class="button button-primary" type="submit">Inloggen</button></form>`}</section>`;
}
function statCard(label,value,note,color=''){return `<article class="admin-stat panel"><span>${label}</span><strong class="${color}">${number(value)}</strong><small>${note}</small></article>`;}
function healthRow(label,source){const status=source?.status;return `<div class="health-row"><div><strong>${label}</strong><small>${source?.lastSuccessAt?'Laatste succes '+date(source.lastSuccessAt):'Nog geen succesvolle bronaanvraag gemeten'}</small></div><span class="health-badge ${status==='ready'?'good':status==='degraded'?'warn':''}">${status==='ready'?'Beschikbaar':status==='degraded'?'Aandacht nodig':'Nog niet opgehaald'}</span></div>`;}
function dailyMarkup() {
  const daily=Array.isArray(state.stats?.daily)?state.stats.daily:[];
  if(!daily.length)return `<div class="admin-empty compact">${state.statsState==='loading'?'Gegevens ophalen…':'Nog geen dagmetingen voor deze periode.'}</div>`;
  const maximum=Math.max(0,...daily.map(d=>Number(d.leads)||0));
  if(!maximum)return '<div class="admin-empty compact"><span class="empty-dot"></span><strong>Een helder begin.</strong><p>In deze periode zijn nog geen aanvragen ontvangen.</p></div>';
  return `<div class="daily-chart" role="img" aria-label="Ontvangen aanvragen per dag"><div class="daily-bars">${daily.map(d=>`<div title="${esc(d.date)}: ${number(d.leads)} aanvragen"><span style="height:${Math.max(2,Math.min(100,(Number(d.leads)||0)/maximum*100))}%"></span></div>`).join('')}</div><div class="daily-axis"><span>${esc(daily[0].date)}</span><span>${esc(daily.at(-1).date)}</span></div></div><details class="daily-table"><summary>Dagmetingen als tabel</summary><div class="admin-table-scroll"><table><thead><tr><th>Datum</th><th>Aanvragen</th><th>Paginaweergaven</th><th>Sessies met toestemming</th></tr></thead><tbody>${daily.map(d=>`<tr><td>${esc(d.date)}</td><td>${number(d.leads)}</td><td>${number(d.pageViews)}</td><td>${number(d.sessions)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function render() {
  if(!state.session?.authenticated)return;
  const readinessOpen=location.hash==='#testen'||Boolean($('#testen')?.open);
  const totals=state.stats?.totals||{};const mail=state.stats?.mail;const loading=state.statsState==='loading';
  $('#admin-account').innerHTML=`<span class="admin-email">${esc(state.session.email)}</span><button class="button button-secondary" data-admin-action="logout">Uitloggen</button>`;
  $('#admin-main').innerHTML=`<div class="admin-intro"><div><div class="eyebrow">VAN INZICHT NAAR CONTACT</div><h1>Aandacht voor elke aanvraag.</h1><p>Ontvangst, opvolging en de gezondheid van Zonlio op één plek.</p></div><div class="admin-period"><label for="admin-days">Overzichtsperiode</label><select id="admin-days">${[7,30,90].map(d=>`<option value="${d}" ${state.days===d?'selected':''}>Afgelopen ${d} dagen</option>`).join('')}</select><button class="admin-refresh" data-admin-action="refresh" ${state.refreshing?'disabled':''}>${state.refreshing?'Verversen…':'Verversen ↻'}</button></div></div>
    ${state.statsState==='error'?`<div class="form-message error" role="alert">Het cijferoverzicht kon niet worden geladen. Aanvraaggegevens hieronder kunnen wel beschikbaar zijn. <button class="button-text" data-admin-action="refresh">Opnieuw proberen</button></div>`:''}
    ${readinessMarkup(state.readiness,{open:readinessOpen,loading:state.refreshing,error:state.readinessError})}
    ${operationsMarkup(state.stats?.operations)}
    ${privacyOperationsMarkup()}
    ${acceptanceMarkup({email:state.session.email,result:state.acceptanceResult})}
    <div class="admin-stats">${statCard('Ontvangen aanvragen',totals.leads,loading?'Wordt opgehaald':`Binnen ${state.days} dagen`)}${statCard('Nieuw',totals.new,'Nog te starten opvolging','blue')}${statCard('Bereikt',totals.contacted,'Huidige status; niet alleen een belpoging')}${statCard('Gewonnen',totals.won,'Door het team gemarkeerd','good')}</div>
    <section class="panel admin-panel workload-panel" aria-labelledby="workload-title"><div class="panel-head"><div><h2 id="workload-title">Wat vraagt nu aandacht?</h2><p>Alle open dossiers, onafhankelijk van de instroomperiode hierboven.</p></div></div><div class="workload-grid"><div><strong>${number(state.stats?.workload?.attention)}</strong><span>Vraagt nu aandacht</span></div><div><strong>${number(state.stats?.workload?.due)}</strong><span>Vandaag of achterstallig</span></div><div><strong>${number(state.stats?.workload?.expired)}</strong><span>Contacttermijn verstreken</span></div></div><p class="admin-mini">Alleen actieve, vrijwillige contactverzoeken. Nieuwe dossiers en ontbrekende vervolgacties tellen mee. <button class="button-text" type="button" data-admin-action="focus-attention">Open werkvoorraad →</button> Een verlopen verzoek geeft geen recht op nieuw verkoopcontact.</p></section>
    <div class="admin-middle"><section class="panel admin-panel"><div class="panel-head"><div><h2>Ontvangen aanvragen</h2><p>De dagelijkse instroom in deze periode.</p></div><span class="badge">${state.days} dagen</span></div>${dailyMarkup()}</section><section class="panel admin-panel system-card"><div class="panel-head"><h2>Verbindingen</h2><span class="system-dot ${mail?.configured?'ready':''}"></span></div><div class="health-row"><div><strong>E-mailmeldingen</strong><small>${mail?.lastSuccessAt?'Laatste verzending '+date(mail.lastSuccessAt):'Nog geen succesvolle verzending geregistreerd'}</small></div><span class="health-badge ${mail?.configured?'good':''}">${mail?mail.configured?'Ingesteld':'Niet ingesteld':'Onbekend'}</span></div><div class="mail-counts"><span><strong>${number(mail?.pending)}</strong> in wachtrij</span><span><strong>${number(mail?.failed)}</strong> mislukt</span></div>${state.stats?.sources?healthRow('Stroomprijzen',state.stats.sources.prices)+healthRow('Weersverwachting',state.stats.sources.weather):''}<div class="health-row"><div><strong>Woningadvies</strong><small>${esc(state.config?.controller?.name||'Ontvanger niet beschikbaar')}</small></div><span class="health-badge ${state.config?.housingAdviceEnabled?'good':''}">${state.config?.housingAdviceEnabled?'Vrijgegeven':'Niet geactiveerd'}</span></div><div class="admin-system-actions"><button class="button button-secondary" data-admin-action="verify-mail" ${!mail?.configured?'disabled':''}>Verbinding controleren</button><button class="button button-secondary" data-admin-action="retry-mail" ${!mail?.configured?'disabled':''}>Wachtrij verwerken</button></div><p class="admin-mini">Een opgeslagen aanvraag blijft zichtbaar, ook wanneer de e-mailmelding nog niet is verzonden.</p></section></div>
    <section class="panel admin-panel member-admin-summary"><div class="panel-head"><div><h2>Mijn Zonlio & dagmail</h2><p>Geverifieerde e-mailadressen en abonnementen, geen verkoopaanvragen.</p></div></div><div class="analytics-stats"><div><strong>${number(state.stats?.members?.verifiedEmails)}</strong><span>Geverifieerde adressen</span></div><div><strong>${number(state.stats?.members?.subscriptions?.active||0)}</strong><span>Actieve dagplanabonnementen</span></div><div><strong>${number(state.stats?.members?.mail?.accepted||0)}</strong><span>Door SMTP geaccepteerd</span><small>Geen bewijs van inboxaflevering.</small></div><div><strong>${number(state.stats?.members?.reservedAttempts24h||0)}</strong><span>Verzendpogingen afgelopen 24 uur</span></div></div><p class="admin-mini">Accounts: ${state.stats?.members?.accountsEnabled?'geactiveerd':'uit'} · Inschrijven: ${state.stats?.members?.subscriptionsEnabled?'geactiveerd':'uit'} · Dagmail: ${state.stats?.members?.dailySendEnabled?'geactiveerd':'uit'}. Laatste onderhoud: ${date(state.stats?.members?.maintenance?.at)}.</p><p class="admin-mini">Portal-uitwisseling: ${state.stats?.portal?.enabled?'geactiveerd':'uit'} · ${number(state.stats?.portal?.pending||0)} wachtend · ${number(state.stats?.portal?.accepted||0)} door Portal bevestigd. Opvolger nieuwe woningaanvragen: Pim. Geen directe Odoo-koppeling.</p><p class="admin-mini">Oudste wachtende Portal-taak: ${date(state.stats?.portal?.oldestPendingAt)} · ${number(state.stats?.portal?.expiredLeases||0)} verlopen reserveringen · Laatste Portal-acceptatie: ${date(state.stats?.portal?.lastAcceptedAt)}. Uitgeschakelde export blokkeert de eigen opvolging niet.</p></section>
    <section class="panel admin-panel leads-panel"><div class="panel-head"><div><h2>De aanvragen</h2><p>Bekijk een aanvraag en werk de opvolgstatus bij.</p></div><div class="admin-filter"><label class="sr-only" for="lead-queue-filter">Werkvoorraad of alle dossiers</label><select id="lead-queue-filter"><option value="attention" ${state.queue==='attention'?'selected':''}>Nu opvolgen</option><option value="" ${state.queue===''?'selected':''}>Alle aanvragen</option><option value="acceptance" ${state.queue==='acceptance'?'selected':''}>Acceptatietests</option></select><label class="sr-only" for="lead-status-filter">Filter op opvolgstatus</label><select id="lead-status-filter"><option value="">Alle statussen</option>${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${state.status===key?'selected':''}>${label}</option>`).join('')}</select></div></div><div id="admin-lead-list">${leadListMarkup()}</div></section>
    <section class="panel admin-panel workload-panel"><div class="panel-head"><div><h2>Waar beginnen aanvragen?</h2><p>Opgeslagen aanvragen per bronmodule in de gekozen periode. Geen klikconversiepercentage.</p></div></div><div class="analytics-stats">${(state.stats?.acquisition||[]).map(row=>`<div><strong>${number(row.leads)}</strong><span>${esc(({overzicht:'Overzicht',planner:'Slim plannen','2027':'Mijn 2027',batterij:'Thuisbatterij'})[row.sourcePath]||row.sourcePath)}</span></div>`).join('')||'<p class="admin-mini">Nog geen bronoverzicht beschikbaar.</p>'}</div></section>
    <section class="panel admin-panel"><h2>Van aanvraag naar resultaat</h2>${salesFunnelMarkup(state.stats?.acquisition||[])}</section>
    <section class="panel admin-panel analytics-panel"><div class="panel-head"><div><h2>Gebruik met context</h2><p>Deze tellingen beschrijven verschillende groepen en vormen geen gezamenlijke conversieratio.</p></div><span class="badge">Zonder contactgegevens</span></div><div class="analytics-stats"><div><strong>${number(totals.pageViews)}</strong><span>Paginaweergaven via server</span><small>Geen telling van unieke bezoekers.</small></div><div><strong>${number(totals.consentedSessions)}</strong><span>Sessies met toestemming</span><small>Alleen opt-in gebruiksmetingen.</small></div><div><strong>${number(totals.calculatorCompleted)}</strong><span>Rekenresultaat gebruikt</span><small>Bewuste rekeninvoer, planning of resultaat geopend.</small></div><div><strong>${number(totals.adviceOpened)}</strong><span>Adviesformulier geopend</span><small>Alleen sessies met toestemming.</small></div></div></section>`;
}
function leadListMarkup() {
  if(state.leadsState==='loading'&&!state.leads.length)return '<div class="admin-empty" role="status">Aanvragen ophalen…</div>';
  if(state.leadsState==='error'&&!state.leads.length)return '<div class="admin-empty"><strong>Aanvragen laden lukt nu niet.</strong><button class="button button-secondary" data-admin-action="reload-leads">Opnieuw proberen</button></div>';
  if(!state.leads.length)return `<div class="admin-empty"><span class="empty-dot"></span><strong>${state.queue==='acceptance'?'Nog geen eigenaarstests.':state.queue==='attention'?'Geen opvolging die nu aandacht vraagt.':state.status?'Geen aanvragen met deze status.':'Nog geen aanvragen ontvangen.'}</strong><p>${state.queue==='attention'?'Nieuwe geldige verzoeken en achterstallige acties verschijnen hier automatisch. Kies Alle aanvragen voor de historie.':'Zodra iemand een aanvraag verstuurt, staat die hier met de gekozen contactwijze.'}</p></div>`;
  return `<div class="admin-table-scroll"><table class="leads-table"><thead><tr><th scope="col">Aanvrager</th><th scope="col">Onderwerp</th><th scope="col">Contactkeuze</th><th scope="col">Opvolging</th><th scope="col">Ontvangen</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Openen</span></th></tr></thead><tbody>${state.leads.map(lead=>`<tr><td><button class="lead-name" data-open-lead="${esc(lead.id)}">${esc(lead.name||'Naam niet beschikbaar')}</button><small>${esc(lead.reference)}${lead.acceptanceTest?' · EIGENAARSTEST':''}${lead.kind==='housing'?' · Woningadvies':''}</small></td><td>${esc(topics[lead.topic]||lead.topic)}</td><td><span class="contact-channel">${lead.channel==='phone'?'Bellen':'E-mail'}</span><small>${esc(lead.postcode||'Geen postcode gedeeld')}</small></td><td><span class="lead-followup-summary">${esc(lead.followUp?.owner||'Nog niet toegewezen')}</span><small>${esc(lead.followUp?.nextActionOn||'Geen actiedatum')}</small></td><td>${date(lead.createdAt)}</td><td><span class="lead-status ${esc(Object.hasOwn(statuses,lead.status)?lead.status:'')}">${esc(statuses[lead.status]||lead.status)}</span></td><td><button class="lead-open-button" aria-label="Open aanvraag van ${esc(lead.name)}" data-open-lead="${esc(lead.id)}">↗</button></td></tr>`).join('')}</tbody></table></div>${state.nextCursor?`<div class="load-more"><button class="button button-secondary" data-admin-action="more-leads" ${state.leadsState==='loading'?'disabled':''}>${state.leadsState==='loading'?'Laden…':'Meer aanvragen laden'}</button></div>`:''}${state.leadsState==='error'?'<p class="form-message error">Meer aanvragen laden is niet gelukt. Probeer het opnieuw.</p>':''}`;
}
async function loadLeads({append=false}={}) {
  state.leadsState='loading';if(!append)state.leads=[];const current=$('#admin-lead-list');if(current)current.innerHTML=leadListMarkup();
  try {
    const query=new URLSearchParams({limit:'50'});if(state.status)query.set('status',state.status);if(state.queue)query.set('queue',state.queue);if(append&&state.nextCursor)query.set('cursor',state.nextCursor);
    const result=await adminApi('/leads?'+query);
    if(!Array.isArray(result.leads))throw new Error('Onvolledige respons.');
    state.leads=append?[...state.leads,...result.leads]:result.leads;state.nextCursor=result.nextCursor||null;state.leadsState='ready';
  }catch{state.leadsState='error';}
  const target=$('#admin-lead-list');if(target)target.innerHTML=leadListMarkup();
}
async function refresh() {
  if(state.refreshing)return;state.refreshing=true;state.statsState='loading';render();
  const results=await Promise.allSettled([adminApi(`/stats?days=${state.days}`),loadLeads(),adminApi('/readiness'),api('/api/config')]);
  if(results[0].status==='fulfilled'){state.stats=results[0].value;state.statsState='ready';}else{state.stats=null;state.statsState='error';}
  state.readiness=results[2].status==='fulfilled'?results[2].value:null;state.readinessError=results[2].status==='rejected';
  if(results[3].status==='fulfilled')state.config=results[3].value;
  state.refreshing=false;render();
}
const profileLabels={annualUse:['Jaarverbruik','kWh'],annualSolar:['Zonneopwek','kWh'],selfUsePct:['Eigen verbruik nu','%'],targetPct:['Eigen verbruik scenario','%'],importRate:['Afnametarief','€/kWh'],exportRate:['Bruto terugleververgoeding','€/kWh'],exportFee:['Variabele terugleverkosten','€/kWh'],investment:['Batterijinvestering','€'],extraSolarStored:['Zonne-input opslag','kWh/jaar'],roundTripEfficiency:['Retourrendement',''],annualCosts:['Overige jaarkosten','€'],lifeYears:['Vergelijkingsperiode','jaar']};
function scenarioMarkup(lead) {
  const p=lead.scenario?.profile;
  if(!lead.shareScenario||!p)return '<div class="source-card"><strong>Geen rekenprofiel gedeeld</strong><p>De aanvrager heeft ervoor gekozen de rekengegevens niet mee te sturen.</p></div>';
  let outcome='';
  try{const r=compareSelfUse(p,p.targetPct);const b=batteryScenario({...p,selfUsePct:p.targetPct});outcome=`<div class="admin-scenario-result"><div><span>Variabel jaarsaldo</span><strong>${money(r.optimized.annualVariableCost)}</strong></div><div><span>Extra batterijvoordeel / jaar</span><strong>${money(b.annualNetBenefit)}</strong></div></div><p class="admin-mini">Herberekend met de gedeelde invoer. Geen offerte, capaciteitssimulatie of gegarandeerde besparing. Vaste kosten en belastingvermindering ontbreken in het jaarsaldo.</p>`;}catch{}
  return `<section class="lead-detail-section"><h3>Gedeeld rekenprofiel</h3>${outcome}<details><summary>Alle gedeelde invoer</summary><dl class="detail-grid">${Object.entries(profileLabels).filter(([key])=>Number.isFinite(p[key])).map(([key,[label,unit]])=>`<div><dt>${label}</dt><dd>${number(p[key])} ${unit}</dd></div>`).join('')}</dl></details></section>`;
}
function detailMarkup({lead,history=[]}) {
  const canContact=lead.contactRequested && Date.parse(lead.contactExpiresAt)>Date.now() && !CLOSED_STATUSES.includes(lead.status);
  const follow=lead.followUp||{};
  const contact=lead.channel==='phone'?lead.phone:lead.email;const link=lead.channel==='phone'?'tel:'+String(contact||'').replace(/[^+\d]/g,''):'mailto:'+encodeURIComponent(contact||'');
  return `<div class="lead-detail-heading"><span class="badge">${esc(lead.reference)}</span>${lead.acceptanceTest?'<span class="badge">EIGENAARSTEST — niet commercieel opvolgen</span>':''}<h2 id="admin-dialog-title">${esc(lead.name)}</h2><p>${esc(topics[lead.topic]||lead.topic)} · ontvangen ${date(lead.createdAt)}</p></div><div class="lead-contact-card"><span>Gekozen contactwijze: <strong>${lead.channel==='phone'?'telefonisch':'e-mail'}</strong></span>${canContact?`<a href="${esc(link)}">${esc(contact||'Contactgegeven ontbreekt')}</a>`:`<strong>${esc(contact||'Contactgegeven ontbreekt')}</strong><p class="workflow-warning">Geen actieve contactactie: dit dossier is afgerond, ingetrokken of de contacttermijn is verstreken.</p>`}<small>${esc(lead.postcode||'Geen postcode gedeeld')} · ${esc(notifications[lead.notificationStatus]||'Meldingsstatus onbekend')}</small></div>
    ${lead.housing?`<section class="lead-detail-section"><h3>De woning</h3><p>${esc(lead.housing.street)} ${esc(lead.housing.houseNumber)} ${esc(lead.housing.addition)}<br>${esc(lead.postcode)} ${esc(lead.housing.city)}</p><p class="admin-mini">Voorkeursmoment: ${esc(CONTACT_PREFERENCES[lead.contactPreference]||'Geen voorkeur')}. Geen bevestigde afspraak. Adres is door de aanvrager ingevuld, niet automatisch geverifieerd.</p></section>`:''}
    ${lead.message?`<section class="lead-detail-section"><h3>De vraag</h3><p class="pre-wrap">${esc(lead.message)}</p></section>`:''}${scenarioMarkup(lead)}
    <section class="lead-detail-section"><h3>Opvolging</h3><form id="lead-status-form"><div class="field"><label for="detail-status">Status</label><select id="detail-status" name="status">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${lead.status===key?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label for="detail-owner">Verantwoordelijke</label><input id="detail-owner" name="owner" maxlength="120" value="${esc(follow.owner||'')}" placeholder="Naam van de opvolger"><small>Een werkafspraak, nog geen gebruikerstoewijzing met aparte rechten.</small></div><div class="field"><label for="detail-action">Volgende actie</label><input id="detail-action" name="nextAction" maxlength="500" value="${esc(follow.nextAction||'')}" placeholder="Bijvoorbeeld: terugbellen over de woningvraag"></div><div class="field"><label for="detail-day">Actiedatum</label><input id="detail-day" name="nextActionOn" type="date" value="${esc(follow.nextActionOn||'')}"><small>Kalenderdag in Nederland. Geen contactactie op of na de einddatum van het verzoek.</small></div><p class="admin-mini">Bij afronding wordt de open actie gewist. Intrekken stopt wachtende mails en kan hier niet ongedaan worden gemaakt.</p><div class="field"><label for="detail-note">Interne notitie <span class="optional">(optioneel)</span></label><textarea id="detail-note" name="note" rows="3" maxlength="1000" placeholder="Bijvoorbeeld: afspraak ingepland of vervolgstap afgesproken."></textarea><small>Noteer alleen wat nodig is voor deze aanvraag.</small></div><div id="status-error" class="form-message error hidden" role="alert"></div><button type="submit" class="button button-primary">Opvolging opslaan</button></form></section>
    <details class="lead-audit"><summary>Contactverzoek en herkomst</summary><dl class="detail-grid"><div><dt>Contactverzoek</dt><dd>${lead.contactRequested?'Ja, actief gevraagd':'Niet vastgelegd'}</dd></div><div><dt>Formulierversie</dt><dd>${esc(lead.consentVersion)}</dd></div><div><dt>Ontvanger</dt><dd>${esc(lead.controller?.name)}</dd></div><div><dt>Herkomst</dt><dd>${esc(lead.sourcePath)}</dd></div><div><dt>Contactverzoek geldig tot</dt><dd>${date(lead.contactExpiresAt)}</dd></div></dl><p class="consent-record">${esc(lead.contactText)}</p><p class="admin-mini">De aanvraag is geen toestemming voor algemene marketing.</p></details>
    ${privacyToolsMarkup(lead)}
    <section class="lead-detail-section"><h3>Geschiedenis</h3>${history.length?`<ol class="lead-history">${history.map(item=>`<li><div><strong>${esc(statuses[item.status]||item.status||'Wijziging')}</strong><time>${date(item.createdAt)}</time></div>${item.note?`<p class="pre-wrap">${esc(item.note)}</p>`:''}<small>${esc(item.actor||'Systeem')}</small></li>`).join('')}</ol>`:'<p class="admin-mini">Er zijn nog geen opvolgnotities.</p>'}</section>`;
}
async function openLead(id) {
  state.selected=id;setDialog('<h2 id="admin-dialog-title">Aanvraag openen</h2><div class="admin-empty" role="status">Gegevens ophalen…</div>');
  try{const result=await adminApi('/leads/'+encodeURIComponent(id));if(state.selected===id){if(!result.lead)throw new Error('De aanvraag is niet beschikbaar.');state.selectedRevision=result.lead.revision||0;setDialog(detailMarkup(result));}}
  catch(error){if(state.selected===id)setDialog(`<h2 id="admin-dialog-title">Deze aanvraag is niet beschikbaar.</h2><p class="dialog-text">${esc(error.message)}</p><button class="button button-secondary" data-admin-action="close-dialog">Sluiten</button>`);}
}
async function mailAction(kind,button) {
  button.disabled=true;const initial=button.textContent;button.textContent=kind==='verify'?'Controleren…':'Verwerken…';
  try{const result=await adminApi('/mail/'+kind,{method:'POST',body:{}});toast(kind==='verify'?(result.ok?'De mailverbinding is bereikbaar.':result.error||'De mailverbinding is niet beschikbaar.'):`Wachtrij verwerkt: ${number(result.sent)} verzonden, ${number(result.failed)} mislukt, ${number(result.pending)} wachtend.`);await refresh();}
  catch(error){toast(error.message);}finally{if(button.isConnected){button.disabled=false;button.textContent=initial;}}
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.openLead){openLead(button.dataset.openLead);return;}
  const action=button.dataset.adminAction;
  if(['export-lead','recovery-export','retention-preview'].includes(action)) {
    button.disabled=true;
    try {
      if(action==='retention-preview') {const data=await adminApi('/privacy/retention');$('#privacy-summary').textContent=`${data.counts.leadReviewCandidates} dossiers vragen een bewaarbeoordeling. Voorstel: ${data.policy.closedDays} dagen na afsluiting of contactverval. Er is niets verwijderd; het bewaarbeleid vraagt nog goedkeuring.`;}
      else {const data=await adminApi(action==='export-lead'?'/leads/'+encodeURIComponent(state.selected)+'/export':'/privacy/recovery');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=action==='export-lead'?'zonlio-dossierexport.json':'zonlio-herstelregister.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Privé export aangemaakt. Deel deze niet in openbare tickets.');}
    }catch(error){toast(error.message);}finally{if(button.isConnected)button.disabled=false;}
  }
  if(action==='close-dialog')closeDialog();
  if(action==='refresh')refresh();
  if(action==='focus-attention'){state.queue='attention';state.status='';state.nextCursor=null;state.leads=[];state.leadsState='loading';render();loadLeads();document.querySelector('.leads-panel')?.scrollIntoView({block:'start',behavior:'smooth'});}
  if(action==='reload-leads')loadLeads();
  if(action==='more-leads')loadLeads({append:true});
  if(action==='verify-mail')mailAction('verify',button);
  if(action==='retry-mail')mailAction('retry',button);
  if(action==='logout') {
    button.disabled=true;
    try{await adminApi('/logout',{method:'POST',body:{}});state.session=null;state.stats=null;state.leads=[];state.readiness=null;if($('#admin-dialog').open)closeDialog();renderLogin();}
    catch(error){toast(error.message);button.disabled=false;}
  }
});
document.addEventListener('change',event=>{if(event.target.id==='acceptance-kind')setAcceptanceKind(event.target.form);if(event.target.id==='admin-days'){state.days=Number(event.target.value);refresh();}if(event.target.id==='lead-queue-filter'){state.queue=event.target.value;state.nextCursor=null;loadLeads();}if(event.target.id==='lead-status-filter'){state.status=event.target.value;if(CLOSED_STATUSES.includes(state.status)){state.queue='';const filter=$('#lead-queue-filter');if(filter)filter.value='';}state.nextCursor=null;loadLeads();}});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(['lead-correction-form','lead-erasure-form'].includes(form.id)) {
    event.preventDefault();if(!form.reportValidity()||!state.selected)return;
    const id=state.selected,button=$('button[type="submit"]',form),output=$('.privacy-result',form);button.disabled=true;
    try {
      if(form.id==='lead-erasure-form')await adminApi('/leads/'+encodeURIComponent(id)+'/erase',{method:'POST',body:{expectedRevision:state.selectedRevision,reference:form.elements.reference.value.trim(),requestVerified:form.elements.requestVerified.checked,confirm:'ERASE_LEAD_PERSONAL_DATA'}});
      else {const fields=Object.fromEntries(['name','email','phone','postcode'].map(key=>[key,form.elements[key].value.trim()]));if(form.elements.street)fields.housing=Object.fromEntries(['street','houseNumber','addition','city'].map(key=>[key,form.elements[key].value.trim()]));await adminApi('/leads/'+encodeURIComponent(id)+'/contact',{method:'PATCH',body:{expectedRevision:state.selectedRevision,requestVerified:form.elements.requestVerified.checked,fields}});}
      toast('De privacyhandeling is vastgelegd.');await openLead(id);refresh();
    } catch(error){if(form.isConnected)output.textContent=error.message;}finally{if(button.isConnected)button.disabled=false;}
  }
  if(form.id==='mail-suppression-form') {
    event.preventDefault();if(!form.reportValidity())return;
    const button=$('button[type="submit"]',form),result=$('#suppression-result',form);button.disabled=true;
    try {const response=await adminApi('/mail/suppress',{method:'POST',body:{email:form.elements.email.value.trim(),reason:form.elements.reason.value,confirmed:form.elements.confirmed.checked}});if(form.isConnected){form.reset();result.textContent=response.message;}toast('De verzendstop is vastgelegd.');}
    catch(error){if(form.isConnected)result.textContent=error.message;}
    finally{if(button.isConnected)button.disabled=false;}
  }
  if(form.id==='admin-acceptance-form') {
    event.preventDefault();if(!form.reportValidity())return;
    const button=$('button[type="submit"]',form),result=$('#acceptance-error',form);
    button.disabled=true;button.textContent='Veilig opslaan…';result.textContent='';
    try {
      const saved=await adminApi('/acceptance/lead',{method:'POST',body:acceptancePayload(form)});
      if(!saved.acceptanceTest||!saved.id)throw new Error('De acceptatieaanvraag is niet bevestigd.');
      state.acceptanceResult=saved;state.queue='acceptance';state.status='';
      await refresh();
      toast('Eigen testdossier veilig opgeslagen. Controleer de mailwachtrij en je eigen inbox.');
    } catch(error) {
      if(form.isConnected)result.textContent=error.message||'De acceptatieaanvraag is niet bevestigd.';
    } finally {
      if(button.isConnected){button.disabled=false;button.textContent='Test opslaan en mailketen testen';}
    }
  }
  if(form.id==='admin-testmail-form') {
    event.preventDefault();if(!form.reportValidity())return;
    const button=$('button[type="submit"]',form),result=$('#testmail-result',form);
    button.disabled=true;button.textContent='Via Zonlio verzenden…';result.textContent='Eén testmail aanbieden bij SMTP…';
    try {
      const data=await adminApi('/mail/test-delivery',{method:'POST',body:{recipient:form.elements.recipient.value.trim(),confirmed:form.elements.confirmed.checked}});
      if(!data.smtpAccepted)throw new Error('SMTP heeft de testmail niet geaccepteerd.');
      result.textContent=`SMTP heeft test ${data.reference} geaccepteerd. Controleer inbox en spam; aflevering is nog niet bevestigd.`;
      form.elements.confirmed.checked=false;
      toast('De testmail is door SMTP geaccepteerd. Controleer je inbox en spammap.');
    } catch(error){result.textContent=error.message||'Verzending is niet bevestigd.';toast(result.textContent);}
    finally{if(button.isConnected){button.disabled=false;button.textContent='Verstuur één testmail';}}
  }
  if(form.id==='login-form') {
    event.preventDefault();if(!form.reportValidity())return;
    const button=$('button[type="submit"]',form);button.disabled=true;button.textContent='Inloggen…';const error=$('#login-error');error.classList.add('hidden');
    try{const result=await api('/api/admin/login',{method:'POST',body:{email:form.elements.email.value.trim(),password:form.elements.password.value}});form.elements.password.value='';if(!result.authenticated)throw new Error('Inloggen is niet gelukt.');state.session=result;await refresh();const id=new URLSearchParams(location.hash.slice(1)).get('lead');if(/^[0-9a-f-]{36}$/i.test(id||''))await openLead(id);}
    catch(problem){if(form.isConnected){form.elements.password.value='';error.textContent=problem.message;error.classList.remove('hidden');form.elements.password.focus();}}
    finally{if(button.isConnected){button.disabled=false;button.textContent='Inloggen';}}
  }
  if(form.id==='lead-status-form') {
    event.preventDefault();if(!form.reportValidity()||!state.selected)return;const id=state.selected;const button=$('button[type="submit"]',form);button.disabled=true;button.textContent='Opslaan…';
    try{await adminApi('/leads/'+encodeURIComponent(id),{method:'PATCH',body:{status:form.elements.status.value,note:form.elements.note.value.trim(),expectedRevision:state.selectedRevision,followUp:{owner:form.elements.owner.value.trim(),nextAction:form.elements.nextAction.value.trim(),nextActionOn:form.elements.nextActionOn.value}}});toast('De opvolging is opgeslagen.');await openLead(id);refresh();}
    catch(error){if(form.isConnected){const output=$('#status-error');output.textContent=error.message;output.classList.remove('hidden');button.disabled=false;button.textContent='Opvolging opslaan';}}
  }
});
$('#admin-dialog').addEventListener('close',()=>{state.selected=null;});
async function boot() {
  const results=await Promise.allSettled([api('/api/config'),api('/api/admin/session')]);
  state.config=results[0].status==='fulfilled'?results[0].value:null;
  state.session=results[1].status==='fulfilled'?results[1].value:null;
  if(state.session?.authenticated){await refresh();const id=new URLSearchParams(location.hash.slice(1)).get('lead');if(/^[0-9a-f-]{36}$/i.test(id||''))await openLead(id);}else renderLogin(results[1].status==='rejected'&&results[1].reason.status!==401?'De verbinding met de beheeromgeving kon niet worden gecontroleerd.':'');
}
boot();
