import {api,localHour} from './api.mjs';
import {brand} from './brand.mjs';
import {DAYMAIL_POLICY_VERSION,DAYMAIL_TEXT,MEMBER_DEVICES,cleanEnergyProfile} from './member-schema.mjs';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={config:{},session:{authenticated:false},data:null,plan:null,day:localHour(Date.now())>=18?'tomorrow':'today'};
// Read tokens from a fragment, then remove them from the address/history. Never send them to analytics.
function readLinkAction(){
  const fragment=new URLSearchParams(location.hash.slice(1));
  const next=fragment.has('bevestig')?{kind:'verify',token:fragment.get('bevestig')}:fragment.has('afmelden')?{kind:'unsubscribe',token:fragment.get('afmelden')}:null;
  if(next)history.replaceState(null,'',location.pathname);
  return next;
}
let action=readLinkAction();
// Pasting an email link into an existing tab can be a same-document navigation.
// It must show the same explicit confirmation, without consuming the link.
window.addEventListener('hashchange',()=>{const next=readLinkAction();if(next){action=next;render();}});
function notice(message,error=false){const el=$('#member-notice');el.className=error?'form-message error member-notice':'form-message member-notice';el.textContent=message;}
const field=(id,label,value='',attrs='')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" value="${esc(value)}" ${attrs}></div>`;
function edition(selected='evening'){return `<div class="field"><label for="edition">Wanneer wil je je dagplan?</label><select id="edition" name="edition"><option value="evening" ${selected==='evening'?'selected':''}>Avond · vanaf 18:00 voor morgen</option><option value="morning" ${selected==='morning'?'selected':''}>Ochtend · vanaf 07:00 voor vandaag</option></select></div>`;}
function deviceFields(profile={devices:[],startHour:8,endHour:22}){return `<fieldset class="member-devices"><legend>Welke apparaten wil je plannen?</legend>${Object.entries(MEMBER_DEVICES).map(([id,name])=>`<label class="member-option"><input type="checkbox" name="devices" value="${id}" ${profile.devices.includes(id)?'checked':''}>${name}</label>`).join('')}</fieldset><div class="form-grid">${field('startHour','Mag starten vanaf',profile.startHour,'type="number" inputmode="numeric" min="0" max="23" step="1" required')}${field('endHour','Moet klaar zijn om',profile.endHour,'type="number" inputmode="numeric" min="1" max="24" step="1" required')}</div><p class="mini-note">Hele uren (0–24), binnen één prijsdag. Apparaatverbruik is een zichtbaar voorbeeld, geen gemeten verbruik.</p>`;}
function devicesFrom(form){return [...form.querySelectorAll('[name="devices"]:checked')].map(el=>el.value);}
function loggedOut(){
  const c=state.config;
  return `<div class="grid grid-equal"><section class="panel panel-pad member-card"><p class="eyebrow">Bewaar jouw inzicht</p><h2>Je persoonlijke profiel.</h2><p>Bewaar je rekeninvoer en apparaten. Ga later verder op je telefoon of computer. Zonder wachtwoord, via een eenmalige e-maillink.</p><form id="member-login">${field('email','E-mailadres','','type="email" autocomplete="email" maxlength="254" required')}<label class="member-honeypot" aria-hidden="true">Laat leeg<input name="website" tabindex="-1" autocomplete="off"></label><button class="button button-primary" ${!c.accountsEnabled?'disabled':''}>Stuur mij een inloglink</button></form>${!c.accountsEnabled?'<p class="member-status">Accounts zijn nog niet geactiveerd. De gratis stroomtool blijft beschikbaar.</p>':''}<p class="mini-note">Een account is geen nieuwsbriefinschrijving of verzoek om gebeld te worden.</p></section><section class="panel panel-pad member-card"><p class="eyebrow">Zonlio Dagplan</p><h2>Jouw stroommomenten, in je inbox.</h2><p>Kies apparaten en een editie. Je bevestigt eerst je e-mailadres; daarna ontvang je alleen het gevraagde dagplan.</p><form id="member-subscribe">${field('subscribe-email','E-mailadres','','type="email" autocomplete="email" maxlength="254" required')}${edition()}${deviceFields()}<p class="member-status">Eerst op basis van beursprijzen. Zonder contractinvoer zijn dit geen volledige consumentenkosten. Bij een vast tarief levert alleen verschuiven geen tariefvoordeel op.</p><label class="member-consent"><input type="checkbox" name="consent" required><span>${esc(c.policyText||DAYMAIL_TEXT)}</span></label><label class="member-honeypot" aria-hidden="true">Laat leeg<input name="website" tabindex="-1" autocomplete="off"></label><button class="button button-primary" ${!c.subscriptionsEnabled?'disabled':''}>Bevestigingsmail aanvragen</button></form>${!c.subscriptionsEnabled?'<p class="member-status">Dagmailinschrijvingen zijn nog niet geactiveerd.</p>':''}<p class="mini-note">Alleen met gepubliceerde prijzen. Geen advertenties, automatische apparaatsturing of beloofde besparing.</p></section></div>`;
}
function profileForm(){
  const p=state.data.member.profile,c=p.contract;
  return `<form id="member-profile"><div class="member-section-heading"><h2>Je energieprofiel</h2><button type="button" class="button button-secondary" data-member-action="import-local">Gebruik lokaal bewaard profiel</button></div><p>Alleen wat je hier opslaat gaat naar je account. Je kiest later apart of je een berekening bij een adviesaanvraag deelt.</p><div class="form-grid">${field('annualUse','Totaal jaarverbruik (kWh)',p.scenario.annualUse??'','type="number" inputmode="decimal" min="0" max="100000" step="1"')}${field('annualSolar','Jaaropwek zonnepanelen (kWh)',p.scenario.annualSolar??'','type="number" inputmode="decimal" min="0" max="100000" step="1"')}</div><div class="field"><label for="contract-type">Stroomcontract</label><select id="contract-type" name="contractType"><option value="unknown" ${c.type==='unknown'?'selected':''}>Nog niet ingevuld · alleen beursinformatie</option><option value="fixed" ${c.type==='fixed'?'selected':''}>Vast of variabel · één ingevoerd tarief</option><option value="dynamic" ${c.type==='dynamic'?'selected':''}>Dynamisch · mijn contractonderdelen</option></select></div><div id="contract-fields">${contractFields(c)}</div>${deviceFields(p)}<button class="button button-primary">Mijn profiel opslaan</button><p class="mini-note">Een opgeslagen plan blijft een berekening. Zonlio meet geen gerealiseerde besparing en schakelt geen apparaten.</p></form>`;
}
function contractFields(c){
  if(c.type==='unknown')return '<p class="member-status">Zonder contractinstellingen rekenen we alleen met beurskosten.</p>';
  return `${c.type==='fixed'?field('importRate','Afnametarief inclusief belasting en btw (€/kWh)',c.importRate??'','type="number" inputmode="decimal" step="0.00001" min="-1" max="5" required'):`<div class="form-grid">${field('markup','Leveranciersopslag excl. btw (€/kWh)',c.markup??'','type="number" inputmode="decimal" step="0.00001" min="-1" max="5" required')}${field('energyTax','Energiebelasting excl. btw (€/kWh)',c.energyTax??'','type="number" inputmode="decimal" step="0.00001" min="0" max="5" required')}${field('vat','Btw (%)',c.vat===undefined?'':c.vat*100,'type="number" inputmode="decimal" step="0.01" min="0" max="100" required')}<div class="field"><label for="resolution">Mijn contract rekent af per</label><select id="resolution" name="resolution"><option value="hour" ${c.resolution==='hour'?'selected':''}>Uur</option><option value="quarter" ${c.resolution==='quarter'?'selected':''}>Kwartier</option></select></div></div>`}<label class="member-consent"><input type="checkbox" name="contractConfirmed" ${c.confirmed?'checked':''} required><span>Ik heb deze gegevens gecontroleerd in mijn eigen contract. Dit zijn geen vastgestelde toekomstige tarieven.</span></label>`;
}
function preferenceForm(){
  const sub=state.data.subscription;
  const blocked=state.data.member.deliveryBlocked;
  return `<form id="member-preferences"><h2>Mail op jouw voorwaarden</h2><p>Status: <strong>${esc(({active:'Actief',paused:'Gepauzeerd',unsubscribed:'Afgemeld'})[sub?.status]||'Niet ingeschreven')}</strong></p>${blocked?'<p class="member-status">Er geldt een verzendstop voor dit adres. Je kunt je profiel blijven gebruiken, exporteren of verwijderen. Voor hulp: <a href="mailto:info@zonlio.nl">info@zonlio.nl</a>.</p>':''}${edition(sub?.edition)}<label class="member-consent"><input type="checkbox" name="consent"><span>${esc(state.config.policyText||DAYMAIL_TEXT)}</span></label><div class="member-actions"><button class="button button-primary" name="status" value="active" ${!state.config.subscriptionsEnabled||blocked?'disabled':''}>${sub?.status==='active'?'Editie opslaan':'Dagplan activeren'}</button>${sub?'<button class="button button-secondary" name="status" value="paused">Pauzeren</button><button class="button-text" name="status" value="unsubscribed">Afmelden</button>':''}</div><p class="mini-note">Geen verkooptelefoontjes of aanbiedingen. Bij gewijzigde voorkeuren kan een al klaarstaand dagplan worden overgeslagen.</p></form>`;
}
function planMarkup(){
  const p=state.plan;
  if(!p)return '<p>Kies een dag om met je opgeslagen instellingen te plannen.</p>';
  if(p.status!=='available')return `<p class="member-status">${({no_devices:'Kies eerst apparaten in je profiel.',no_window:'Er past geen volledig toekomstig blok binnen je tijden.',unavailable:'Er zijn nog geen volledige, actuele prijzen voor deze dag.',not_published:'De prijzen zijn nog niet gepubliceerd.'})[p.status]||'Er kan nu geen betrouwbaar plan worden gemaakt.'}</p>`;
  const tm=s=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
  return `<p><strong>${esc(p.date)}</strong> · ${esc(p.basisLabel)}</p><div class="member-plan-list">${p.plans.map(x=>`<div><span>${esc(x.name)}<small>${x.energyKwh} kWh · voorbeeldverbruik</small></span><strong>${tm(x.start)}–${tm(x.end)}<small>${new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(x.cost)}</small></strong></div>`).join('')}</div><p class="mini-note">${esc(p.limitations)}</p><p class="mini-note">${esc(p.source.attribution)} · ${esc(p.source.license)}</p>`;
}
function loggedIn(){return `<div class="member-account-bar"><p>Ingelogd als <strong>${esc(state.session.email)}</strong></p><button class="button button-secondary" data-member-action="logout">Uitloggen</button></div><div class="grid grid-equal"><section class="panel panel-pad member-card">${profileForm()}</section><div class="member-stack"><section class="panel panel-pad member-card"><div class="member-section-heading"><h2>Mijn dagplan</h2><div class="segmented"><button data-member-day="today" aria-pressed="${state.day==='today'}" class="${state.day==='today'?'selected':''}">Vandaag</button><button data-member-day="tomorrow" aria-pressed="${state.day==='tomorrow'}" class="${state.day==='tomorrow'?'selected':''}">Morgen</button></div></div><div id="member-plan">${planMarkup()}</div></section><section class="panel panel-pad member-card">${preferenceForm()}</section><section class="panel panel-pad member-card"><h2>Jouw gegevens, jouw keuze</h2><p>Een opgeslagen profiel wordt niet automatisch als verkoopaanvraag gedeeld.</p><div class="member-actions"><a class="button button-secondary" href="/api/member/export">Mijn gegevens exporteren</a><button class="button-text" data-member-action="delete">Profiel en dagmail verwijderen</button></div><p class="mini-note">Een afzonderlijke woningadviesaanvraag blijft een apart dossier. Voor inzage of intrekking daarvan: info@zonlio.nl.</p></section></div></div>`;}
function render(){
  if(action&&!action.done){$('#member-app').innerHTML=`<section class="panel panel-pad member-card member-confirm"><p class="eyebrow">Bewuste bevestiging</p><h2>${action.kind==='verify'?'Bevestig je e-maillink':'Stop mijn dagplannen'}</h2><p>${action.kind==='verify'?'Je link wordt pas gebruikt wanneer je op de knop drukt. Een mailpreview of linkscanner logt je niet in.':'Je stopt hiermee alleen de dagplanmails. Je account en eventuele adviesaanvraag blijven bestaan.'}</p><button class="button button-primary" data-member-action="confirm-token">${action.kind==='verify'?'Bevestigen':'Afmelden voor dagplannen'}</button></section>`;return;}
  $('#member-app').innerHTML=state.session.authenticated&&state.data?loggedIn():loggedOut();
}
async function request(path,options={}){return api('/api/member'+path,{...options,headers:{...(options.method&&options.method!=='GET'?{'X-CSRF-Token':state.session.csrfToken||''}:{}),...options.headers}});}
async function refresh(){
  state.session=await request('/session');state.data=state.session.authenticated?await request('/profile'):null;
  if(state.data){
    try{state.plan=await request('/plan?day='+state.day);}catch{state.plan={status:'unavailable'};}
  }else state.plan=null;
  render();
}
function readProfile(form){
  const p=structuredClone(state.data.member.profile);p.devices=devicesFrom(form);p.startHour=Number(form.elements.startHour.value);p.endHour=Number(form.elements.endHour.value);
  for(const k of ['annualUse','annualSolar']){if(form.elements[k].value==='')delete p.scenario[k];else p.scenario[k]=Number(form.elements[k].value);}
  p.contract={type:form.elements.contractType.value};
  if(p.contract.type!=='unknown'){
    p.contract.confirmed=form.elements.contractConfirmed.checked;
    for(const k of p.contract.type==='fixed'?['importRate']:['markup','energyTax','vat'])p.contract[k]=Number(form.elements[k].value)/(k==='vat'?100:1);
    if(p.contract.type==='dynamic')p.contract.resolution=form.elements.resolution.value;
  }
  return cleanEnergyProfile(p);
}
document.addEventListener('change',event=>{if(event.target.id==='contract-type')$('#contract-fields').innerHTML=contractFields({type:event.target.value});});
document.addEventListener('submit',async event=>{
  const f=event.target;if(!f.id.startsWith('member-'))return;event.preventDefault();const button=event.submitter||f.querySelector('button[type="submit"],button:not([type])');
  if(!f.reportValidity()||!button)return;button.disabled=true;
  try{
    if(f.id==='member-login'){await request('/login',{method:'POST',body:{email:f.elements.email.value,website:f.elements.website.value}});notice('Controleer je inbox en spammap. Alleen de bevestigde link geeft toegang.');}
    if(f.id==='member-subscribe'){await request('/subscribe',{method:'POST',body:{email:f.elements['subscribe-email'].value,website:f.elements.website.value,edition:f.elements.edition.value,consent:f.elements.consent.checked,policyVersion:DAYMAIL_POLICY_VERSION,profile:cleanEnergyProfile({devices:devicesFrom(f),startHour:Number(f.elements.startHour.value),endHour:Number(f.elements.endHour.value)})}});notice('Controleer je inbox en bevestig je e-mailadres. Je bent nog niet ingeschreven tot je dat doet.');}
    if(f.id==='member-profile'){await request('/profile',{method:'PUT',body:{profile:readProfile(f),expectedRevision:state.data.member.revision}});state.plan=null;await refresh();notice('Je profiel is opgeslagen. Een al klaargezette mail met oudere instellingen wordt niet meer verstuurd.');}
    if(f.id==='member-preferences'){const result=await request('/subscription',{method:'PUT',body:{choice:{edition:f.elements.edition.value,status:button.value},consent:f.elements.consent.checked,policyVersion:DAYMAIL_POLICY_VERSION,expectedRevision:state.data.subscription?.revision??-1}});state.data.subscription=result.subscription;f.outerHTML=preferenceForm();notice('Je mailvoorkeuren zijn bijgewerkt.');}
  }catch(error){notice(error.message,true);}finally{if(button.isConnected)button.disabled=false;}
});
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-member-action],[data-member-day]');if(!b)return;b.disabled=true;
  try{
    if(b.dataset.memberDay){state.day=b.dataset.memberDay;state.plan=await request('/plan?day='+state.day);$('#member-plan').innerHTML=planMarkup();document.querySelectorAll('[data-member-day]').forEach(el=>{el.classList.toggle('selected',el.dataset.memberDay===state.day);el.setAttribute('aria-pressed',String(el.dataset.memberDay===state.day));});return;}
    switch(b.dataset.memberAction){
      case 'confirm-token':{const pending=action;const result=await request('/'+pending.kind,{method:'POST',body:{token:pending.token}});pending.token='';pending.done=true;await refresh();if(action===pending)notice(result.message);break;}
      case 'logout':await request('/logout',{method:'POST',body:{}});await refresh();notice('Je bent uitgelogd.');break;
      case 'delete':if(window.confirm('Je Mijn Zonlio-profiel, dagmail en sessies verwijderen? Dit verwijdert geen afzonderlijke woningadviesaanvraag.')){const result=await request('/profile',{method:'DELETE',body:{confirm:'DELETE_MY_ZONLIO'}});await refresh();notice(result.message);}break;
      case 'import-local':{
        const local=JSON.parse(localStorage.getItem(brand.storageKey)||'null');if(local?.version!==2||!local.profile)throw new Error('Er is geen lokaal bewaard profiel op dit apparaat.');
        // Tariff resolution needs explicit review; never infer it from the source price resolution.
        const profile=cleanEnergyProfile({...state.data.member.profile,scenario:local.profile});state.data.member.profile=profile;render();notice('Je lokale rekeninvoer staat in het formulier. Controleer en klik op opslaan om die naar je account te sturen.');break;
      }
    }
  }catch(error){notice(error.message,true);}finally{if(b.isConnected)b.disabled=false;}
});
async function boot(){try{state.config=await request('/config');await refresh();}catch(error){notice(error.message,true);$('#member-app').innerHTML='<p>Mijn Zonlio is nu niet bereikbaar. Je kunt de gewone stroomtool blijven gebruiken.</p>';}}
boot();
