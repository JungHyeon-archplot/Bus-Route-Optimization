export const scenario = {
  metadata: { sourceType: 'synthetic', source: '교육용 가정; 실제 도로·정류장 ID 아님', units: 'm, s' },
  stops: [
    {id:'A',name:'충무로역',x:130,y:110}, {id:'B',name:'퇴계로5가',x:360,y:80},
    {id:'C',name:'동국대 후문',x:560,y:160}, {id:'D',name:'동대입구역',x:560,y:330},
    {id:'E',name:'국립극장',x:350,y:390}, {id:'F',name:'남산예장',x:120,y:310}
  ],
  edges: [
    {id:'AB',from:'A',to:'B',lengthM:900}, {id:'BC',from:'B',to:'C',lengthM:900},
    {id:'CD',from:'C',to:'D',lengthM:900}, {id:'DE',from:'D',to:'E',lengthM:900},
    {id:'EF',from:'E',to:'F',lengthM:900}, {id:'FA',from:'F',to:'A',lengthM:900}
  ],
  speedMps:10, dwellSec:25, headwaySec:720, vehicles:3
};
export const postmanExample = [
  ['A','B',2],['B','C',2],['C','D',3],['D','E',2],['E','F',3],['F','A',4],['A','C',3]
].map(([from,to,weight],i)=>({id:String(i),from,to,weight}));
export function validateScenario(s) {
  if (s.metadata?.sourceType !== 'synthetic') throw new Error('현재 엔진은 검증된 가상 스키마만 지원합니다.');
  if (!Array.isArray(s.stops) || s.stops.length < 2) throw new Error('정류장 부족');
  const ids = new Set(s.stops.map(p=>p.id));
  if (ids.size !== s.stops.length) throw new Error('정류장 ID 중복');
  if (s.edges.length !== s.stops.length) throw new Error('순환 구간 수 불일치');
  if (new Set(s.edges.map(e=>e.id)).size!==s.edges.length) throw new Error('간선 ID 중복');
  s.stops.forEach(p=>{if(!p.id || !Number.isFinite(p.x)||!Number.isFinite(p.y)) throw new Error('정점 형식 오류');});
  s.edges.forEach((e,i)=>{
    if(e.from!==s.stops[i].id || e.to!==s.stops[(i+1)%s.stops.length].id) throw new Error('연결이 끊긴 순환 경로');
    if(!Number.isFinite(e.lengthM)||e.lengthM<=0) throw new Error('길이는 양수');
  });
  for(const key of ['speedMps','dwellSec','headwaySec']) if(!Number.isFinite(s[key])||s[key]<=0) throw new Error(key+' 양수 필요');
  if(!Number.isInteger(s.vehicles)||s.vehicles<1||s.vehicles>12) throw new Error('차량 수 1~12');
  return true;
}

