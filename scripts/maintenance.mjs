import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function runMaintenance({env=process.env,fetchImpl=fetch}={}) {
  const secret=env.CRON_SECRET;
  if(typeof secret!=='string'||secret.length<32||secret===env.SESSION_SECRET)throw new Error('CRON_CONFIGURATION');
  const origin=new URL(env.PUBLIC_URL||env.APP_URL||'https://zonlio.nl');
  const local=env.NODE_ENV!=='production'&&origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname);
  if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||(!local&&origin.origin!=='https://zonlio.nl'))throw new Error('CRON_ORIGIN');
  if(env.PUBLIC_URL&&env.APP_URL&&new URL(env.PUBLIC_URL).origin!==new URL(env.APP_URL).origin)throw new Error('CRON_ORIGIN');
  const url=new URL('/api/tasks/maintenance',origin);
  const response=await fetchImpl(url,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(55000),redirect:'error'});
  if(!response.ok)throw new Error('MAINTENANCE_FAILED');
  const data=await response.json();
  if(data.status==='busy'&&response.status===202)return {ok:true,status:'busy'};
  if(data.maintenanceCompleted!==true)throw new Error('MAINTENANCE_NOT_CONFIRMED');
  const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
  return {ok:true,status:'completed',processed:count(data.processed),sent:count(data.sent),failed:count(data.failed),memberAccepted:count(data.members?.sent?.accepted),expiredContactRequests:count(data.contacts?.expired)};
}
// Hostinger's hbuilds/current path can be a symlink to the real deployment.
// Node resolves the module URL but keeps the command-line entry path as supplied.
// Accept both names of the same file; do not run when imported by unit tests.
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    const launchedPath = resolve(process.argv[1]);
    return import.meta.url === pathToFileURL(launchedPath).href ||
      import.meta.url === pathToFileURL(realpathSync(launchedPath)).href;
  } catch { return false; }
}
if(invokedDirectly()) {
  try {console.log(JSON.stringify(await runMaintenance()));}
  catch {console.error('Onderhoud niet bevestigd. Controleer veilige configuratie, cronuitvoer en Zonlio-beheer; geen geheimen delen.');process.exitCode=1;}
}
