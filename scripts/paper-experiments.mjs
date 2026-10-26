// 논문용 실험: (1) 주 비교 — seed 30개, 같은 seed끼리 짝지은 차이·95% 신뢰구간·대응표본 t-검정·효과크기
//              (2) 민감도 분석 — 가정값을 바꿔도 해결책 효과가 유지되는지(seed 10개)
// Usage: node scripts/paper-experiments.mjs [출력 파일=paper-data.json]
import {readFile,writeFile} from 'node:fs/promises';
import {prepareRoute,runFor} from '../src/routesim.js';
import {conflictGraph,colorGraph,splitRoutes} from '../src/coloring.js';
const read=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));
const out=process.argv[2]??'paper-data.json';

// ---- 통계 ----
// 정규화 불완전 베타함수(Numerical Recipes)로 t분포 양측 p값을 낸다.
function betacf(a,b,x){let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;d=1/(Math.abs(d)<1e-30?1e-30:d);let h=d;
 for(let m=1;m<=200;m++){const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;d=1/(Math.abs(d)<1e-30?1e-30:d);c=1+aa/c;c=Math.abs(c)<1e-30?1e-30:c;h*=d*c;
  aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;d=1/(Math.abs(d)<1e-30?1e-30:d);c=1+aa/c;c=Math.abs(c)<1e-30?1e-30:c;const del=d*c;h*=del;if(Math.abs(del-1)<3e-12)break;}
 return h;}
function lgamma(z){const g=7,c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
 if(z<0.5)return Math.log(Math.PI/Math.sin(Math.PI*z))-lgamma(1-z);z-=1;let x=c[0];for(let i=1;i<g+2;i++)x+=c[i]/(z+i);const t=z+g+0.5;return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);}
function ibeta(a,b,x){if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x));
 return x<(a+1)/(a+b+2)?bt*betacf(a,b,x)/a:1-bt*betacf(b,a,1-x)/b;}
const pTwoSided=(t,df)=>ibeta(df/2,0.5,df/(df+t*t));
const TCRIT={9:2.262,29:2.045};
function describe(list){const n=list.length,mean=list.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(list.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)),se=sd/Math.sqrt(n),t=TCRIT[n-1];
 return {n,mean,sd,ci:[mean-t*se,mean+t*se],min:Math.min(...list),max:Math.max(...list),median:[...list].sort((a,b)=>a-b)[Math.floor(n/2)]};}
function paired(base,treat){const diff=treat.map((v,i)=>v-base[i]),D=describe(diff),t=D.sd>0?D.mean/(D.sd/Math.sqrt(D.n)):Infinity;
 const bm=base.reduce((a,b)=>a+b,0)/base.length;
 return {meanDiff:D.mean,ciDiff:D.ci,pct:D.mean/bm*100,pctCi:D.ci.map(v=>v/bm*100),t,df:D.n-1,p:Number.isFinite(t)?pTwoSided(Math.abs(t),D.n-1):0,cohenDz:D.sd>0?D.mean/D.sd:Infinity,better:diff.filter(v=>v<0).length};}

// ---- 실험 준비 ----
async function site(dir,arsId){
 const area=await read(dir+'stations.json'),{routes}=await read(dir+'routes.json');
 const graph=conflictGraph(area,arsId,{minShared:3}),{colors,assignment:full}=colorGraph(graph.nodes,graph.edges);
 const assignment=Object.fromEntries(Object.entries(full).map(([id,c])=>[id,c%3]));
 const preps=routes.filter(r=>graph.nodes.some(n=>n.id===r.id)).map(prepareRoute);
 const volume=Object.fromEntries(preps.map(p=>[p.route.id,60/(p.route.termMinutes??10)]));
 return {arsId,stop:graph.stop.name,routes:preps.length,colors,assignment,preps,zoneOf:splitRoutes(graph.nodes,volume,2).zoneOf};
}
const BASE={rule:'pooled',berths:3,dwell:40,stopDwell:20,overtake:false,cascade:true,noise:.45,startJitter:1,signal:true,green:60,meterAt:50};
const scenarios=s=>({
 S0:['현재 (앞자리부터, 대책 없음)',{}],
 E1:['노선별 지정 정차',{rule:'colored',assignment:s.assignment}],
 E2:['승강장 2곳 분리 (추월 공간 없음)',{zones:2,berths:2,zoneOf:s.zoneOf,passing:false}],
 E3:['승강장 4곳으로 연장',{berths:4}],
 E4:['버스우선신호만 (ITS 단독)',{tsp:true}],
 R1:['입구 쪽에 바로 서기 (①이 없을 때)',{rule:'rear'}],
 P2:['② 도착 간격 조정 (80%)',{holdRatio:.8}],
 P34:['③+④ 우선신호 + 승하차 단축',{tsp:true,dwell:30,stopDwell:15}],
 P234:['②+③+④ 간격 조정 + 우선신호 + 승하차 단축',{holdRatio:.6,tsp:true,dwell:30,stopDwell:15}],
});
const METRICS={delay:r=>r.delay/60,queue:r=>r.totalWait/60,exitWait:r=>r.exitWait/60,signalWait:r=>r.signalWait/60,hold:r=>r.hold/60,passenger:r=>r.passenger.actual/60,planned:r=>r.passenger.planned/60,maxQueue:r=>r.maxQueue};
function runMany(s,opts,seeds,preps=s.preps){
 const rows=seeds.map(seed=>runFor(preps,{focus:s.arsId,...BASE,seed,...opts},7200));
 return Object.fromEntries(Object.entries(METRICS).map(([k,f])=>[k,rows.map(f)]));
}

