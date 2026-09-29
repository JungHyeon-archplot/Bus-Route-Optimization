import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const methods={
  stations:{path:'stationinfo/getStationByName',param:'stSrch'},
  route:{path:'busRouteInfo/getStaionByRoute',param:'busRouteId'},
  arrivals:{path:'arrive/getArrInfoByRouteAll',param:'busRouteId'}
};
export async function collect(kind,value,{key=process.env.SEOUL_BUS_SERVICE_KEY,fetchImpl=fetch}={}) {
  if(!methods[kind]||!value||value.length>60)throw new Error('사용법: stations 검색어 | route 노선ID | arrivals 노선ID');
  if(kind!=='stations'&&!/^\d{9}$/.test(value))throw new Error('노선ID는 조회한 9자리 ID를 사용하세요.');
  if(!key)throw new Error('SEOUL_BUS_SERVICE_KEY가 필요합니다. 실제 연결은 키 발급 후 검증하세요.');
  const url=new URL(methods[kind].path,'http://ws.bus.go.kr/api/rest/');
  // Use the decoded key from data.go.kr; URLSearchParams performs exactly one encoding.
  url.searchParams.set('serviceKey',key);url.searchParams.set(methods[kind].param,value);
  let response;
  try{response=await fetchImpl(url,{signal:AbortSignal.timeout(10000)});}catch{throw new Error('API 네트워크 오류 또는 10초 시간 초과');}
  if(!response.ok)throw new Error('API HTTP 오류 '+response.status);
  const xml=await response.text();
  if(!/<headerCd>\s*0\s*<\/headerCd>/.test(xml))throw new Error('기관 오류 또는 예상하지 못한 XML 응답; 활용승인과 인자를 확인하세요.');
  return xml;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [kind,value]=process.argv.slice(2);
  try{
    const xml=await collect(kind,value);
    const dir=fileURLToPath(new URL('../data/raw/',import.meta.url));await mkdir(dir,{recursive:true});
    const filename=kind+'-'+Date.now()+'.xml';await writeFile(path.join(dir,filename),xml,'utf8');
    console.log('로컬 원본 저장: data/raw/'+filename+' (정규화·실측 검토는 별도)');
  }catch(e){console.error(e.message);process.exitCode=1;}
}

