import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import express from 'express';
import {createAppServer} from '../server.mjs';
const routes=['/kennis','/stroomprijzen','/slim-stroomverbruik','/zonnepanelen-2027','/terugleveren','/thuisbatterij-berekenen'];

test('knowledge pages are public without JavaScript, with canonical content and no private route in sitemap',async t=>{
  const backend={router:express.Router(),health:()=>({}),recordPageView:async()=>{}};
  const server=await createAppServer({preferDist:false,env:{NODE_ENV:'test'},backend,market:{},weather:{}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const titles=new Set();
  for(const path of routes){
    const response=await fetch(base+path);assert.equal(response.status,200,path);
    assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
    const html=await response.text();
    assert.ok(html.includes(`<link rel="canonical" href="https://zonlio.nl${path}">`),path);
    assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,path);
    assert.match(html,/content="index,follow"/);assert.match(html,/href="\/#(?:planner|overzicht|2027|batterij)"|href="\/">Open de gratis tools/);
    const title=/<title>([^<]+)<\/title>/.exec(html)?.[1];assert.ok(title);assert.ok(!titles.has(title));titles.add(title);
    const styles=[...html.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);assert.equal(styles.at(-1),'/src/design-system.css');
    assert.doesNotMatch(html,/<script\b|<form\b|tracking|gtag\(|fbq\(/i);
    if(path!=='/kennis'){assert.match(html,/itemtype="https:\/\/schema.org\/Article"/);assert.match(html,/itemtype="https:\/\/schema.org\/BreadcrumbList"/);assert.match(html,/itemprop="articleBody"/);}
    assert.equal((await fetch(base+path+'/')).status,200);
  }
  const xml=await (await fetch(base+'/sitemap.xml')).text();
  for(const path of routes)assert.ok(xml.includes(`<loc>https://zonlio.nl${path}</loc>`));
  assert.doesNotMatch(xml,/\/mijn|\/admin|\/api\//);
  const home=await (await fetch(base+'/')).text();assert.match(home,/<main[^>]*>[\s\S]*<h1>/);assert.match(home,/href="\/kennis"/);
  for(const path of ['/mijn','/admin'])assert.equal((await fetch(base+path)).headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal((await fetch(base+'/pages/knowledge.html')).status,404,'raw repository paths stay private');
});

test('members and admin retain noindex and the public entrypoint has a useful no-script route',async()=>{
  for(const file of ['pages/member.html','admin.html'])assert.match(await readFile(new URL(`../${file}`,import.meta.url),'utf8'),/name="robots" content="noindex/);
  const robots=await readFile(new URL('../robots.txt',import.meta.url),'utf8');assert.doesNotMatch(robots,/Disallow: \/(?:mijn|admin)/);assert.match(robots,/Disallow: \/api\//);
});
