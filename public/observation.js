import {summarizeObservation} from '/src/observation.js';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const colors=['#2f6fde','#e0523c','#1e9e6a','#8a5cd1'];
const clock=ms=>new Date(ms).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});
const el=(tag,attrs,text='')=>{const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);node.textContent=text;return node;};
try{
 const response=await fetch('/observation.json');
 if(!response.ok)throw new Error('none');
 const obs=await response.json(),s=summarizeObservation(obs);
 const start=Date.parse(obs.startedAt),end=Date.parse(obs.endedAt),x=t=>40+(t-start)/(end-start||1)*660;
 const svg=$('obs-strip');svg.replaceChildren();
 obs.routes.forEach((route,i)=>{
  const y=20+i*28;
  svg.append(el('text',{x:0,y:y+5,class:'obs-label'},route.name));
  svg.append(el('line',{x1:40,x2:700,y1:y,y2:y,class:'obs-axis'}));
  for(const pass of obs.passes.filter(p=>p.route===route.name)){
   const c=el('circle',{cx:x(Date.parse(pass.time)),cy:y,r:6,fill:colors[i%colors.length]});c.append(el('title',{},`${route.name}번 ${pass.plainNo} ${clock(Date.parse(pass.time))}`));svg.append(c);
  }
 });
 svg.append(el('text',{x:40,y:106,class:'obs-label'},clock(start)));svg.append(el('text',{x:700,y:106,'text-anchor':'end',class:'obs-label'},clock(end)));
 const heads=Object.entries(s.byRoute).map(([name,r])=>`${name}번 ${r.count}대(계획 ${r.planned}분 간격${r.headways.length?`, 실제 ${Math.min(...r.headways).toFixed(0)}~${Math.max(...r.headways).toFixed(0)}분`:''})`).join(', ');
 const share=s.gaps.length?Math.round(s.within/s.gaps.length*100):0,expected=Math.round(s.expectedShare*100);
 $('obs-summary').textContent=s.passes<2?`관측 중이거나 통과 기록이 부족합니다(${s.passes}회).`
  :`${new Date(start).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})} ${clock(start)}~${clock(end)}, ${obs.stop.name}을 지난 ${obs.routes.map(r=>r.name).join('·')}번 버스 ${s.passes}대를 기록했습니다. 연달아 온 두 대 사이 ${s.gaps.length}번 가운데 ${s.within}번(${share}%)이 1분 안이었습니다. 버스가 서로 상관없이 무작위로 온다면 약 ${expected}%입니다.`;
 $('obs-note').textContent=`${heads}. 서울시 버스위치정보 API를 ${obs.pollSeconds}초마다 조회해 버스가 이 정류장을 지난 시각을 기록했습니다. 버스는 약 20초마다 위치를 보내므로 시각 오차는 수십 초입니다. 한 번의 짧은 관측이라 일반화할 수 없습니다.`;
}catch{
 $('obs-summary').textContent='아직 관측 자료가 없습니다. npm run observe 로 관측하면 여기에 표시됩니다.';
}
