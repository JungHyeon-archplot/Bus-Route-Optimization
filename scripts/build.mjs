// Copies only what the browser needs into dist/, in the same URL layout the local server uses.
// Never copies .env, data/raw or the team's source documents.
import {rm,mkdir,cp,writeFile,access,readdir} from 'node:fs/promises';
import {CSP} from '../src/live.js';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
// Empty dist/ rather than removing it: Windows keeps a folder locked while a dev server watches it.
await mkdir(dist,{recursive:true});
for(const entry of await readdir(dist))await rm(new URL(entry,dist),{recursive:true,force:true});
await mkdir(new URL('public/',dist),{recursive:true});await mkdir(new URL('src/',dist),{recursive:true});
await cp(new URL('public/index.html',root),new URL('index.html',dist));
for(const file of ['berths.js','route-map.js','sim-log.js','ui.js','map.js','observation.js','style.css'])await cp(new URL('public/'+file,root),new URL('public/'+file,dist));
for(const file of ['network.js','coloring.js','routesim.js','observation.js'])await cp(new URL('src/'+file,root),new URL('src/'+file,dist));
for(const file of ['stations.json','routes.json'])await cp(new URL('data/public/'+file,root),new URL(file,dist));
const observation=new URL('data/public/observations/latest.json',root);
if(await access(observation).then(()=>true,()=>false))await cp(observation,new URL('observation.json',dist));
await writeFile(new URL('_headers',dist),`/*\n  Content-Security-Policy: ${CSP}\n  X-Content-Type-Options: nosniff\n`);
console.log('dist/ 준비 완료');
