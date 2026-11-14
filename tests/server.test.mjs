import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {request} from 'node:http';
import {mkdtemp,mkdir,readdir,rm,symlink,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAppServer} from '../server.mjs';

function call(server,path,{method='GET',body,headers={}}={}){
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:server.address().port,path,method,agent:false,headers:{...headers,...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{})}},res=>{let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});
    req.on('error',reject);req.setTimeout(4000,()=>req.destroy(new Error('HTTP test timeout')));req.end(body);
  });
}
function close(server){return new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
test('an unconfigured direct start defaults to production and cannot create local lead storage', {timeout:10000}, async t=>{
  const directory=await mkdtemp(join(tmpdir(),'zonlio-start-'));
  const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url)),'--port','0','--host','127.0.0.1'],{cwd:directory,env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});
  const ended=new Promise(resolve=>child.once('exit',resolve));
  t.after(async()=>{child.kill('SIGTERM');await ended;await rm(directory,{recursive:true,force:true});});
  const port=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(new Error('De server startte niet op tijd.')),5000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',()=>{clearTimeout(timer);reject(new Error('De server stopte voor de controle.'));});
    child.stdout.on('data',chunk=>{output+=chunk;const match=/luistert op poort (\d+)/.exec(output);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  });
  const target={address:()=>({port})};
  const health=await call(target,'/api/health');
  assert.equal(health.status,200);
  assert.match(health.headers['strict-transport-security'],/max-age/);
  assert.deepEqual(JSON.parse(health.text).services,{databaseReady:false,adminConfigured:false,mailConfigured:false,leadEnabled:false,housingAdviceEnabled:false,operatorConfigured:true,portalExportEnabled:false,memberAccountsEnabled:false,daymailSignupEnabled:false,daymailSendEnabled:false});
  assert.equal(JSON.parse((await call(target,'/api/config')).text).leadEnabled,false);
  assert.equal((await call(target,'/__qa/viewport')).status,404);
  assert.deepEqual(await readdir(directory),[]);
});
async function setup(t,{env={NODE_ENV:'test'},qaMode=false}={}){
  const rootDir=await mkdtemp(join(tmpdir(),'zonlio-server-'));
  for(const dir of ['src','public','pages','server'])await mkdir(join(rootDir,dir));
  for(const [file,content]of Object.entries({'index.html':'<!doctype html><title>Zonlio fixture</title>','admin.html':'<!doctype html><title>Zonlio beheer</title>','src/app.mjs':'export const publicAsset=true;','src/style.css':'body{color:#18212f}','public/icon.svg':'<svg xmlns="http://www.w3.org/2000/svg"/>','pages/contact.html':'Contact info@zonlio.nl','pages/privacy.html':'Privacy','server/secret.mjs':'NOT_PUBLIC','.env':'NOT_PUBLIC','package.json':'NOT_PUBLIC','robots.txt':'User-agent: *'}))await writeFile(join(rootDir,file),content);
  let views=0;const router=express.Router();router.get('/config',(_q,r)=>r.json({leadEnabled:false}));router.all('/leads',(_q,r)=>r.status(503).json({error:'Niet geconfigureerd.'}));
  const backend={router,health:()=>({databaseReady:false,adminConfigured:false,mailConfigured:false,leadEnabled:false}),recordPageView:()=>{views++;}};
  const market={getDay:async date=>{if(date==='wrong')throw new RangeError();return{status:'available',date,intervals:[]};},getStatus:()=>({status:'idle'})};
  const weather={getRegion:async region=>{if(region==='wrong')throw new RangeError();return{status:'available',region:{id:region}};},getStatus:()=>({status:'idle'})};
  const server=await createAppServer({rootDir,env,qaMode,backend,market,weather});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(async()=>{await close(server);await rm(rootDir,{recursive:true,force:true});});
  return {server,rootDir,views:()=>views};
}

