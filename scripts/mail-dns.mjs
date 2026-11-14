import { Resolver } from 'node:dns/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAIL_DOMAIN = 'zonlio.nl';
// Hostinger's published default selectors; no guessed selectors or account access.
export const HOSTINGER_DKIM = Object.freeze(['a','b','c'].map(letter=>({
  selector:`hostingermail-${letter}`,
  hostname:`hostingermail-${letter}._domainkey.${MAIL_DOMAIN}`,
  expectedTarget:`hostingermail-${letter}.dkim.mail.hostinger.com`,
})));
const ERRORS = new Set(['ENODATA','ENOTFOUND','ESERVFAIL','EREFUSED','ECONNREFUSED','ETIMEOUT','ECANCELLED']);
const host = value => typeof value==='string'&&value.length<=254&&/^[a-z0-9._-]+\.?$/i.test(value)?value.toLowerCase().replace(/\.$/,''):null;
const txtValues = records => Array.isArray(records)?records.slice(0,30).filter(row=>Array.isArray(row)&&row.every(value=>typeof value==='string')).map(row=>row.join('')).filter(value=>value.length<=8192):[];
function tags(value) {
  const result={};let duplicate=false;
  for(const part of value.split(';')) {
    const match=part.trim().match(/^([a-z][a-z0-9]*)\s*=\s*(.*)$/i);
    if(!match)continue;
    const key=match[1].toLowerCase();if(Object.hasOwn(result,key))duplicate=true;
    result[key]=match[2].trim();
  }
  return {values:result,duplicate};
}
/** Only projected public mail settings; never print unrelated TXT verification tokens or report mailboxes. */
export function summarizeSpf(records) {
  const candidates=txtValues(records).filter(value=>/^v=spf1(?:\s|$)/i.test(value));
  const tokens=candidates.length===1?candidates[0].trim().split(/\s+/):[];
  const all=tokens.find(value=>/^[+~?-]?all$/i.test(value))?.toLowerCase();
  return {status:!candidates.length?'not_found':candidates.length>1?'multiple_records':'observed',recordsFound:candidates.length,
    hostingerIncludeDirect:tokens.some(value=>/^\+?include:_spf\.mail\.hostinger\.com\.?$/i.test(value)),
    allPolicy:all?all.toLowerCase():null,redirectPresent:tokens.some(value=>/^redirect=/i.test(value)),
    unrestrictedAll:all==='all'||all==='+all',fullSpfEvaluation:false};
}
export function summarizeDmarc(records) {
  const candidates=txtValues(records).filter(value=>/^v=DMARC1(?:;|\s|$)/i.test(value));
  if(candidates.length!==1)return {status:candidates.length?'multiple_records':'not_found',recordsFound:candidates.length};
  const parsed=tags(candidates[0]),values=parsed.values;
  const policy=['none','quarantine','reject'].includes(values.p)?values.p:null;
  const percentage=values.pct===undefined?100:/^\d{1,3}$/.test(values.pct)&&Number(values.pct)<=100?Number(values.pct):null;
  return {status:policy&&!parsed.duplicate&&percentage!==null?'observed':'needs_review',recordsFound:1,policy,percentage,
    subdomainPolicy:['none','quarantine','reject'].includes(values.sp)?values.sp:null,
    dkimAlignment:['r','s'].includes(values.adkim)?values.adkim:values.adkim===undefined?'r':null,
    spfAlignment:['r','s'].includes(values.aspf)?values.aspf:values.aspf===undefined?'r':null,
    aggregateReportsConfigured:Boolean(values.rua),failureReportsConfigured:Boolean(values.ruf),duplicateTags:parsed.duplicate,
    messageAlignmentVerified:false};
}
function summarizeDkimKey(records) {
  const candidates=txtValues(records).map(value=>tags(value)).filter(parsed=>parsed.values.v==='DKIM1'||Object.hasOwn(parsed.values,'p'));
  if(candidates.length!==1)return {status:candidates.length?'multiple_records':'not_found',keyPublished:false};
  const {values,duplicate}=candidates[0];
  const keyPublished=!duplicate&&typeof values.p==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(values.p.replace(/\s/g,''));
  return {status:keyPublished?'observed':'empty_or_unusable_key',keyPublished,keyType:values.k==='ed25519'?'ed25519':!values.k||values.k==='rsa'?'rsa':null,signatureVerified:false};
}
async function query(resolver,method,name) {
  try {return {status:'answered',records:await resolver[method](name)};}
  catch(error) {const code=ERRORS.has(error?.code)?error.code:'DNS_LOOKUP_FAILED';return {status:['ENODATA','ENOTFOUND'].includes(code)?'not_found':'lookup_failed',code};}
}
const failed = response => ({status:response.status,code:response.code});

