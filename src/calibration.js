// 실측과 시뮬레이션을 같은 잣대로 재는 지표. 둘 다 노선별 "정류장을 떠난(지나간) 시각(초)" 목록에서 계산한다.
// ratio: 승객 대기 ÷ 계획 배차대로였을 때의 대기 (몰릴수록 1보다 크다)
// within: 바로 앞 버스(노선 무관)와 60초 안에 연달아 온 비율
// cv: 같은 노선 버스 간격의 변동계수(표준편차 ÷ 평균) — 맞추는 데 쓰지 않고 검증에만 쓴다
import {passengerWait} from './routesim.js';
export function metrics(departures,headways,{from=0,to=Infinity,window=60}={}){
 const inside=Object.fromEntries(Object.entries(departures).map(([r,t])=>[r,t.filter(x=>x>=from&&x<=to).sort((a,b)=>a-b)]));
 const wait=passengerWait(inside,headways,-Infinity);
 const all=Object.values(inside).flat().sort((a,b)=>a-b),gaps=all.slice(1).map((t,i)=>t-all[i]);
 const own=Object.values(inside).flatMap(t=>t.slice(1).map((x,i)=>x-t[i]));
 const mean=own.reduce((s,g)=>s+g,0)/(own.length||1),sd=Math.sqrt(own.reduce((s,g)=>s+(g-mean)**2,0)/(own.length||1));
 return {passes:all.length,ratio:wait.planned?wait.actual/wait.planned:null,within:gaps.length?gaps.filter(g=>g<=window).length/gaps.length:null,cv:own.length?sd/mean:null};
}
