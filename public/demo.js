// 발표 모드: PPT 시연 조건을 버튼 하나(또는 숫자 키 1~7)로 바로 보여 준다.
// 주소에 ?demo=1 을 붙이거나 위쪽 "발표 모드" 버튼으로 켠다. 끄면 기존 화면 그대로다.
// 조건은 보고서 실험(scripts/paper-experiments.mjs)과 같고, 시드 1의 한 번 실행이다.
import {applyScenario} from '/public/berths.js';
import {queueDemoRun} from '/public/route-map.js';
const $=id=>document.getElementById(id);
const START=30*60,RATE=30; // 줄이 생긴 30분 시점부터 30배속으로
const P34={tsp:'1',dwell:30,stopDwell:15};
const SCENES=[
 ['추월 가능',{lane:'free'}],
 ['추월 불가 · 지금 구조 (S0)',{}],
 ['정차면 4곳으로 연장',{berths:4}],
 ['분리 정류장 · 추월 공간 없음',{split:'nopass',berths:2},'colored'],
 ['분리 정류장 · 추월 공간 있음',{split:'pass',berths:2},'colored'],
 ['우선신호 + 승하차 단축',P34],
 ['우선신호 + 승하차 단축 + 간격 조정',{...P34,hold:'0.6'}],
];
const AREAS=[['','03003','신용산역'],['ilsan','20227','일산동구청']];
let area='',current=-1;

const bar=$('demo-bar'),list=$('demo-scenes'),caption=$('demo-caption');
SCENES.forEach(([label],i)=>{
 const b=document.createElement('button');b.type='button';b.dataset.i=i;
 b.innerHTML='<kbd></kbd><span></span>';b.firstChild.textContent=i+1;b.lastChild.textContent=label;
 list.append(b);
});
for(const [value,,name] of AREAS){
 const b=document.createElement('button');b.type='button';b.dataset.area=value;b.textContent=name;$('demo-areas').append(b);
}

async function show(i){
 current=i;document.activeElement?.blur(); // 누른 버튼에 초점 테두리가 남지 않게
 const [label,settings,rule='pooled']=SCENES[i],[,stop,name]=AREAS.find(([value])=>value===area);
 for(const b of list.children)b.classList.toggle('on',Number(b.dataset.i)===i);
 for(const b of $('demo-areas').children)b.classList.toggle('on',b.dataset.area===area);
 caption.hidden=false;caption.querySelector('b').textContent=`${i+1}. ${label}`;caption.querySelector('span').textContent=`${name} · 2시간 중 30분부터 · 시연은 한 번 실행(결과는 30회 평균)`;
 document.querySelector(`input[name=rate][value="${RATE}"]`).checked=true;
 await applyScenario({area,stop,...settings},()=>queueDemoRun({rule,at:START,rate:RATE}));
}

function setDemo(on){
 document.body.classList.toggle('demo',on);bar.hidden=!on;$('demo-toggle').setAttribute('aria-pressed',String(on));
 if(!on)caption.hidden=true;
 const url=new URL(location.href);on?url.searchParams.set('demo','1'):url.searchParams.delete('demo');history.replaceState(null,'',url);
 dispatchEvent(new Event('resize')); // 패널이 숨거나 나타나면 지도 크기를 다시 잡는다
}

list.addEventListener('click',event=>{const b=event.target.closest('button');if(b)show(Number(b.dataset.i));});
$('demo-areas').addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 area=b.dataset.area;show(current<0?1:current);
});
$('demo-toggle').addEventListener('click',()=>setDemo(!document.body.classList.contains('demo')));
addEventListener('keydown',event=>{
 if(!document.body.classList.contains('demo')||event.target.closest('input,select,textarea'))return;
 const n=Number(event.key);
 if(n>=1&&n<=SCENES.length){event.preventDefault();show(n-1);}
});
// 청중용 주소(?view=public)는 팀 전용 기능(기록·삭제·팀 코드·실시간 버스·QR)을 숨긴다. 서버 권한은 그대로 팀 코드로 막혀 있다.
const query=new URLSearchParams(location.search);
if(query.get('view')==='public')document.body.classList.add('public');
const qr=$('demo-qr');
$('demo-qr-open').addEventListener('click',()=>{qr.hidden=false;$('demo-qr-close').focus();});
$('demo-qr-close').addEventListener('click',()=>{qr.hidden=true;});
qr.addEventListener('click',event=>{if(event.target===qr)qr.hidden=true;});
addEventListener('keydown',event=>{if(event.key==='Escape')qr.hidden=true;});
if(query.get('demo')==='1')setDemo(true);