test('server exposes only public allowlisted assets with protective headers',async t=>{
  const {server,rootDir,views}=await setup(t);
  for(const path of ['/','/admin','/src/app.mjs','/src/style.css','/public/icon.svg','/contact','/privacy','/robots.txt']){
    const r=await call(server,path);assert.equal(r.status,200,path);assert.equal(r.headers['x-content-type-options'],'nosniff');assert.equal(r.headers['referrer-policy'],'no-referrer');assert.match(r.headers['content-security-policy'],/connect-src 'self'/);
  }
  assert.equal(views(),1);
  assert.equal((await call(server,'/',{method:'HEAD'})).text,'');
  assert.equal((await call(server,'/admin')).headers['x-robots-tag'],'noindex, nofollow');
  for(const path of ['/.env','/package.json','/server.mjs','/server/secret.mjs','/docs/QA.md','/src/.private.mjs','/no-such-page']){
    const r=await call(server,path);assert.equal(r.status,404,path);assert.doesNotMatch(r.text,/NOT_PUBLIC/);
  }
  await symlink(join(rootDir,'server','secret.mjs'),join(rootDir,'src','alias.mjs'));
  assert.equal((await call(server,'/src/alias.mjs')).status,404);
  assert.equal((await call(server,'/',{method:'POST'})).status,405);
});

test('raw traversal and malformed request bodies cannot expose source or crash routes',async t=>{
  const {server}=await setup(t);
  for(const path of ['/../.env','/%2e%2e/.env','/src/../../package.json','/src\\..\\.env','/%E0%A4%A'])assert.equal((await call(server,path)).status,400,path);
  assert.equal((await call(server,'/src/%252e%252e%252fserver/secret.mjs')).status,404);
  const malformed=await call(server,'/api/leads',{method:'POST',body:'{'});assert.equal(malformed.status,400);assert.doesNotMatch(malformed.text,/SyntaxError|stack/);
  assert.equal((await call(server,'/api/leads',{method:'POST',body:JSON.stringify({text:'x'.repeat(30000)})})).status,413);
});

test('market and weather route contracts preserve status and reject invalid selectors',async t=>{
  const {server}=await setup(t);
  assert.equal((await call(server,'/api/prices')).status,400);
  assert.equal((await call(server,'/api/prices?date=wrong')).status,400);
  assert.equal((await call(server,'/api/prices?date=2026-11-14&date=2026-11-15')).status,400);
  assert.equal(JSON.parse((await call(server,'/api/prices?date=2026-11-14')).text).status,'available');
  assert.equal((await call(server,'/api/weather?region=wrong')).status,400);
  assert.equal((await call(server,'/api/weather')).status,400);
  assert.equal(JSON.parse((await call(server,'/api/weather?region=leiden')).text).region.id,'leiden');
  const config=JSON.parse((await call(server,'/api/config')).text);assert.equal(config.version,'1.0.0');assert.ok(config.weatherRegions.some(r=>r.id==='leiden'));
  const health=JSON.parse((await call(server,'/api/health')).text);assert.equal(health.mode,'live');assert.equal(health.services.leadEnabled,false);
  assert.equal((await call(server,'/api/nonexistent')).status,404);
});

test('QA viewport is unavailable in production even with the CLI flag',async t=>{
  const {server}=await setup(t,{env:{NODE_ENV:'production'},qaMode:true});
  assert.equal((await call(server,'/__qa/viewport?width=375')).status,404);
  const r=await call(server,'/');assert.equal(r.headers['x-frame-options'],'DENY');assert.equal(r.headers['strict-transport-security'],'max-age=31536000');
});

test('built public assets take precedence over source assets',async t=>{
  const fixture=await setup(t);await mkdir(join(fixture.rootDir,'dist'));await writeFile(join(fixture.rootDir,'dist','index.html'),'BUILT_APP');
  const router=express.Router();const server=await createAppServer({rootDir:fixture.rootDir,backend:{router,health:()=>({})},market:{},weather:{},env:{NODE_ENV:'test'}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{assert.equal((await call(server,'/')).text,'BUILT_APP');}finally{await close(server);}
});
