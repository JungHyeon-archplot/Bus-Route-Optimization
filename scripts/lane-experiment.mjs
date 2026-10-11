// 추월 불가 중앙차로 정류장에서 연쇄 지연을 켜고 ITS 대책(진입 간격·배차간격 유지·버스우선신호)과 정차 시간 단축을 비교한다.
// Usage: node scripts/lane-experiment.mjs [arsId=03003] [정차면=3] [seed 수=20] [지역: 비우면 서울, ilsan]
import {readFile} from 'node:fs/promises';
import {prepareRoute,runFor} from '../src/routesim.js';
import {conflictGraph,colorGraph,splitRoutes} from '../src/coloring.js';
const read=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));
const dir=process.argv[5]?`data/public/${process.argv[5]}/`:'data/public/';
const area=await read(dir+'stations.json'),{routes}=await read(dir+'routes.json');
const arsId=process.argv[2]??'03003',berths=Number(process.argv[3]??3),seeds=Number(process.argv[4]??20);
const graph=conflictGraph(area,arsId,{minShared:3}),{colors,assignment:full}=colorGraph(graph.nodes,graph.edges);
// 실제 중앙 정류장은 정차면이 3곳 안팎이다. 필요한 색(=자리)이 그보다 많으면 색 번호를 정차면에 돌아가며 나눠 배정한다.
const assignment=Object.fromEntries(Object.entries(full).map(([id,c])=>[id,c%berths]));
const preps=routes.filter(r=>graph.nodes.some(n=>n.id===r.id)).map(prepareRoute);
// 분리 정류장 2곳: 시간당 버스 수를 반씩 나눈다.
const volume=Object.fromEntries(preps.map(p=>[p.route.id,60/(p.route.termMinutes??10)]));
const {zoneOf,load}=splitRoutes(graph.nodes,volume,2);
const split=passing=>({zones:2,berths:2,zoneOf,passing});
// 공통: 추월 불가, 빈 곳 아무 데나, 연쇄 지연, 정류장 120m 앞 신호(주기 150초·녹색 60초).
// 흔들림(noise .45·startJitter 1)은 승객 대기가 계획의 약 1.5배가 되도록 맞췄다(9/30 서울 실측 463번: 2.20분 ÷ 1.42분 = 1.55배).
// 실측 보정값(data/public/calibration.json)이 있으면 그 지역 값을 쓴다.
const calib=await read('data/public/calibration.json').then(c=>c.areas?.[process.argv[5]||'seoul'],()=>null);
const {noise=.45,startJitter=1}=calib??{};
console.log(`흔들림: noise ${noise} · startJitter ${startJitter} (${calib?calib.observation+' 실측 보정':'9/30 실측 기준 기본값'})`);
const base={focus:arsId,rule:'pooled',assignment,berths,dwell:40,overtake:false,cascade:true,noise,startJitter,signal:true,meterAt:50};
const cases=[
 ['현재 (대책 없음)',{}],
 ['노선별 지정 정차',{rule:'colored'}],
 ['하나의 정류장 4면',{berths:4}],
 ['분리 2곳×2면 (추월 공간 없음)',split(false)],
 ['분리 2곳×2면 (추월 공간 있음)',split(true)],
 ['진입 간격 13초',{meterGap:13}],
 ['배차간격 유지(BMS) 0.6H',{holdRatio:.6}],
 ['배차간격 유지(BMS) 0.8H',{holdRatio:.8}],
 ['버스우선신호(TSP)',{tsp:true}],
 ['BMS 0.6H + TSP',{holdRatio:.6,tsp:true}],
 ['정차 30초로 단축',{dwell:30,stopDwell:15}],
 ['BMS 0.6H + TSP + 정차 단축',{holdRatio:.6,tsp:true,dwell:30,stopDwell:15}],
 ['분리(추월 공간) + 정차 단축',{...split(true),dwell:30,stopDwell:15}],
 ['분리(추월 공간) + TSP + 정차 단축',{...split(true),tsp:true,dwell:30,stopDwell:15}],
];
const m=v=>v.reduce((a,b)=>a+b,0)/v.length,min=s=>`${Math.floor(s/60)}분${String(Math.round(s%60)).padStart(2,'0')}초`;
console.log(`분리 정류장 시간당 버스: 앞 ${load[0].toFixed(0)}대 · 뒤 ${load[1].toFixed(0)}대`);
console.log(`${arsId} ${graph.stop.name} · 노선 ${preps.length}개 · 필요한 자리 ${colors}곳 · 실제 ${berths}곳 · 추월 불가 · 연쇄 지연 · 2시간 · seed 1~${seeds}`);
for(const [label,o] of cases){
 const runs=Array.from({length:seeds},(_,i)=>runFor(preps,{...base,seed:i+1,...o},7200));
 console.log(label.padEnd(24),
  '버스 지연',min(m(runs.map(r=>r.delay))).padStart(9),
  '(줄',min(m(runs.map(r=>r.totalWait))),'갇힘',min(m(runs.map(r=>r.exitWait))),'신호',min(m(runs.map(r=>r.signalWait))),'통제',min(m(runs.map(r=>r.hold)))+')',
  '| 승객 대기',min(m(runs.map(r=>r.passenger.actual))),'(계획',min(runs[0].passenger.planned)+')',
  '| 최장 줄',m(runs.map(r=>r.maxQueue)).toFixed(1)+'대');
}
