// Copies only what the browser needs into dist/, in the same URL layout the local server uses.
// Never copies .env, data/raw or the team's source documents.
import {rm,mkdir,cp,writeFile,readdir} from 'node:fs/promises';
import {CSP} from '../src/live.js';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
// Empty dist/ rather than removing it: Windows keeps a folder locked while a dev server watches it.
await mkdir(dist,{recursive:true});
for(const entry of await readdir(dist))await rm(new URL(entry,dist),{recursive:true,force:true});
await mkdir(new URL('public/',dist),{recursive:true});await mkdir(new URL('src/',dist),{recursive:true});
await cp(new URL('public/index.html',root),new URL('index.html',dist));
for(const file of ['berths.js','route-map.js','sim-log.js','sim-worker.js','ui.js','map.js','style.css','demo.js','qr.svg'])await cp(new URL('public/'+file,root),new URL('public/'+file,dist));
for(const file of ['network.js','coloring.js','routesim.js'])await cp(new URL('src/'+file,root),new URL('src/'+file,dist));
for(const file of ['stations.json','routes.json'])await cp(new URL('data/public/'+file,root),new URL(file,dist));
const calibration=new URL('data/public/calibration.json',root);
if(await readdir(new URL('data/public/',root)).then(files=>files.includes('calibration.json')))await cp(calibration,new URL('calibration.json',dist));
await mkdir(new URL('ilsan/',dist),{recursive:true});
for(const file of ['stations.json','routes.json'])await cp(new URL('data/public/ilsan/'+file,root),new URL('ilsan/'+file,dist));
await writeFile(new URL('_headers',dist),`/*\n  Content-Security-Policy: ${CSP}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);
console.log('dist/ 준비 완료');
