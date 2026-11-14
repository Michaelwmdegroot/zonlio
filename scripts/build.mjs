import {lstat,mkdir,readFile,readdir,rename,rm,copyFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const staging=join(root,`dist-build-${process.pid}`);const dist=join(root,'dist');
const origins='https://zonlio-build.invalid';
async function list(directory,prefix='') {
  const out=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const rel=prefix?`${prefix}/${entry.name}`:entry.name;const path=join(directory,entry.name);
    if((await lstat(path)).isSymbolicLink())throw new Error(`Symbolische asset niet toegestaan: ${rel}`);
    if(entry.isDirectory())out.push(...await list(path,rel));else out.push(rel);
  }return out;
}
async function build() {
  const files=['index.html','admin.html','robots.txt','sitemap.xml',...(await list(join(root,'src'))).filter(f=>/^[\w.-]+\.(mjs|css)$/.test(f)).map(f=>`src/${f}`),...(await list(join(root,'public'))).map(f=>`public/${f}`),...(await list(join(root,'pages'))).filter(f=>f.endsWith('.html')).map(f=>`pages/${f}`)];
  await rm(staging,{recursive:true,force:true});await mkdir(staging,{recursive:true});
  for(const file of files){const source=join(root,file);if(!(await lstat(source)).isFile())throw new Error(`Bestand ontbreekt: ${file}`);await mkdir(dirname(join(staging,file)),{recursive:true});await copyFile(source,join(staging,file));}
  const known=new Set(files);
  for(const file of files.filter(f=>/\.(mjs|html)$/.test(f))) {
    const content=await readFile(join(staging,file),'utf8');let refs=[];
    if(file.endsWith('.mjs')) refs=[...content.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"]([^'"]+)['"]/g),...content.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m=>m[1]);
    else refs=[...content.matchAll(/<(?:script|link)\b[^>]*>/gi)].filter(m=>/\bsrc\s*=/.test(m[0])||/rel\s*=\s*['"](?:stylesheet|icon|manifest)['"]/.test(m[0])).map(m=>/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/.exec(m[0])?.[1]).filter(Boolean);
    for(const ref of refs) {const url=new URL(ref,`${origins}/${file}`);if(url.origin!==origins)throw new Error(`Externe uitvoerbare asset: ${file}`);if(!known.has(decodeURIComponent(url.pathname.slice(1))))throw new Error(`Import ontbreekt: ${ref} in ${file}`);}
  }
  await rm(dist,{recursive:true,force:true});await rename(staging,dist);
  console.log(`Zonlio build gereed: ${files.length} publieke bestanden. Server, database en geheimen zijn uitgesloten.`);
}
try{await build();}catch(error){await rm(staging,{recursive:true,force:true});console.error(error.message);process.exitCode=1;}
