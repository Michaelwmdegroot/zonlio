import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())result.push(...await walk(path));else if(path.endsWith('.mjs'))result.push(path);}return result;}
const files=['server.mjs',...await walk('server'),...await walk('src'),...await walk('scripts'),...await walk('tests')];
for(const file of files){const check=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(check.status!==0)process.exit(check.status||1);}
console.log(`${files.length} JavaScript-modules syntactisch gecontroleerd.`);