const result={generatedAt:new Date().toISOString(),base:BASE,main:{},sensitivity:[]};
const SEEDS30=Array.from({length:30},(_,i)=>i+1),SEEDS10=SEEDS30.slice(0,10);
for(const [key,dir,arsId] of [['신용산역','data/public/','03003'],['일산동구청','data/public/ilsan/','20227']]){
 const s=await site(dir,arsId),sc=scenarios(s),raw={};
 for(const [id,[,o]] of Object.entries(sc)){raw[id]=runMany(s,o,SEEDS30);console.log(key,id,raw[id].delay.reduce((a,b)=>a+b,0)/30|0,'분');}
 const block={arsId,stop:s.stop,routes:s.routes,colorsNeeded:s.colors,scenarios:{}};
 for(const [id,[name]] of Object.entries(sc)){
  const ref=id==='S0'?null:raw.S0;
  block.scenarios[id]={name,raw:raw[id],stats:Object.fromEntries(Object.keys(METRICS).map(k=>[k,describe(raw[id][k])])),
   vsBase:ref?Object.fromEntries(['delay','queue','passenger','maxQueue'].map(k=>[k,paired(ref[k],raw[id][k])])):null};
 }
 // ①의 효과: 입구 쪽 습관(R1) 대비 앞자리부터(S0)
 block.frontVsRear=Object.fromEntries(['delay','queue','passenger','maxQueue'].map(k=>[k,paired(raw.R1[k],raw.S0[k])]));
 result.main[key]=block;
}

// ---- 민감도 분석 (신용산역): 각 가정값에서 S0 대비 ③+④와 ②+③+④의 효과 ----
{const s=await site('data/public/','03003');
 const scaled=k=>s.preps.map(p=>({...p,route:{...p.route,termMinutes:(p.route.termMinutes??10)*k}}));
 const factors=[
  ['평균 정차 시간',[[30,'30초',{dwell:30,stopDwell:15}],[40,'40초 (기준)',{}],[50,'50초',{dwell:50,stopDwell:25}]],o=>({dwell:Math.round((o.dwell??40)*.75),stopDwell:Math.round((o.stopDwell??20)*.75)})],
  ['흔들림 크기',[[.3,'0.30',{noise:.3}],[.45,'0.45 (기준)',{}],[.6,'0.60',{noise:.6}]],()=>({dwell:30,stopDwell:15})],
  ['수요(시간당 버스)',[[0.8,'−20%',{},1.25],[1,'기준',{},1],[1.2,'+20%',{},1/1.2]],()=>({dwell:30,stopDwell:15})],
  ['신호 녹색 시간',[[50,'50초',{green:50}],[60,'60초 (기준)',{}],[70,'70초',{green:70}]],()=>({dwell:30,stopDwell:15})],
  ['정차면 수',[[2,'2곳',{berths:2}],[3,'3곳 (기준)',{}],[4,'4곳',{berths:4}]],()=>({dwell:30,stopDwell:15})],
 ];
 for(const [factor,levels,reduce] of factors){
  for(const [value,label,o,k=1] of levels){
   const preps=k===1?s.preps:scaled(k);
   const base=runMany(s,o,SEEDS10,preps),p34=runMany(s,{...o,tsp:true,...reduce(o)},SEEDS10,preps),p234=runMany(s,{...o,holdRatio:.6,tsp:true,...reduce(o)},SEEDS10,preps);
   result.sensitivity.push({factor,value,label,base:{delay:describe(base.delay),passenger:describe(base.passenger)},
    p34:{delay:paired(base.delay,p34.delay),passenger:paired(base.passenger,p34.passenger)},
    p234:{delay:paired(base.delay,p234.delay),passenger:paired(base.passenger,p234.passenger),maxQueue:paired(base.maxQueue,p234.maxQueue)}});
   console.log('민감도',factor,label,'③+④ 지연',result.sensitivity.at(-1).p34.delay.pct.toFixed(0)+'%','②+③+④ 승객',result.sensitivity.at(-1).p234.passenger.pct.toFixed(0)+'%');
  }
 }
}
await writeFile(out,JSON.stringify(result)+'\n');
console.log('저장 '+out);
