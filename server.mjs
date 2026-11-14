import express from 'express';
import { createServer } from 'node:http';
import { existsSync, realpathSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBackend } from './server/backend.mjs';
import { createMarketService } from './server/market.mjs';
import { createWeatherService, WEATHER_REGIONS } from './server/weather.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const VERSION = '1.0.0';
const POLICY = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"].join('; ');

export function safeRequestPath(rawUrl = '/') {
  const raw = rawUrl.split('?')[0];
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  let path;
  try { path = decodeURIComponent(raw); } catch { return null; }
  if (/[\\\u0000-\u001f\u007f]/.test(path) || path.split('/').some(p => p === '.' || p === '..')) return null;
  return path;
}

function assetFor(path) {
  const pages = { '/':'index.html', '/index.html':'index.html', '/admin':'admin.html', '/admin/':'admin.html', '/admin.html':'admin.html', '/contact':'pages/contact.html', '/contact/':'pages/contact.html', '/privacy':'pages/privacy.html', '/privacy/':'pages/privacy.html' };
  if (pages[path]) return { name:pages[path], type:'text/html; charset=utf-8' };
  if (/^\/src\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(mjs|css)$/.test(path)) return { name:path.slice(1), type:path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8' };
  if (/^\/public\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(svg|png|webp|ico|webmanifest)$/.test(path)) {
    const suffix=path.split('.').pop();
    return { name:path.slice(1), type:({svg:'image/svg+xml',png:'image/png',webp:'image/webp',ico:'image/x-icon',webmanifest:'application/manifest+json'})[suffix] };
  }
  if (path === '/robots.txt') return { name:'robots.txt', type:'text/plain; charset=utf-8' };
  if (path === '/sitemap.xml') return { name:'sitemap.xml', type:'application/xml; charset=utf-8' };
  return null;
}

/** Return only allowlisted public assets, never the repository tree. */
export async function createAppServer({rootDir=ROOT,preferDist=true,qaMode=false,env=process.env,backend:providedBackend,market:providedMarket,weather:providedWeather}={}) {
  const projectRoot = realpathSync(resolve(rootDir));
  const distRoot=join(projectRoot,'dist');
  const assetRoot=preferDist&&existsSync(join(distRoot,'index.html'))?realpathSync(distRoot):projectRoot;
  const isProduction=env.NODE_ENV==='production';
  const qa=qaMode&&!isProduction;
  const backend=providedBackend??await createBackend({env,weatherRegions:WEATHER_REGIONS});
  const market=providedMarket??createMarketService();
  const weather=providedWeather??createWeatherService();
  const app=express();
  app.disable('x-powered-by');
  if (/^[1-3]$/.test(env.TRUST_PROXY_HOPS||'')) app.set('trust proxy',Number(env.TRUST_PROXY_HOPS));
  app.use((req,res,next)=>{
    const path=safeRequestPath(req.url);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options',qa?'SAMEORIGIN':'DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',qa?POLICY.replace("frame-ancestors 'none'","frame-ancestors 'self'"):POLICY);
    res.setHeader('Cache-Control','no-store');
    if (isProduction) res.setHeader('Strict-Transport-Security','max-age=31536000');
    if (path===null) return res.status(400).json({error:'Ongeldig pad.'});
    req.safePath=path;
    if (path.startsWith('/admin')||path.startsWith('/api/')||path.startsWith('/__qa/')) res.setHeader('X-Robots-Tag','noindex, nofollow');
    next();
  });
  app.use(express.json({limit:'24kb',strict:true}));
  app.get('/api/health',(_req,res)=>res.json({ok:true,version:VERSION,mode:'live',services:backend.health(),sources:{prices:market.getStatus(),weather:weather.getStatus()}}));
  app.get('/api/prices',async(req,res)=>{
    if (typeof req.query.date!=='string') return res.status(400).json({error:'Geef één datum op als JJJJ-MM-DD.'});
    try {res.json(await market.getDay(req.query.date));}
    catch(error) {res.status(error instanceof RangeError||error instanceof TypeError?400:503).json({error:error instanceof RangeError||error instanceof TypeError?'Ongeldige datum of datum buiten de beschikbare periode.':'Prijzen konden niet worden opgehaald.'});}
  });
  app.get('/api/weather',async(req,res)=>{
    if (typeof req.query.region!=='string') return res.status(400).json({error:'Kies één regio.'});
    try {res.json(await weather.getRegion(req.query.region));}
    catch(error) {res.status(error instanceof RangeError||error instanceof TypeError?400:503).json({error:error instanceof RangeError||error instanceof TypeError?'Onbekende regio.':'Weergegevens konden niet worden opgehaald.'});}
  });
  app.use('/api/config',(req,res,next)=>{
    const json=res.json.bind(res);res.json=data=>json({...data,weatherRegions:WEATHER_REGIONS,version:VERSION});next();
  });
  app.use('/api/admin/stats',(req,res,next)=>{
    const json=res.json.bind(res);
    res.json=data=>json(data?.totals?{...data,sources:{prices:market.getStatus(),weather:weather.getStatus()}}:data);
    next();
  });
  app.use('/api',backend.router);
  app.use('/api',(_req,res)=>res.status(404).json({error:'Onbekende API-route.'}));
  app.use(async(req,res)=>{
    if (qa&&req.safePath==='/__qa/viewport') {
      const width=['320','375','768'].includes(req.query.width)?req.query.width:'375';
      const route=req.query.view==='admin'?'/admin':'/';
      return res.type('html').send(`<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Zonlio QA · ${width}px</title><style>body{margin:24px;background:#e8ebef;font:14px system-ui;color:#18212f}header{max-width:720px;margin:0 auto 20px}iframe{display:block;border:0;width:${width}px;height:812px;margin:auto;background:white;border-radius:24px;box-shadow:0 8px 40px #18212f20}a{margin-right:16px}</style><header><h1>Zonlio · ${width}px</h1><p>Werkelijke CSS-breedte in een desktopbrowser; geen fysieke telefoon.</p><nav><a href="?width=320">320 px</a><a href="?width=375">375 px</a><a href="?width=768">768 px</a></nav></header><iframe title="Zonlio op ${width} pixels" src="${route}"></iframe></html>`);
    }
    const asset=assetFor(req.safePath);
    if (!asset) return res.status(404).type('text').send('Deze pagina bestaat niet.');
    if (!['GET','HEAD'].includes(req.method)) return res.status(405).set('Allow','GET, HEAD').json({error:'Methode niet toegestaan.'});
    try {
      const file=join(assetRoot,asset.name);
      if (await realpath(file)!==file||!(await stat(file)).isFile()) return res.status(404).end();
      const bytes=await readFile(file);
      if (req.safePath==='/'&&req.method==='GET'&&!/bot|crawler|spider|headless|monitor/i.test(req.get('user-agent')||'')) Promise.resolve(backend.recordPageView?.()).catch(()=>{});
      res.setHeader('Cache-Control',req.safePath.startsWith('/admin')?'no-store':'no-cache');
      return res.type(asset.type).send(bytes);
    } catch {return res.status(404).type('text').send('Deze pagina bestaat niet.');}
  });
  app.use((error,_req,res,_next)=>{
    const status=error.type==='entity.too.large'?413:error instanceof SyntaxError?400:500;
    res.status(status).json({error:status===413?'Het verzoek is te groot.':status===400?'Ongeldige JSON-invoer.':'Het verzoek kon niet worden verwerkt.'});
  });
  const server=createServer(app);server.requestTimeout=20_000;server.headersTimeout=20_000;
  server.on('close',()=>{Promise.resolve(backend.close?.()).catch(()=>{});});
  server.zonlio={backend,market,weather};return server;
}

const direct=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const options={};const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++) {
    const arg=args[i];if(arg==='--strictPort')continue;if(arg==='--qa'){options.qaMode=true;continue;}
    const match=/^(--host|--port)(?:=(.*))?$/.exec(arg);
    if(!match)throw new Error('Onbekende serveroptie.');
    const value=match[2]??args[++i];if(!value||value.startsWith('--'))throw new Error('Serveroptie mist een waarde.');options[match[1].slice(2)]=value;
  }
  // An unconfigured hosting deployment must never silently use development storage.
  process.env.NODE_ENV ||= options.qaMode?'development':'production';
  if(!['production','development','test'].includes(process.env.NODE_ENV))throw new Error('NODE_ENV moet production, development of test zijn.');
  const rawPort=options.port??process.env.PORT??'3000';const port=Number(rawPort);
  if(!/^\d+$/.test(rawPort)||port>65535)throw new Error('PORT moet een geldig poortnummer zijn.');
  const host=options.host??process.env.HOST??'0.0.0.0';
  // Print diagnostic *codes* and source frames, not raw error messages that could include credentials.
  function startupDiagnostic(stage,error) {
    const code=typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{1,60}$/.test(error.code)?error.code:'UNSPECIFIED';
    const type=error instanceof Error?error.name:'UnknownError';
    const frame=String(error?.stack||'').split('\\n').slice(1,3).map(s=>s.trim()).join(' | ').slice(0,300);
    console.error('ZONLIO_STARTUP_DIAGNOSTIC',JSON.stringify({stage,type,code,frame}));
  }
  try {
    const server=await createAppServer({qaMode:options.qaMode});
    server.on('error',error=>{startupDiagnostic('listen',error);process.exitCode=1;});
    server.listen(port,host,()=>console.log(`Zonlio ${VERSION} luistert op poort ${server.address().port}.`));
    for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10_000).unref();});
  } catch(error) {startupDiagnostic('initialize',error);process.exitCode=1;}
}
