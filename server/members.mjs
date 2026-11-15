import express from 'express';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { domainToASCII } from 'node:url';
import { OPERATOR, operatorConfiguration } from './operator.mjs';
import { MemberConflict } from './member-store.mjs';
import { DAYMAIL_POLICY_VERSION, DAYMAIL_TEXT, ACCOUNT_POLICY_VERSION, cleanEnergyProfile, cleanSubscription } from '../src/member-schema.mjs';
import { localDate, addDays } from '../src/api.mjs';
import { dueEdition, makeDayPlan } from './dayplan.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>timingSafeEqual(Buffer.from(digest(String(a))),Buffer.from(digest(String(b))));
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const clock=value=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const euro=value=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(value);
function emailAddress(value) {
  if (typeof value!=='string'||value.length>254) return null;
  const parts=value.trim().split('@');if(parts.length!==2)return null;
  const [local,domain]=parts,ascii=domainToASCII(domain).toLowerCase();
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/.test(local)||local.startsWith('.')||local.endsWith('.')||local.includes('..')||!ascii.includes('.')||ascii.split('.').some(l=>! /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l)))return null;
  return `${local}@${ascii}`;
}
const allowKeys=(body,allowed)=>body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>allowed.includes(k));
function emailFrame(title,content,footer='') {
  return `<!doctype html><html lang="nl"><meta charset="utf-8"><body style="margin:0;background:#F8FBFF;color:#031A37;font:16px Arial,sans-serif"><main style="max-width:560px;margin:24px auto;padding:28px;background:white;border:1px solid #dce5f3;border-radius:20px"><p style="color:#0765F1;font-weight:bold">Zonlio</p><h1 style="font-size:26px">${esc(title)}</h1>${content}<hr style="border:0;border-top:1px solid #dce5f3"><p style="font-size:12px;color:#526585">Zonlio is een dienst van ${esc(OPERATOR.name)}. ${esc(OPERATOR.street)}, ${esc(OPERATOR.postcode)} ${esc(OPERATOR.city)}. KvK ${OPERATOR.kvk}. ${footer}</p></main></body></html>`;
}
export function createMemberService({env,store,auth,mail,market,now=()=>Date.now(),onQueued=()=>{}}) {
  const repository=store?.members;
  const production=env.NODE_ENV==='production';
  const secret=auth.fingerprint('member-service','v1');
  const sign=(purpose,id)=>createHmac('sha256',secret).update(`${purpose}:${id}`).digest('base64url');
  const tokenFor=(id,purpose)=>`${id}.${sign(purpose,id)}`;
  const validToken=(token,purpose)=>{if(typeof token!=='string'||token.length>100)return null;const [id,sig,rest]=token.split('.');return !rest&&UUID.test(id||'')&&same(sig,sign(purpose,id))?id:null;};
  const cookieName=production?'__Host-zonlio_member':'zonlio_member';
  const cookie=(value,age)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${production?'; Secure':''}`;
  const sessionLength=7*86400000;
  let publicOrigin='https://zonlio.nl',originValid=true;
  try { const u=new URL(env.PUBLIC_URL||env.APP_URL||publicOrigin);if(u.username||u.password||(production&&u.protocol!=='https:')||!['http:','https:'].includes(u.protocol))throw new Error();publicOrigin=u.origin; }catch{originValid=false;}
  const limit=Number(env.SMTP_DAILY_LIMIT||0),limitValid=Number.isInteger(limit)&&limit>0&&limit<=100;
  const operator=operatorConfiguration(env);
  const ready=Boolean(repository&&auth.secretConfigured&&mail.configured&&operator.confirmed&&originValid&&limitValid&&(!production||auth.configured));
  const accountsEnabled=ready&&env.MEMBER_ACCOUNTS_ENABLED==='true';
  const subscriptionsEnabled=ready&&env.DAYMAIL_SIGNUP_ENABLED==='true';
  const dailySendEnabled=ready&&env.DAYMAIL_SEND_ENABLED==='true';
  const ownerAcceptanceAddress=emailAddress(env.ADMIN_EMAIL)?.toLowerCase()||null;
  const isOwnerAcceptanceContext=context=>{
    const challenge=context?.challenge;
    return Boolean(ownerAcceptanceAddress&&challenge?.purpose==='login'
      && emailAddress(challenge.email)?.toLowerCase()===ownerAcceptanceAddress
      && challenge.payload_json==='{"ownerAcceptance":true}');
  };
  const config=()=>({accountsEnabled,subscriptionsEnabled,dailySendEnabled,policyVersion:DAYMAIL_POLICY_VERSION,policyText:DAYMAIL_TEXT,
    accountVersion:ACCOUNT_POLICY_VERSION,editions:['evening','morning'],note:'Avond: vanaf 18:00 voor morgen; ochtend: vanaf 07:00 voor vandaag. Alleen met beschikbare prijzen. Geen automatische apparaatsturing.'});
  const router=express.Router();
  function origin(req,res,next) {
    if(!auth.originAllowed(req))return res.status(403).json({error:'Gebruik de Zonlio-website.'});
    if(!req.is('application/json'))return res.status(415).json({error:'Gebruik een JSON-verzoek.'});next();
  }
  function available(kind) {return (_req,res,next)=>{if(!(kind==='login'?accountsEnabled:subscriptionsEnabled))return res.status(503).json({error:'Deze dienst is nog niet geactiveerd. Er is niets verzonden.'});next();};}
  function readCookie(req) {
    const part=(req.headers.cookie||'').split(';').map(p=>p.trim()).find(p=>p.startsWith(`${cookieName}=`));
    const [token,sig,extra]=(part?.slice(cookieName.length+1)||'').split('.');
    if(extra||! /^[A-Za-z0-9_-]{43}$/.test(token||'')||!same(sig,sign('session',token)))return null;return token;
  }
  async function session(req) {const token=readCookie(req);if(!token||!repository)return null;const m=await repository.session(digest(token));return m?{member:m,token,csrf:sign('csrf',token)}:null;}
  async function memberRequired(req,res,next) {
    req.memberSession=await session(req);if(!req.memberSession)return res.status(401).json({error:'Log in op Mijn Zonlio.'});next();
  }
  function csrf(req,res,next) {if(!auth.originAllowed(req)||!same(req.headers['x-csrf-token'],req.memberSession.csrf))return res.status(403).json({error:'Vernieuw je sessie en probeer opnieuw.'});next();}
  async function requestChallenge(req,res,purpose) {
    if(!allowKeys(req.body,purpose==='login'?['email','website']:['email','website','profile','edition','consent','policyVersion']))return res.status(422).json({error:'Controleer de ingevoerde velden.'});
    const email=emailAddress(req.body.email);if(!email)return res.status(422).json({error:'Vul een geldig e-mailadres in.'});
    if(req.body.website)return res.status(202).json({ok:true,message:'Controleer je inbox wanneer het verzoek kan worden verwerkt.'});
    if(!auth.limiter.take(`member-request:${auth.requestKey(req)}`,10,15*60000))return res.status(429).json({error:'Probeer het over enkele minuten opnieuw.'});
    let payload={};
    if(purpose==='subscribe') {
      if(req.body.consent!==true||req.body.policyVersion!==DAYMAIL_POLICY_VERSION||!['evening','morning'].includes(req.body.edition))return res.status(422).json({error:'Kies je editie en bevestig de dagplanservice.'});
      payload={profile:cleanEnergyProfile(req.body.profile),edition:req.body.edition};
      if(!payload.profile.devices.length)return res.status(422).json({error:'Kies ten minste één apparaat voor je dagplan.'});
    }
    const queued=await repository.queueChallenge({purpose,email,payload,tokenFor});
    res.status(202).json({ok:true,message:'Controleer je inbox wanneer het verzoek kan worden verwerkt. Een nieuwe aanvraag kan tijdelijk begrensd zijn.'});
    if(queued)onQueued();
  }
  // Called ONLY from the authenticated admin/CSRF route; the public login gate is unchanged.
  async function requestOwnerAcceptanceLogin() {
    if(!ready||!auth.configured||!ownerAcceptanceAddress)return {enabled:false,queued:false};
    const queued=await repository.queueChallenge({purpose:'login',
      email:ownerAcceptanceAddress,payload:{ownerAcceptance:true},tokenFor});
    if(queued)onQueued();
    return {enabled:true,queued};
  }
  router.get('/config',(_req,res)=>res.json(config()));
  router.post('/login',origin,available('login'),(req,res)=>requestChallenge(req,res,'login'));
  router.post('/subscribe',origin,available('subscribe'),(req,res)=>requestChallenge(req,res,'subscribe'));
  router.post('/verify',origin,async(req,res)=>{
    if(!repository||!allowKeys(req.body,['token'])||!auth.limiter.take(`member-verify:${auth.requestKey(req)}`,30,15*60000))return res.status(400).json({error:'De link kan niet worden bevestigd.'});
    const token=req.body.token;
    const purpose=validToken(token,'login')?'login':validToken(token,'subscribe')?'subscribe':null;
    const ownerAcceptance=purpose==='login'&&!accountsEnabled
      &&await repository.isOwnerAcceptanceChallenge(digest(token),ownerAcceptanceAddress);
    if(!purpose||!(purpose==='login'?(accountsEnabled||ownerAcceptance):subscriptionsEnabled))return res.status(400).json({error:'Deze link is ongeldig, verlopen of de dienst is gepauzeerd.'});
    const sessionToken=randomBytes(32).toString('base64url');
    const result=await repository.consumeChallenge({tokenHash:digest(token),sessionHash:digest(sessionToken),sessionExpires:new Date(now()+sessionLength).toISOString(),emptyProfile:cleanEnergyProfile({}),accountVersion:ACCOUNT_POLICY_VERSION,daymailVersion:DAYMAIL_POLICY_VERSION,daymailText:DAYMAIL_TEXT});
    if(!result)return res.status(400).json({error:'Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.'});
    if(result.purpose==='login')res.setHeader('Set-Cookie',cookie(`${sessionToken}.${sign('session',sessionToken)}`,sessionLength/1000));
    res.json({ok:true,purpose:result.purpose,message:result.purpose==='login'?'Je bent ingelogd.':'Je dagplaninschrijving is bevestigd. Dit is geen verkoopaanvraag.'});
  });
  router.get('/session',async(req,res)=>{const s=await session(req);res.json(s?{authenticated:true,email:s.member.email,csrfToken:s.csrf}:{authenticated:false});});
  router.post('/logout',memberRequired,csrf,async(req,res)=>{await repository.revokeSession(digest(req.memberSession.token));res.setHeader('Set-Cookie',cookie('',0)).status(204).end();});
  router.get('/profile',memberRequired,async(req,res)=>res.json(await repository.get(req.memberSession.member.id)));
  router.get('/plan',memberRequired,async(req,res)=>{
    if(!['today','tomorrow'].includes(req.query.day)||!market)return res.status(422).json({error:'Kies vandaag of morgen.'});
    const date=addDays(localDate(now()),req.query.day==='tomorrow'?1:0);
    const raw=await market.getDay(date);
    if(raw.date!==date)return res.json({status:'unavailable'});
    res.json(makeDayPlan(raw,req.memberSession.member.profile,now()));
  });
  router.put('/profile',origin,memberRequired,csrf,async(req,res)=>{
    if(!allowKeys(req.body,['profile','expectedRevision'])||!Number.isSafeInteger(req.body.expectedRevision)||req.body.expectedRevision<0)return res.status(422).json({error:'Ongeldige profielversie.'});
    const m=await repository.saveProfile(req.memberSession.member.id,cleanEnergyProfile(req.body.profile),req.body.expectedRevision);res.json({ok:true,member:m});
  });
  router.put('/subscription',origin,memberRequired,csrf,async(req,res)=>{
    if(!allowKeys(req.body,['choice','expectedRevision','consent','policyVersion'])||!Number.isSafeInteger(req.body.expectedRevision)||req.body.expectedRevision< -1)return res.status(422).json({error:'Ongeldige abonnementsversie.'});
    const choice=cleanSubscription(req.body.choice);
    if(choice.status==='active'&&(!subscriptionsEnabled||req.body.consent!==true||req.body.policyVersion!==DAYMAIL_POLICY_VERSION))return res.status(422).json({error:'Bevestig de beschikbare dagplanservice.'});
    if(choice.status==='active'&&req.memberSession.member.deliveryBlocked)return res.status(422).json({error:'Voor dit adres geldt een verzendstop. Neem contact op met info@zonlio.nl als je hulp nodig hebt.'});
    if(choice.status==='active'&&!req.memberSession.member.profile.devices.length)return res.status(422).json({error:'Sla eerst minstens één apparaat op in je profiel.'});
    const result=await repository.setSubscription(req.memberSession.member.id,choice,req.body.expectedRevision,DAYMAIL_POLICY_VERSION,DAYMAIL_TEXT);res.json({ok:true,subscription:result});
  });
  router.get('/export',memberRequired,async(req,res)=>res.setHeader('Content-Disposition','attachment; filename="mijn-zonlio.json"').json(await repository.exportMember(req.memberSession.member.id)));
  router.delete('/profile',origin,memberRequired,csrf,async(req,res)=>{
    if(req.body?.confirm!=='DELETE_MY_ZONLIO')return res.status(422).json({error:'Bevestig het verwijderen van je Mijn Zonlio-profiel.'});
    await repository.deleteMember(req.memberSession.member.id);res.setHeader('Set-Cookie',cookie('',0)).json({ok:true,message:'Profiel, abonnementen en sessies zijn verwijderd. Een beperkt bewijs van je verwijderkeuze en een eventuele verzendstop blijven bewaard, zodat je keuze ook bij herstel wordt gerespecteerd. Een afzonderlijke woningadviesaanvraag wordt hiermee niet verwijderd; neem daarvoor contact op met info@zonlio.nl.'});
  });
  router.post('/unsubscribe',origin,async(req,res)=>{
    const id=validToken(req.body?.token,'unsubscribe');if(!id||!repository)return res.status(400).json({error:'Ongeldige afmeldlink.'});
    await repository.unsubscribe(id,DAYMAIL_POLICY_VERSION,DAYMAIL_TEXT);res.json({ok:true,message:'Je ontvangt geen Zonlio-dagplannen meer. Je account en afzonderlijke adviesaanvraag blijven ongewijzigd.'});
  });
  router.get('/one-click',(_req,res)=>res.status(405).set('Allow','POST').json({error:'Gebruik de afmeldactie in je mail of het voorkeurencentrum.'}));
  router.post('/one-click',express.text({type:['application/x-www-form-urlencoded','multipart/form-data'],limit:'2kb'}),async(req,res)=>{
    // A narrowly scoped, signed stop token. No login cookie and no GET side effect.
    const id=validToken(req.query.token,'unsubscribe');const body=req.body;
    const formEncoded=typeof body==='string'&&req.is('application/x-www-form-urlencoded')&&new URLSearchParams(body).get('List-Unsubscribe')==='One-Click';
    const multipart=typeof body==='string'&&req.is('multipart/form-data')&&/name="List-Unsubscribe"\r?\n\r?\nOne-Click\r?\n/.test(body);
    if(!id||!repository||(!formEncoded&&!multipart))return res.status(400).json({error:'Ongeldige afmelding.'});
    await repository.unsubscribe(id,DAYMAIL_POLICY_VERSION,DAYMAIL_TEXT);res.status(204).end();
  });
  router.use((error,_req,res,next)=>{
    if(error instanceof MemberConflict)return res.status(409).json({error:error.message});
    if(error instanceof TypeError)return res.status(422).json({error:error.message});next(error);
  });
  function messageFor(item,context) {
    let title,text,html,headers={}; let to;
    if(context.challenge) {
      const c=context.challenge;to=c.email;const link=`${publicOrigin}/mijn#bevestig=${tokenFor(c.id,c.purpose)}`;
      const ownerAcceptance=isOwnerAcceptanceContext(context);
      title=c.purpose==='login'?(ownerAcceptance?'[TEST] Open jouw Mijn Zonlio':'Open jouw Mijn Zonlio'):'Bevestig jouw Zonlio-dagplan';
      const requested=c.purpose==='subscribe'?JSON.parse(c.payload_json):null;
      const preferences=requested?` Je koos de ${requested.edition==='morning'?'ochtend':'avond'}editie, ${requested.profile.devices.map(id=>({washing:'wasmachine',dishwasher:'vaatwasser',car:'elektrische auto'})[id]).join(', ')} en het venster ${requested.profile.startHour}:00–${requested.profile.endHour}:00. Bij een bestaand inactief abonnement worden deze apparaatkeuzes bijgewerkt; je bewaarde contracttarieven blijven behouden. Een actief abonnement verandert niet door deze inschrijving.`:'';
      const explanation=c.purpose==='login'
        ?`Deze eenmalige inloglink is 15 minuten geldig. Open de link en bevestig de actie.${ownerAcceptance?' Dit is een gecontroleerde eigenaarstest; publieke accounts blijven uitgeschakeld.':''}`:`Bevestig met de knop op de website dat je het gekozen dagplan wilt ontvangen. De link is 24 uur geldig. Dit is geen toestemming voor verkooptelefoontjes of aanbiedingen.${preferences}`;
      text=`${title}\n\n${explanation}\n\n${link}\n\nNiet zelf aangevraagd? Negeer deze mail. Er verandert niets zonder bevestiging.\n\nZonlio — ${OPERATOR.name}\n${OPERATOR.street}, ${OPERATOR.postcode} ${OPERATOR.city}\nKvK ${OPERATOR.kvk} · ${OPERATOR.email}`;
      html=emailFrame(title,`<p>${esc(explanation)}</p><p><a style="display:inline-block;background:#0765F1;color:white;padding:14px 20px;border-radius:12px;text-decoration:none" href="${esc(link)}">${c.purpose==='login'?'Open Mijn Zonlio':'Bevestig mijn dagplan'}</a></p><p>Niet zelf aangevraagd? Negeer deze mail.</p>`);
    } else {
      to=context.member.email;const plan=JSON.parse(item.payload_json).plan;title=`Jouw Zonlio-dagplan · ${plan.date}`;
      const token=tokenFor(context.member.id,'unsubscribe');const stop=`${publicOrigin}/mijn#afmelden=${token}`;
      headers={'List-Unsubscribe':`<${publicOrigin}/api/member/one-click?token=${encodeURIComponent(token)}>`, 'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'};
      const lines=plan.plans.map(p=>`${p.name}: ${clock(p.start)}–${clock(p.end)} · ${euro(p.cost)} · ${p.energyKwh} kWh (aanname)`);
      text=`${title}\n\n${plan.basisLabel}\n${lines.join('\n')}\n\n${plan.limitations}\nBekijk je profiel: ${publicOrigin}/mijn\n\nBron: ${plan.source.attribution}; ${plan.source.license}.\nAfmelden: ${stop}\nZonlio — ${OPERATOR.name}\n${OPERATOR.street}, ${OPERATOR.postcode} ${OPERATOR.city}\nKvK ${OPERATOR.kvk} · ${OPERATOR.email}`;
      html=emailFrame(title,`<p>${esc(plan.basisLabel)}</p>${lines.map(line=>`<p style="padding:16px;background:#F8FBFF;border-radius:12px">${esc(line)}</p>`).join('')}<p>${esc(plan.limitations)}</p><p><a href="${publicOrigin}/mijn">Bekijk mijn profiel en voorkeuren</a></p><p style="font-size:12px">Bron: ${esc(plan.source.attribution)}; ${esc(plan.source.license)}.</p>`,`<a href="${esc(stop)}">Afmelden voor dagplannen</a>`);
    }
    return {from:{name:'Zonlio',address:env.SMTP_USER||OPERATOR.email},replyTo:OPERATOR.email,to,subject:title,text,html,headers,messageId:`<zonlio.member.${item.id}@zonlio.nl>`,disableFileAccess:true,disableUrlAccess:true};
  }
  async function processMail({limit:batchLimit=3}={}) {
    if(mail.paused)return {enabled:false,reason:'paused',accepted:0};
    if(!ready)return {enabled:false,accepted:0};
    const result={enabled:true,accepted:0,cancelled:0,failed:0,deferred:0};
    const ownerOnly=!accountsEnabled&&!subscriptionsEnabled&&!dailySendEnabled;
    const items=ownerOnly
      ?await repository.claimOwnerAcceptanceMail(ownerAcceptanceAddress,batchLimit)
      :await repository.claimMail(batchLimit);
    for(const item of items) {
      let targetEmail;
      try {
        let context=await repository.mailContext(item);
        if(!context||(item.kind==='login'&&!accountsEnabled&&!isOwnerAcceptanceContext(context))||(item.kind==='subscribe'&&!subscriptionsEnabled)||(item.kind==='daily'&&!dailySendEnabled)) {await repository.finishMail(item,'cancelled','SERVICE_PAUSED');result.cancelled++;continue;}
        if(item.kind==='daily') {
          const payload=JSON.parse(item.payload_json);
          if(!context.member||context.member.deliveryBlocked||context.subscription?.status!=='active'||context.member.revision!==payload.profileRevision||context.subscription.revision!==payload.subscriptionRevision) {await repository.finishMail(item,'cancelled','PREFERENCES_CHANGED');result.cancelled++;continue;}
        }
        if(!await repository.reserveBudget(item.kind,limit)) {await repository.deferMail(item);result.deferred++;continue;}
        context=await repository.mailContext(item); // Check withdrawal and expiry immediately before handing to SMTP.
        if(!context||(item.kind==='login'&&!accountsEnabled&&!isOwnerAcceptanceContext(context))||(item.kind==='daily'&&(!context.member||context.member.deliveryBlocked||context.subscription?.status!=='active'||context.member.revision!==JSON.parse(item.payload_json).profileRevision||context.subscription.revision!==JSON.parse(item.payload_json).subscriptionRevision))) {await repository.finishMail(item,'cancelled','CONSENT_CHANGED');result.cancelled++;continue;}
        targetEmail=context.challenge?.email||context.member?.email;
        const sent=await mail.sendService(messageFor(item,context));
        if(sent?.rejected?.length||!sent?.accepted?.length)throw Object.assign(new Error('SMTP_NOT_ACCEPTED'),{code:'EENVELOPE'});
        await repository.finishMail(item,'accepted');result.accepted++;
      } catch(error) {
        const code=['EAUTH','ECONNECTION','ETIMEDOUT','ESOCKET','EDNS','EENVELOPE','EMESSAGE'].includes(error?.code)?error.code:'SMTP_ERROR';
        // A confirmed non-existent mailbox, not an arbitrary 5.7.x policy rejection.
        if(targetEmail&&/\b5\.1\.[01]\b/.test(String(error?.response||'')))await repository.suppressEmail(targetEmail,'hard_bounce');
        await repository.finishMail(item,'retry',code);result.failed++;
      }
    }
    return result;
  }
  async function scheduleDaily() {
    if(mail.paused)return {enabled:false,queued:0,status:'paused'};
    if(!dailySendEnabled||!market)return {enabled:false,queued:0};
    const due=dueEdition(now());if(!due)return {enabled:true,queued:0,status:'outside_window'};
    const lease=await repository.acquireTask('scheduler');if(!lease)return {enabled:true,queued:0,status:'busy'};
    let result={enabled:true,queued:0,date:due.date,status:'running'};
    try {
      const subscribers=await repository.dueSubscribers(due.edition,due.date);
      if(!subscribers.length){result.status='nothing_due';return result;}
      let data=await repository.priceSnapshot(due.date);
      if(!data) {data=await market.getDay(due.date);if(data.status==='available'&&!data.stale)await repository.savePriceSnapshot(due.date,data);}
      if(data.status!=='available'||data.stale||data.date!==due.date){result.status='source_unavailable';return result;}
      for(const row of subscribers) {
        const plan=makeDayPlan(data,JSON.parse(row.profile_json),now());
        if(plan.status==='unavailable'){result.status='source_unavailable';return result;}
        const saved=await repository.queuePlan(row,due.date,plan);result.queued+=saved.changes?1:0;
      }
      result.status='complete';
      return result;
    } catch(error) {result.status='failed';throw error;
    } finally {await repository.finishTask('scheduler',lease,result);}
  }
  async function maintenance() {
    if(!repository)return {enabled:false};
    const lease=await repository.acquireTask('maintenance',180);if(!lease)return {status:'busy'};
    let result;
    try {const schedule=await scheduleDaily();const sent=await processMail();await repository.cleanup();result={schedule,sent};return result;}
    finally {await repository.finishTask('maintenance',lease,result||{status:'failed'});}
  }
  return {router,config,processMail,maintenance,repository,tokenFor,requestOwnerAcceptanceLogin};
}
