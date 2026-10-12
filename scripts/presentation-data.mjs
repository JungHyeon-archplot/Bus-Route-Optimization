// 발표 그림에 쓴 모든 수치를 한 번에 다시 계산해 JSON으로 남긴다(평균·최소·최대·구성 요소).
// Usage: node scripts/presentation-data.mjs [출력 파일=presentation-data.json]
import {readFile,writeFile} from 'node:fs/promises';
import {prepareRoute,runFor} from '../src/routesim.js';
import {conflictGraph,colorGraph,splitRoutes} from '../src/coloring.js';
const read=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));
const out=process.argv[2]??'presentation-data.json';
const SEEDS=[1,2,3,4,5,6,7,8,9,10];
const stat=list=>({mean:list.reduce((a,b)=>a+b,0)/list.length,min:Math.min(...list),max:Math.max(...list)});

async function site(dir,arsId){
 const area=await read(dir+'stations.json'),{routes}=await read(dir+'routes.json');
 const graph=conflictGraph(area,arsId,{minShared:3}),{colors,assignment:full}=colorGraph(graph.nodes,graph.edges);
 const assignment=Object.fromEntries(Object.entries(full).map(([id,c])=>[id,c%3]));
 const preps=routes.filter(r=>graph.nodes.some(n=>n.id===r.id)).map(prepareRoute);
 const volume=Object.fromEntries(preps.map(p=>[p.route.id,60/(p.route.termMinutes??10)]));
 const {zoneOf}=splitRoutes(graph.nodes,volume,2);
 return {graph,colors,assignment,preps,volume,zoneOf,stop:graph.stop};
}
// 화면·그림과 같은 기본 조건(추월 불가, 연쇄 지연, 신호, 9/30 실측 보정 흔들림)
const BASE={rule:'pooled',berths:3,dwell:40,overtake:false,cascade:true,noise:.45,startJitter:1,signal:true,meterAt:50};
function cases(s){return [
 ['현재 (지금 그대로)',{}],
 ['노선별 지정 정차',{rule:'colored',assignment:s.assignment}],
 ['승강장 2곳 분리 (추월 공간 없음)',{zones:2,berths:2,zoneOf:s.zoneOf,passing:false}],
 ['승강장 2곳 분리 (추월 공간 있음)',{zones:2,berths:2,zoneOf:s.zoneOf,passing:true}],
 ['승강장 4곳으로 연장',{berths:4}],
 ['버스우선신호만',{tsp:true}],
 ['정차 30초만',{dwell:30,stopDwell:15}],
 ['배차간격 유지 60%',{holdRatio:.6}],
 ['배차간격 유지 80%',{holdRatio:.8}],
 ['신호 + 승하차 단축 (③+④)',{tsp:true,dwell:30,stopDwell:15}],
 ['간격 조정 + 신호 + 승하차 (②+③+④)',{holdRatio:.6,tsp:true,dwell:30,stopDwell:15}],
 ['입구 쪽에 바로 서기',{rule:'rear'}],
];}
function measure(s,o){
 const runs=SEEDS.map(seed=>runFor(s.preps,{focus:s.stop.arsId,...BASE,seed,...o},7200));
 const m=k=>stat(runs.map(r=>typeof k==='function'?k(r):r[k]));
 return {delay:m('delay'),queue:m('totalWait'),exitWait:m('exitWait'),signalWait:m('signalWait'),hold:m('hold'),
  passenger:m(r=>r.passenger.actual),planned:m(r=>r.passenger.planned),maxQueue:m('maxQueue'),served:m('served')};
}

// 포화 실험(유효 정차면)
const line=Array.from({length:21},(_,i)=>[37.56,127+i*0.00113]),path=[...line,...line.slice(0,-1).reverse()];
const sat=Array.from({length:40},(_,i)=>prepareRoute({id:'r'+String(i).padStart(2,'0'),termMinutes:1,path,stops:[{arsId:'X',lat:37.56,lng:127+10*0.00113}]}));
const thr=(berths,overtake,extra={})=>stat([1,2,3,4,5].map(seed=>runFor(sat,{focus:'X',rule:berths===1?'single':'pooled',berths,dwell:40,dwellJitter:1,overtake,speed:10,seed,...extra},3*3600).served/3));

const result={generatedAt:new Date().toISOString(),seeds:SEEDS,base:BASE,sites:{},capacity:{},vc:[]};
for(const [key,dir,arsId] of [['신용산역','data/public/','03003'],['삼각지역','data/public/','03008'],['일산동구청','data/public/ilsan/','20227']]){
 const s=await site(dir,arsId);
 const list=key==='삼각지역'?cases(s).filter(([n])=>['현재 (지금 그대로)','입구 쪽에 바로 서기','신호 + 승하차 단축 (③+④)'].includes(n)):cases(s);
 result.sites[key]={arsId,stop:s.stop.name,routes:s.preps.length,colorsNeeded:s.colors,cases:{}};
 for(const [name,o] of list){result.sites[key].cases[name]=measure(s,o);console.log(key,name,Math.round(result.sites[key].cases[name].delay.mean/60)+'분');}
}
// 유효 정차면
const one=thr(1,false).mean;
result.capacity.single=one;
result.capacity.lane=[1,2,3,4].map(n=>{const t=thr(n,false);return {berths:n,perHour:t,effective:t.mean/one};});
result.capacity.free=[1,2,3,4].map(n=>{const t=thr(n,true);return {berths:n,perHour:t,effective:t.mean/one};});
const alt=Object.fromEntries(sat.map((p,i)=>[p.route.id,i%2]));
result.capacity.split=[true,false].map(passing=>{const t=thr(2,false,{zones:2,zoneOf:alt,passing});return {passing,perHour:t,effective:t.mean/one};});
result.capacity.hcm1994=[1,1.75,2.25,2.45,2.5];
// 혼잡도
const tc=10,Z=1.04,cv=.6,cap=(td,neb)=>neb*3600/(tc+td+Z*cv*td);
for(const [dir,arsId] of [['data/public/','03003'],['data/public/','03007'],['data/public/ilsan/','20227'],['data/public/ilsan/','20249']]){
 const s=await site(dir,arsId);
 const routes=s.graph.nodes.map(n=>({name:n.name,headway:s.preps.find(p=>p.route.id===n.id)?.route.termMinutes??null,busesPerHour:60/(s.preps.find(p=>p.route.id===n.id)?.route.termMinutes??10)}));
 const demand=routes.reduce((a,r)=>a+r.busesPerHour,0);
 const neb3=result.capacity.lane[2].effective,neb4=result.capacity.lane[3].effective,nebSplit=result.capacity.split[0].effective;
 result.vc.push({arsId,stop:s.stop.name,routes,demand,capacity:{td40b3:cap(40,neb3),td40b4:cap(40,neb4),td30b3:cap(30,neb3),split40:cap(40,nebSplit),split30:cap(30,nebSplit)},
  formula:{tc,Z,cv,neb3,neb4,nebSplit}});
}
await writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log('저장 '+out);
