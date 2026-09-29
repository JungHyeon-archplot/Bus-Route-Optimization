import {scenario,postmanExample} from '/src/scenario.js';
import {simulate,busPosition,eventsCsv} from '/src/simulation.js';
import {chinesePostman} from '/src/graph.js';
const byId=id=>document.getElementById(id);
const results={baseline:simulate(scenario,'baseline'),staggered:simulate(scenario,'staggered')};
const palette=['#2463b4','#ad510f','#08736a'],ns='http://www.w3.org/2000/svg';
function svgElement(tag,attributes,text=''){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attributes))el.setAttribute(k,v);el.textContent=text;return el;}
const moving={};
for(const mode of Object.keys(results)){
  const svg=byId(mode+'-map');
  svg.append(svgElement('path',{d:'M '+[...scenario.stops,scenario.stops[0]].map(p=>p.x+','+p.y).join(' L '),class:'route'}));
  scenario.stops.forEach(p=>{
    svg.append(svgElement('circle',{cx:p.x,cy:p.y,r:12,class:'stop'}));
    svg.append(svgElement('text',{x:p.x,y:p.y-24,'text-anchor':'middle',class:'stop-label'},p.id+' '+p.name));
  });
  moving[mode]=Array.from({length:scenario.vehicles},(_,i)=>{
    const dot=svgElement('circle',{r:9,fill:palette[i],stroke:'white','stroke-width':2});
    const text=svgElement('text',{class:'bus-label'});
    svg.append(dot,text);return {dot,text};
  });
}
let elapsed=0,playing=false,previous=null;
function render(){
  for(const [mode,result] of Object.entries(results))moving[mode].forEach(({dot,text},i)=>{
    const p=busPosition(result,scenario,i,result.windowStart+elapsed);
    // Small display offset separates buses at the same stop; it does not change simulation positions.
    dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y+i*9);
    text.setAttribute('x',p.x+14);text.setAttribute('y',p.y+i*18+7);text.textContent=(i+1)+' '+p.state;
  });
  byId('timeline').value=String(elapsed);
  byId('clock').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0')+' / 60:00';
}
function frame(now){
  if(playing&&previous!==null){elapsed=Math.min(3600,elapsed+(now-previous)/1000*Number(byId('speed').value));if(elapsed===3600){playing=false;byId('play').textContent='재생';}}
  previous=now;render();requestAnimationFrame(frame);
}
byId('play').onclick=()=>{if(elapsed===3600)elapsed=0;playing=!playing;byId('play').textContent=playing?'일시정지':'재생';};
byId('reset').onclick=()=>{elapsed=0;playing=false;byId('play').textContent='재생';render();};
byId('timeline').oninput=e=>{elapsed=Number(e.target.value);render();};
const fmt=n=>n===null?'계산 불가':n.toFixed(1);
const cards=[
 ['평균 버스 진입 지연','meanBusDelay','초'],
 ['이론 평균 승객 대기','theoreticalPassengerWait','초'],
 ['최대 진입 대기 차량','maxQueue','대']
];
for(const [label,key,unit] of cards){
  const div=document.createElement('div');div.className='metric';
  const h=document.createElement('h3');h.textContent=label;
  const b=document.createElement('strong');b.textContent=fmt(results.baseline.metrics[key])+' → '+fmt(results.staggered.metrics[key])+unit;
  const small=document.createElement('small');small.textContent='동시 출발 → 분산 출발 · 전체 관측창';
  div.append(h,b,small);byId('metrics').append(div);
}
results.baseline.byStop.forEach((p,i)=>{
  const q=results.staggered.byStop[i],row=document.createElement('tr');
  for(const text of [p.name,p.visits+' / '+q.visits,fmt(p.meanBusDelay)+'초 / '+fmt(q.meanBusDelay)+'초',p.maxQueue+'대 / '+q.maxQueue+'대']){
    const td=document.createElement('td');td.textContent=text;row.append(td);
  }byId('stops').append(row);
});
const postman=chinesePostman(postmanExample);
byId('postman').textContent='필수 구간 '+postman.baseCost+'분 + 추가 '+postman.extraCost+'분 = 최소 '+postman.totalCost+'분';
byId('tour').textContent='계산된 순회: '+postman.tour.join(' → ');
function download(name,type,body){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
byId('download').onclick=()=>download('bus-experiment.json','application/json',JSON.stringify({metadata:scenario.metadata,scenario,assumptions:'가상 단일 정차면·모든 차량 이용 가능·무작위 승객 도착·정원 제한 없음',results,postman},null,2));
byId('csv').onclick=()=>{
  const rows=Object.entries(results).flatMap(([mode,result],i)=>eventsCsv(result).split('\n').flatMap((row,j)=>j===0?(i===0?['mode,'+row]:[]):[mode+','+row]));
  download('bus-comparison-events.csv','text/csv;charset=utf-8','\uFEFF'+rows.join('\n'));
};
render();requestAnimationFrame(frame);

