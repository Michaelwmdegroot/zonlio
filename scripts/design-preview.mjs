/**
 * Build a self-contained, OFFLINE owner-review artifact from the real UI.
 * Synthetic fixtures and the fixed clock are included only in the artifact.
 * This script is outside the public build and never changes production data.
 * Usage: node scripts/design-preview.mjs [output-directory]
 */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.argv[2]||join(root,'.artifacts/design'));
const read=path=>readFile(join(root,path),'utf8');

const adapter=`
// DESIGNPREVIEW ONLY: fixed reference clock and synthetic, labelled prices.
const __NativeDate=window.Date;
const __referenceTime=__NativeDate.parse('2026-11-14T08:30:00Z');
window.Date=class extends __NativeDate {constructor(...args){super(...(args.length?args:[__referenceTime]));}static now(){return __referenceTime;}};
window.fetch=async function(path,options={}) {
  const url=new URL(String(path),'https://designpreview.invalid');
  let data={};let status=200;
  if(url.pathname==='/api/config')data={leadEnabled:false,analyticsEnabled:false,weatherRegions:[{id:'leiden',name:'Leiden'}]};
  else if(url.pathname==='/api/prices') {
    const date=url.searchParams.get('date');
    if(date!=='2026-11-14')data={status:'not_published',date,intervals:[],message:'Deze designpreview bevat alleen voorbeeldprijzen voor 14 november 2026.'};
    else {
      const values=[21.6,20.9,19.5,18.2,17.1,16.9,17.3,19.3,22.6,22.0,21.1,17.8,16.4,15.8,16.5,19.2,21.2,24.4,26.8,25.9,24.4,20.8,20.1,18.7];
      const start=Date.parse('2026-11-14T00:00:00+01:00');
      data={status:'available',date,stale:false,fetchedAt:new Date().toISOString(),source:{name:'Voorbeelddata · designreview',url:'https://zonlio.nl'},intervals:Array.from({length:96},(_,i)=>({start:new Date(start+i*900000).toISOString(),durationMinutes:15,marketEurMWh:values[Math.floor(i/4)]*10+(i%4-1.5)*1.2}))};
    }
  } else if(url.pathname==='/api/weather')data={status:'available',region:{id:'leiden',name:'Leiden'},hours:[{start:new Date().toISOString(),temperatureC:12,cloudPercent:38,precipitationMm:0}],fetchedAt:new Date().toISOString(),source:{name:'Voorbeeldweer',url:'https://zonlio.nl'}};
  else if(url.pathname.startsWith('/api/admin')){status=401;data={error:'Designpreview: niet ingelogd.'};}
  else {status=503;data={error:'Offline designpreview. Er worden geen gegevens verstuurd.'};}
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
};
`;

async function bundle(entry) {
  const modules=new Map();const order=[];
  async function visit(name) {
    if(modules.has(name))return;
    if(!/^[a-z][\w.-]*\.mjs$/.test(name))throw new Error('Unexpected preview module path.');
    const source=await read(`src/${name}`);modules.set(name,source);
    for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?/g))await visit(match[2]);
    order.push(name);
  }
  await visit(entry);
  const output=['const __zonlioModules=Object.create(null);'];
  for(const name of order) {
    let source=modules.get(name);
    const exports=[...source.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)/g)].map(m=>m[1]);
    source=source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?/g,(_,names,path)=>`const {${names}}=__zonlioModules[${JSON.stringify(path)}];`);
    source=source.replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|var|function|class)\s)/g,'');
    output.push(`__zonlioModules[${JSON.stringify(name)}]=(()=>{\n${source}\nreturn {${exports.join(',')}};\n})();`);
  }
  return output.join('\n');
}

async function inlineAssets(html) {
  for(const file of await readdir(join(root,'public')))if(file.endsWith('.svg')){
    const data=await readFile(join(root,'public',file));
    html=html.replaceAll(`/public/${file}`,`data:image/svg+xml;base64,${data.toString('base64')}`);
  }
  return html;
}

async function inlineStyles(html) {
  for(const match of [...html.matchAll(/<link rel="stylesheet" href="(?:\/src\/|\.\.\/src\/)([^\"]+)">/g)])
    html=html.replace(match[0],`<style>\n${await read(`src/${match[1]}`)}\n</style>`);
  return html;
}

async function createPreview(htmlFile,entry,fileName) {
  let html=await inlineStyles(await read(htmlFile));
  const legal={};
  for(const page of ['privacy','contact']){
    const source=await read(`pages/${page}.html`);
    legal[`/${page}`]=/<main>([\s\S]*?)<\/main>/.exec(source)?.[1]?.replace('<h1>','<h2 id="dialog-title">').replace('</h1>','</h2>')||'';
  }
  const legalHandler=`\nconst __previewLegal=${JSON.stringify(legal)};document.addEventListener('click',event=>{const a=event.target.closest('a');const content=a&&__previewLegal[a.getAttribute('href')];if(!content)return;event.preventDefault();const dialog=document.querySelector('#app-dialog');if(!dialog)return;document.querySelector('#dialog-content').innerHTML=content;if(!dialog.open)dialog.showModal();},true);`;
  const script=(adapter+await bundle(entry)+(entry==='app.mjs'?legalHandler:'')).replaceAll('</script','<\\/script');
  html=html.replace(/<script type="module" src="\/src\/[^\"]+"><\/script>/,()=>`<script>\n${script}\n</script>`);
  html=html.replace(/<link rel="canonical"[^>]+>/,'').replace('content="index,follow"','content="noindex,nofollow"');
  html=html.replace('</head>','<style>.review-banner{position:relative;z-index:41;text-align:center;padding:7px 12px;background:#e4edfc;border-bottom:1px solid #d1def3;color:#405b85;font:500 11px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.review-banner b{color:#031a37;margin-right:7px}</style></head>');
  html=html.replace(/(<body[^>]*>)/,'$1<div class="review-banner"><b>DESIGNPREVIEW</b> Voorbeeldgegevens · 14 november 2026 · niet live · geen verzending</div>');
  await writeFile(join(out,fileName),await inlineAssets(html));
}

await mkdir(out,{recursive:true});
await createPreview('index.html','app.mjs','Zonlio-Designpreview.html');
await createPreview('admin.html','admin.mjs','Zonlio-Beheerpreview.html');
for(const page of ['privacy','contact'])await writeFile(join(out,`Zonlio-${page}.html`),await inlineAssets(await inlineStyles(await read(`pages/${page}.html`))));
let guide=await inlineStyles(await read('docs/design-system.html'));
guide=guide.replaceAll('../public/','/public/');
await writeFile(join(out,'Zonlio-Stijlgids.html'),await inlineAssets(guide));
console.log(`Offline ontwerpvoorbeelden geschreven naar ${out}. Geen productie-API, opslag of mail aangeroepen.`);
