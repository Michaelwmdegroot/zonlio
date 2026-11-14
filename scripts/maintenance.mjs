const origin=process.env.APP_URL||'https://zonlio.nl';
const secret=process.env.CRON_SECRET;
if(!secret||secret.length<32){console.error('CRON_SECRET ontbreekt of is te kort.');process.exit(1);}
const url=new URL('/api/tasks/maintenance',origin);
if(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(url.hostname))){console.error('Een beveiligde APP_URL is vereist.');process.exit(1);}
try{
  const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(45000),redirect:'error'});
  if(!response.ok)throw new Error('maintenance_failed');
  const data=await response.json();
  console.log(JSON.stringify({ok:true,processed:data.processed??null,sent:data.sent??null,failed:data.failed??null}));
}catch{console.error('Onderhoudstaak niet voltooid. Controleer in de backoffice de mailwachtrij en hostingconfiguratie.');process.exitCode=1;}