/** Fixed public DNS queries only. Uses the environment resolver, with no server override or credentials. */
export async function observeMailDns({resolver=new Resolver({timeout:3000,tries:1}),now=Date.now}={}) {
  const [mxResult,spfResult,dmarcResult,...cnameResults]=await Promise.all([
    query(resolver,'resolveMx',MAIL_DOMAIN),query(resolver,'resolveTxt',MAIL_DOMAIN),query(resolver,'resolveTxt',`_dmarc.${MAIL_DOMAIN}`),
    ...HOSTINGER_DKIM.map(record=>query(resolver,'resolveCname',record.hostname)),
  ]);
  const mxRecords=mxResult.status==='answered'&&Array.isArray(mxResult.records)?mxResult.records.slice(0,20).filter(row=>Number.isInteger(row.priority)&&row.priority>=0&&row.priority<=65535&&host(row.exchange)).map(row=>({priority:row.priority,exchange:host(row.exchange)})).sort((a,b)=>a.priority-b.priority||a.exchange.localeCompare(b.exchange)):[];
  const mx=mxResult.status==='answered'?{status:mxRecords.length?'observed':'not_found',records:mxRecords,
    defaultHostingerExchangesObserved:['mx1.hostinger.com','mx2.hostinger.com'].every(exchange=>mxRecords.some(row=>row.exchange===exchange))}:failed(mxResult);
  const spf=spfResult.status==='answered'?summarizeSpf(spfResult.records):failed(spfResult);
  const dmarc=dmarcResult.status==='answered'?summarizeDmarc(dmarcResult.records):failed(dmarcResult);
  const dkim=await Promise.all(HOSTINGER_DKIM.map(async(record,index)=>{
    const answer=cnameResults[index];
    const targets=answer.status==='answered'&&Array.isArray(answer.records)?answer.records.slice(0,5).map(host).filter(Boolean):[];
    const expectedTargetObserved=targets.length===1&&targets[0]===record.expectedTarget;
    const keyResult=expectedTargetObserved?await query(resolver,'resolveTxt',record.expectedTarget):null;
    return {...record,cname:answer.status==='answered'?{status:targets.length?'observed':'not_found',targets}:failed(answer),expectedTargetObserved,
      key:keyResult?(keyResult.status==='answered'?summarizeDkimKey(keyResult.records):failed(keyResult)):{status:'not_checked'},
      receivedSignatureVerified:false};
  }));
  const lookupFailures=[mx,spf,dmarc,...dkim.flatMap(record=>[record.cname,record.key])].filter(result=>result.status==='lookup_failed').length;
  return {checkedAt:new Date(now()).toISOString(),domain:MAIL_DOMAIN,scope:'Read-only publieke DNS-waarneming; geen DNS-wijziging, SMTP-verzending of mailboxinspectie.',
    lookupFailures,mx,spf,dmarc,dkim,
    defaultHostingerRecordsObserved:Boolean(mx.defaultHostingerExchangesObserved&&spf.status==='observed'&&spf.hostingerIncludeDirect&&!spf.unrestrictedAll&&dmarc.status==='observed'&&dkim.every(record=>record.expectedTargetObserved&&record.key.keyPublished)),
    authenticationResultsVerified:false,receivedDkimSignatureVerified:false,unsubscribeHeadersVerified:false,inboxDeliveryVerified:false,
    limitations:['Dit is geen volledige SPF-evaluatie of DMARC/DKIM-validatie van een werkelijk ontvangen bericht.','Een ontbrekende standaardselector sluit een andere, bewust geconfigureerde DKIM-selector niet uit.','Rapportmailboxen, overige TXT-records en volledige publieke DKIM-sleutels worden niet afgedrukt.','Een lookup_failed betekent ontbrekend bewijs uit deze resolver, geen bewezen ontbrekend DNS-record.']};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {console.log(JSON.stringify(await observeMailDns(),null,2));}
  catch {console.log(JSON.stringify({domain:MAIL_DOMAIN,error:'MAIL_DNS_OBSERVATION_FAILED',authenticationResultsVerified:false,inboxDeliveryVerified:false}));process.exitCode=1;}
}
