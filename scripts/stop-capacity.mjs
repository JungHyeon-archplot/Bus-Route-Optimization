// 정류장 용량 공식(TCQSM 계열)과 시뮬레이터를 맞대어 본다.
// 1) 유효 정차면 수: 줄이 끊기지 않는(포화) 정류장에서 정차면을 1~4곳으로 늘릴 때 시간당 처리 대수가 몇 배가 되는지 잰다.
//    추월 불가(중앙차로)와 추월 가능을 비교하고, 1994 HCM 표(1.00·1.75·2.25·2.45)와 견준다.
// 2) 정차면 용량 B = N_eb × 3600 / (t_c + t_d + Z·c_v·t_d) 와 정류장별 계획 수요(시간당 대수)를 비교해 v/c를 낸다.
// Usage: node scripts/stop-capacity.mjs
import {readFile} from 'node:fs/promises';
import {prepareRoute,runFor} from '../src/routesim.js';
import {conflictGraph} from '../src/coloring.js';

// 포화 실험용 직선 노선 40개(배차 1분): 정류장 앞 줄이 늘 차 있게 한다.
const line=Array.from({length:21},(_,i)=>[37.56,127+i*0.00113]),path=[...line,...line.slice(0,-1).reverse()];
const sat=Array.from({length:40},(_,i)=>prepareRoute({id:'r'+String(i).padStart(2,'0'),termMinutes:1,path,stops:[{arsId:'X',lat:37.56,lng:127+10*0.00113}]}));
// 정차 40초 ±100% 균등분포 → 변동계수 1/√3 ≈ 0.58 (TCQSM이 현장 자료가 없을 때 권하는 0.6에 가깝다).
const throughput=(berths,overtake,extra={})=>{
 const runs=[1,2,3,4,5].map(seed=>runFor(sat,{focus:'X',rule:berths===1?'single':'pooled',berths,dwell:40,dwellJitter:1,overtake,speed:10,seed,...extra},3*3600));
 return runs.reduce((s,r)=>s+r.served,0)/runs.length/3;
};
const HCM1994=[1,1.75,2.25,2.45];
console.log('1) 유효 정차면 수 (포화 상태, 정차 40초·변동계수 0.58, 3시간 · seed 5개 평균)');
const one=throughput(1,false),neb=[];
for(const n of [1,2,3,4]){
 const lane=throughput(n,false),free=throughput(n,true);neb.push(lane/one);
 console.log(`  ${n}곳: 추월 불가 ${lane.toFixed(0)}대/시 (유효 ${(lane/one).toFixed(2)}곳) · 추월 가능 ${free.toFixed(0)}대/시 (유효 ${(free/one).toFixed(2)}곳) · 1994 HCM 표 ${HCM1994[n-1]}`);
}
const alt=Object.fromEntries(sat.map((p,i)=>[p.route.id,i%2]));let splitNeb;
for(const passing of [true,false]){
 const t=throughput(2,false,{zones:2,zoneOf:alt,passing});if(passing)splitNeb=t/one;
 console.log(`  분리 2곳×2면 (${passing?'추월 공간 있음':'추월 공간 없음'}): ${t.toFixed(0)}대/시 (유효 ${(t/one).toFixed(2)}곳) — 같은 4면을 한 줄로 두면 ${neb[3].toFixed(2)}곳`);
}

// 2) 정류장별 수요와 용량.
const read=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));
const tc=10,Z=1.04,cv=.6; // 출차 10초, 실패율 15%(TCQSM 도심 권장 상한)에 해당하는 Z, 변동계수 0.6
const capacity=(td,berths,eff)=>eff[berths-1]*3600/(tc+td+Z*cv*td);
console.log(`\n2) 정류장 용량 B = N_eb × 3600 / (t_c + t_d + Z·c_v·t_d), t_c=${tc}초, Z=${Z}(실패율 15%), c_v=${cv}. N_eb는 위에서 잰 추월 불가 값.`);
for(const [dir,arsId] of [['','03003'],['','03007'],['ilsan/','20227'],['ilsan/','20249']]){
 const area=await read(`data/public/${dir}stations.json`),{routes}=await read(`data/public/${dir}routes.json`);
 const graph=conflictGraph(area,arsId,{minShared:3}),byId=new Map(routes.map(r=>[r.id,r]));
 const demand=graph.nodes.reduce((s,n)=>s+60/(byId.get(n.id)?.termMinutes??10),0);
 const row=[[40,3],[40,4],[30,3]].map(([td,b])=>`정차 ${td}초·${b}곳 용량 ${capacity(td,b,neb).toFixed(0)}대 → v/c ${(demand/capacity(td,b,neb)).toFixed(2)}`);
 for(const td of [40,30]){const c=splitNeb*3600/(tc+td+Z*cv*td);row.push(`분리 2곳×2면(추월 공간)·정차 ${td}초 용량 ${c.toFixed(0)}대 → v/c ${(demand/c).toFixed(2)}`);}
 console.log(`  ${graph.stop.name}(${arsId}) 노선 ${graph.nodes.length}개 · 계획 수요 ${demand.toFixed(0)}대/시 | ${row.join(' | ')}`);
}
