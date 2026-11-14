import { calendarDay } from './store.mjs';
import { OPERATOR } from './operator.mjs';

export const OPS_LABELS = Object.freeze({
  price_source:'Stroomprijzen ontbreken of zijn verouderd', weather_source:'Weerbron ontbreekt of is verouderd',
  cron_overdue:'Onderhoud is niet recent succesvol uitgevoerd', lead_queue:'Aanvraagmail wacht langer dan 30 minuten',
  member_queue:'Account- of dagmail wacht langer dan 30 minuten', mail_failures:'E-mailverwerking vraagt aandacht',
  mail_budget:'Uitgaand appbudget is niet ingesteld of bijna vol', lead_followup:'Er staan onbehandelde of achterstallige aanvragen',
  portal_backlog:'De geactiveerde Portal-overdracht loopt achter',
});
const old = (date,now,ms) => Boolean(date && now-Date.parse(date)>ms);

export function createOperations({env={},store,mail,market,weather,now=Date.now}) {
  const flags=['LEAD_ENABLED','HOUSING_ADVICE_ENABLED','MEMBER_ACCOUNTS_ENABLED','DAYMAIL_SIGNUP_ENABLED','DAYMAIL_SEND_ENABLED'];
  const cronExpected=env.OPS_EXPECT_CRON==='true'||flags.some(key=>env[key]==='true');
  const quota=Number(env.SMTP_DAILY_LIMIT||0);
  const budgetValid=Number.isInteger(quota)&&quota>0&&quota<=100;
  const alertRecipient=(env.OPS_ALERT_TO||env.ADMIN_EMAIL||OPERATOR.email).trim();
  const alertsEnabled=env.OPS_ALERTS_ENABLED==='true'&&/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(alertRecipient);

  async function warmSources() {
    // Uses the shared adapters and their throttles; never one upstream call per subscriber.
    const results=await Promise.allSettled([market?.getDay(calendarDay(now())),weather?.getRegion('leiden')]);
    return {prices:results[0].status==='fulfilled'?results[0].value?.status||'not_configured':'unavailable',weather:results[1].status==='fulfilled'?results[1].value?.status||'not_configured':'unavailable'};
  }
  async function snapshot() {
    const [ops,leadMail,members,sales,portal]=await Promise.all([store.operations.summary(),store.mailStats(),store.members.stats(),store.stats(7),store.portalStats()]);
    const sources={prices:market?.getStatus?.()||null,weather:weather?.getStatus?.()||null};
    const cronStatus=!cronExpected?'not_required':!ops.lastSuccessAt?'never_run':old(ops.lastSuccessAt,now(),15*60000)?'overdue':'current';
    const used=members.reservedAttempts24h;
    const checks=[
      {code:'price_source',problem:Boolean(sources.prices&&(sources.prices.status!=='ready'||old(sources.prices.lastSuccessAt,now(),45*60000)))},
      {code:'weather_source',problem:Boolean(sources.weather&&(sources.weather.status!=='ready'||old(sources.weather.lastSuccessAt,now(),24*3600000)))},
      {code:'cron_overdue',problem:cronExpected&&cronStatus!=='current'},
      {code:'lead_queue',problem:old(leadMail.oldestPendingAt,now(),30*60000)},
      {code:'member_queue',problem:old(members.oldestPendingAt,now(),30*60000)},
      {code:'mail_failures',problem:leadMail.failed>0||(members.mail?.failed||0)>0},
      {code:'mail_budget',problem:cronExpected&&(!budgetValid||used>=Math.floor(quota*.8))},
      {code:'lead_followup',problem:(sales.workload?.due||0)>0||(sales.workload?.unassigned||0)>0||(sales.workload?.unhandled||0)>0},
      {code:'portal_backlog',problem:env.PORTAL_EXPORT_ENABLED==='true'&&portal.pendingAgeSeconds>3600},
    ];
    return {...ops,cronExpected,cronStatus,alertsEnabled,mailPaused:mail.paused===true,budget:{limit:budgetValid?quota:0,used,remaining:budgetValid?Math.max(0,quota-used):0,dailyCeiling:budgetValid?Math.floor(quota*.8):0,scope:'Alle Zonlio-pogingen per rollende 24 uur; exclusief webmail en andere apps.'},checks:checks.map(check=>({...check,label:OPS_LABELS[check.code]})),sources};
  }
  async function inspectAndNotify() {
    const report=await snapshot();
    await store.operations.recordChecks(report.checks);
    if(!alertsEnabled||!mail.configured||mail.paused||!budgetValid)return {recorded:true,notified:false};
    const digest=await store.operations.claimAlertDigest();
    if(!digest)return {recorded:true,notified:false};
    let accepted=false;
    try {
      if(!await store.members.reserveBudget('operations',quota))return {recorded:true,notified:false,reason:'budget'};
      const text=['Zonlio beheer vraagt aandacht.',...digest.codes.map(code=>`- ${OPS_LABELS[code]}`),'','Open https://zonlio.nl/admin voor actuele status en opvolging.','Dit bericht bevat geen klantgegevens. Een alert bewijst geen inboxaflevering.'].join('\n');
      const sent=await mail.sendService({from:{name:'Zonlio beheer',address:env.SMTP_USER||OPERATOR.email},to:alertRecipient,replyTo:OPERATOR.email,subject:'Zonlio · controleer het beheer',text,headers:{'Auto-Submitted':'auto-generated'},messageId:`<zonlio.ops.${digest.token}@zonlio.nl>`});
      accepted=sent?.accepted?.length===1&&!sent?.rejected?.length;
      return {recorded:true,notified:accepted};
    } catch { return {recorded:true,notified:false,reason:'smtp'}; }
    finally {await store.operations.finishAlertDigest(digest.token,accepted);}
  }
  return {warmSources,snapshot,inspectAndNotify,cronExpected,alertsEnabled};
}
