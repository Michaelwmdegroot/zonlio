export class ApiError extends Error {
  constructor(message, status=0, data={}) {
    super(message);
    this.name='ApiError';
    this.status=status;
    this.data=data;
  }
}

export async function api(path, {method='GET', body, headers={}, signal, timeout=25000}={}) {
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeout);
  try {
    const response=await fetch(path,{
      method,credentials:'same-origin',cache:'no-store',
      headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
      signal:controller.signal
    });
    const data=response.status===204?{}:await response.json().catch(()=>({}));
    if(!response.ok)throw new ApiError(data.error||data.message||'Dit lukt nu niet. Probeer het opnieuw.',response.status,data);
    return data;
  } catch(error) {
    if(error instanceof ApiError)throw error;
    throw new ApiError(error?.name==='AbortError'?'De verbinding duurt te lang. Probeer het opnieuw.':'Er is geen verbinding met Zonlio. Controleer je verbinding en probeer het opnieuw.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort',abort);
  }
}

const dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'});
const clockFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});

export function localDate(value=new Date()) {
  const p=Object.fromEntries(dateFormatter.formatToParts(new Date(value)).map(part=>[part.type,part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function addDays(date,days) {
  return new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
}
export function localHour(value) {
  const p=Object.fromEntries(clockFormatter.formatToParts(new Date(value)).map(part=>[part.type,part.value]));
  return Number(p.hour)+Number(p.minute)/60;
}
export function safeUrl(value) {
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}

export function normalizePrices(data) {
  if(!data||!['available','not_published','unavailable'].includes(data.status)||!/^\d{4}-\d{2}-\d{2}$/.test(data.date||''))throw new ApiError('De prijsbron gaf geen bruikbare gegevens terug.');
  if(data.status!=='available')return {...data,intervals:[]};
  if(!Array.isArray(data.intervals)||!data.intervals.length)throw new ApiError('De prijsbron bevat nog geen prijsintervallen.');
  let previousEnd=-Infinity;
  let contiguous=true;
  const intervals=data.intervals.map(item=>{
    const sourceStart=item.start??item.startISO;
    const start=Date.parse(sourceStart);
    if(!Number.isFinite(start)||!/(?:Z|[+-]\d{2}:\d{2})$/.test(sourceStart||'')||!Number.isFinite(item.durationMinutes)||item.durationMinutes<=0||item.durationMinutes>60||!Number.isFinite(item.marketEurMWh)||start<previousEnd)throw new ApiError('De prijsintervallen konden niet betrouwbaar worden verwerkt.');
    if(previousEnd!==-Infinity&&start!==previousEnd)contiguous=false;
    previousEnd=start+item.durationMinutes*60000;
    return {start:new Date(start).toISOString(),hour:localHour(start),durationMinutes:item.durationMinutes,market:item.marketEurMWh};
  });
  return {...data,intervals,contiguous};
}

// UTC hour buckets keep both occurrences of 02:00 on a 25-hour Dutch day.
// Source values contribute in proportion to their actual duration.
export function hourlySlots(intervals) {
  const buckets=new Map();
  for(const slot of intervals) {
    let cursor=Date.parse(slot.start);
    const end=cursor+slot.durationMinutes*60000;
    while(cursor<end) {
      const bucketStart=Math.floor(cursor/3600000)*3600000;
      const duration=(Math.min(end,bucketStart+3600000)-cursor)/60000;
      const bucket=buckets.get(bucketStart)||{weighted:0,duration:0};
      bucket.weighted+=slot.market*duration;
      bucket.duration+=duration;
      buckets.set(bucketStart,bucket);
      cursor+=duration*60000;
    }
  }
  return [...buckets].map(([start,bucket])=>({
    start:new Date(start).toISOString(),hour:localHour(start),
    durationMinutes:bucket.duration,market:bucket.weighted/bucket.duration
  }));
}

// Keep one Dutch delivery day and only intervals that have not started.
// Compare instants, not local clock labels: 02:00 can occur twice in autumn.
export function futurePriceSlots(slots,date,now=Date.now()) {
  const instant=now instanceof Date?now.getTime():now;
  if(!Array.isArray(slots)||!Number.isFinite(instant)||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return [];
  const today=localDate(instant);
  if(date<today)return [];
  return slots.filter(slot=>{
    const start=Date.parse(slot?.start);
    return Number.isFinite(start)&&localDate(start)===date&&(date>today||start>=instant);
  });
}
