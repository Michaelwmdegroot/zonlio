import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** An independent, read-only check can detect a stopped cron without invoking it. */
export async function observeOperations({origin='https://zonlio.nl',fetchImpl=fetch,now=Date.now}={}) {
  const url=new URL(origin);
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(url.origin==='https://zonlio.nl'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('UNSUPPORTED_ORIGIN');
  const result={checkedAt:new Date(now()).toISOString(),ok:false,scope:'Read-only bereikbaarheid, databaseleesproef en cronversheid; geen inbox-, restore- of accounttest.'};
  try {
    const response=await fetchImpl(`${url.origin}/api/health`,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','User-Agent':'Zonlio-Operations-Monitor/1.0'}});
    const text=await response.text();
    if(!response.ok||text.length>65536)throw new Error('HEALTH_UNAVAILABLE');
    const data=JSON.parse(text);
    const databaseReady=data.services?.databaseReady===true;
    const known=['not_required','never_run','overdue','current','unavailable'];
    const cronStatus=known.includes(data.operations?.cronStatus)?data.operations.cronStatus:'unavailable';
    const cronExpected=data.operations?.cronExpected===true;
    // Report the actual persisted heartbeat even while cron monitoring is not yet required.
    // This lets deployment observers distinguish an installed job from a configured-but-idle one.
    const rawLast=data.operations?.lastMaintenanceAt;
    const parsed=typeof rawLast==='string'?Date.parse(rawLast):NaN;
    const lastMaintenanceAt=Number.isFinite(parsed)?new Date(parsed).toISOString():null;
    const maintenanceRecorded=lastMaintenanceAt!==null;
    const maintenanceAgeMinutes=maintenanceRecorded?Math.max(0,Math.floor((now()-parsed)/60000)):null;
    const sourcesReady=!cronExpected||(data.sources?.prices?.status==='ready'&&data.sources?.weather?.status==='ready');
    return {...result,ok:data.ok===true&&databaseReady&&Boolean(data.operations)&&(!cronExpected||cronStatus==='current')&&sourcesReady,
      databaseReady,cronExpected,cronStatus,maintenanceRecorded,lastMaintenanceAt,maintenanceAgeMinutes,sourcesReady};
  } catch {return {...result,error:'HEALTH_UNAVAILABLE'};}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const result=await observeOperations();console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;
}
