import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderPriceChart } from '../src/chart.mjs';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('all HTML entrypoints share one final design stylesheet and the approved logo',async()=>{
  for(const path of ['index.html','admin.html','pages/privacy.html','pages/contact.html']){
    const html=await read(path);
    const styles=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(styles.at(-1),'/src/design-system.css',path);
    assert.equal(styles.filter(s=>s==='/src/design-system.css').length,1,path);
    assert.match(html,/src="\/public\/zonlio-logo\.svg"/);
    assert.match(html,/alt="Zonlio"/);
  }
});

test('the approved brand primitives and compatibility aliases are centrally defined',async()=>{
  const css=(await read('src/design-system.css')).toLowerCase();
  for(const [name,value] of Object.entries({navy:'#031a37',blue:'#0765f1',sky:'#03bbf8',sun:'#ffbc12',surface:'#f8fbff'}))
    assert.ok(css.includes(`--zonlio-${name}: ${value}`),name);
  assert.match(css,/--blue:\s*var\(--z-action\)/);
  assert.match(css,/--font:\s*var\(--z-font\)/);
  for(const preference of ['prefers-reduced-motion','prefers-reduced-transparency','forced-colors'])assert.ok(css.includes(preference));
  assert.ok(!/overflow-x:\s*hidden/.test(css),'do not conceal layout overflow');
});

test('brand and atmosphere are local SVG assets compatible with the static allowlist',async()=>{
  for(const path of ['public/zonlio-logo.svg','public/icon.svg','public/zonlio-atmosphere.svg']){
    const svg=await read(path);assert.match(svg,/<svg\b/);assert.doesNotMatch(svg,/<script\b|onload\s*=|<foreignObject\b/i);
  }
  const html=await read('index.html');assert.doesNotMatch(html,/<svg class="brand-icon"/);
});

test('negative and selected chart bars retain separate semantic classes',()=>{
  const html=renderPriceChart({slots:[{hour:0,displayValue:-4},{hour:1,displayValue:8}],selectedIndex:1});
  assert.match(html,/class="bar is-negative"/);
  assert.match(html,/class="bar is-selected"/);
  assert.match(html,/zero-line/);
});

test('device previews use existing models and planner bounds, never pretend to switch devices',async()=>{
  const app=await read('src/app.mjs');
  assert.match(app,/durationHours:device\.durationHours,energyKwh:device\.energyKwh,startHour:state\.startHour,endHour:state\.endHour/);
  assert.match(app,/Je stelt zelf je apparaat of timer in/);
  assert.doesNotMatch(app,/window\.fetch\s*=/);
  const builder=await read('scripts/build.mjs');assert.doesNotMatch(builder,/design-preview\.mjs/);
});


test('production SVG branding is byte-identical to the owner-supplied brand kit',async()=>{
  const manifest=JSON.parse(await read('docs/brand-manifest.json'));
  for(const [path,asset] of Object.entries(manifest.assets)){
    const bytes=await readFile(new URL(`../${path}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,path);
  }
});
