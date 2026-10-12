// 실측(scripts/observe-stop.mjs 결과)에 시뮬레이터의 흔들림 크기를 맞추고, 맞추는 데 쓰지 않은 지표로 검증한다.
// 맞추는 값: noise(구간 속도 흔들림), startJitter(차고지 출발 불규칙). 맞추는 지표: 승객 대기 ÷ 계획, 1분 안 연달아 비율.
// 검증: ① 같은 노선 버스 간격의 변동계수(맞추는 데 안 씀) ② 실측이 두 곳이면 한 곳에서 맞춘 값으로 다른 곳을 예측.
// 결과는 data/public/calibration.json — 화면과 lane-experiment.mjs가 지역별로 이 값을 쓴다.
// Usage: node scripts/calibrate.mjs data/public/observations/seoul-03003-*.json data/public/observations/ilsan-20227-*.json [--out 파일]
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {prepareRoute,runFor} from '../src/routesim.js';
import {conflictGraph} from '../src/coloring.js';
import {metrics} from '../src/calibration.js';

const args=process.argv.slice(2),outAt=args.indexOf('--out');
const out=outAt>=0?args.splice(outAt,2)[1]:fileURLToPath(new URL('../data/public/calibration.json',import.meta.url));
const NOISE=[.15,.3,.45,.6,.75],START=[0,.5,1],SEEDS=[1,2,3,4,5],WARMUP=1200;
const BEFORE={noise:.45,startJitter:1}; // 지금까지 쓰던 값(9/30 충무로 실측 기준)
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const avg=list=>Object.fromEntries(['ratio','within','cv','passes'].map(k=>[k,list.reduce((s,m)=>s+(m[k]??0),0)/list.length]));
const loss=(s,o)=>((s.ratio-o.ratio)/o.ratio)**2+((s.within-o.within)/Math.max(o.within,.05))**2;

async function setup(file){
 const obs=await read(file),area=obs.area??'seoul',dir=fileURLToPath(new URL(`../data/public/${area==='ilsan'?'ilsan/':''}`,import.meta.url));
 const stations=await read(dir+'stations.json'),{routes}=await read(dir+'routes.json');
 const graph=conflictGraph(stations,obs.stop.arsId,{minShared:3});
 const preps=routes.filter(r=>graph.nodes.some(n=>n.id===r.id)).map(prepareRoute);
 const idOf=Object.fromEntries(obs.routes.map(r=>[r.name,r.id])),ids=new Set(obs.routes.map(r=>r.id));
 const headways=Object.fromEntries(obs.routes.filter(r=>r.termMinutes).map(r=>[r.id,r.termMinutes*60]));
 const departures={};
 for(const p of obs.passes)if(idOf[p.route])(departures[idOf[p.route]]??=[]).push(Date.parse(p.time)/1000);
 const duration=(Date.parse(obs.endedAt)-Date.parse(obs.startedAt))/1000;
 const observed=metrics(departures,headways);
 if(!observed.passes||observed.ratio==null)throw new Error(`${file}: 통과 기록이 부족해 맞출 수 없습니다(통과 ${observed.passes}회).`);
 // 시뮬레이션도 실측과 같은 노선·같은 길이 구간(앞 20분은 버림)만 잰다.
 const simulate=params=>avg(SEEDS.map(seed=>{
  const r=runFor(preps,{focus:obs.stop.arsId,rule:'pooled',berths:3,dwell:40,overtake:false,cascade:true,signal:true,seed,...params},WARMUP+duration);
  return metrics(Object.fromEntries(Object.entries(r.departures).filter(([id])=>ids.has(id))),headways,{from:WARMUP});
 }));
 return {file,area,stop:obs.stop,routes:obs.routes.length,minutes:Math.round(duration/60),startedAt:obs.startedAt,observed,simulate};
}

try{
 if(!args.length)throw new Error('실측 파일을 하나 이상 주세요.');
 const sites=[];
 for(const file of args){
  const site=await setup(file);
  const grid=NOISE.flatMap(noise=>START.map(startJitter=>({noise,startJitter})));
  for(const p of grid)p.sim=site.simulate(p);
  for(const p of grid)p.loss=loss(p.sim,site.observed);
  site.best=grid.reduce((a,b)=>b.loss<a.loss?b:a);
  site.before=site.simulate(BEFORE);
  sites.push(site);
 }
 // 다른 곳에서 맞춘 값으로 이곳을 예측했을 때의 오차.
 const cross=sites.length>1?sites.flatMap(target=>sites.filter(s=>s!==target).map(source=>{
  const sim=target.simulate({noise:source.best.noise,startJitter:source.best.startJitter});
  return {from:source.area,to:target.area,params:{noise:source.best.noise,startJitter:source.best.startJitter},observed:target.observed,simulated:sim};
 })):[];
 const result={generatedAt:new Date().toISOString(),method:'격자 탐색 noise×startJitter, seed 5개 평균, 맞춤 지표: 승객 대기÷계획 + 1분 안 연달아 비율, 검증: 간격 변동계수·교차 예측',
  areas:Object.fromEntries(sites.map(s=>[s.area,{arsId:s.stop.arsId,stop:s.stop.name,observation:s.file.replace(/^.*[\\/]/,''),startedAt:s.startedAt,routes:s.routes,minutes:s.minutes,
   noise:s.best.noise,startJitter:s.best.startJitter,observed:s.observed,simulated:s.best.sim,before:{...BEFORE,simulated:s.before}}])),cross};
 await writeFile(out,JSON.stringify(result,null,2)+'\n');
 const f=(x,d=2)=>x==null?'-':x.toFixed(d),pc=x=>x==null?'-':(x*100).toFixed(0)+'%';
 for(const s of sites){
  console.log(`\n${s.stop.name}(${s.stop.arsId}) · 실측 ${s.minutes}분 · 노선 ${s.routes}개 · 통과 ${s.observed.passes}회`);
  console.log(`              승객대기÷계획  1분 안 연달아  간격 변동계수(검증)`);
  console.log(`  실측            ${f(s.observed.ratio)}          ${pc(s.observed.within)}          ${f(s.observed.cv)}`);
  console.log(`  보정 전(.45/1)  ${f(s.before.ratio)}          ${pc(s.before.within)}          ${f(s.before.cv)}`);
  console.log(`  보정 후(${s.best.noise}/${s.best.startJitter})  ${f(s.best.sim.ratio)}          ${pc(s.best.sim.within)}          ${f(s.best.sim.cv)}`);
 }
 for(const c of cross)console.log(`\n교차 예측 ${c.from}→${c.to}: 승객대기÷계획 실측 ${f(c.observed.ratio)} vs 예측 ${f(c.simulated.ratio)} · 1분 안 ${pc(c.observed.within)} vs ${pc(c.simulated.within)}`);
 console.log('\n저장: '+out);
}catch(error){console.error(error.message);process.exitCode=1;}
