import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const methods={
  stations:{path:'stationinfo/getStationByName',param:'stSrch'},
  route:{path:'busRouteInfo/getStaionByRoute',param:'busRouteId'},
  arrivals:{path:'arrive/getArrInfoByRouteAll',param:'busRouteId'}
};
export async function collect(kind,value,{key=process.env.SEOUL_BUS_SERVICE_KEY,fetchImpl=fetch,format='xml'}={}) {
  if(!['xml','json'].includes(format))throw new Error('지원 형식: xml 또는 json');
  if(!methods[kind]||!value||value.length>60)throw new Error('사용법: stations 검색어 | route 노선ID | arrivals 노선ID');
  if(kind!=='stations'&&!/^\d{9}$/.test(value))throw new Error('노선ID는 조회한 9자리 ID를 사용하세요.');
  return request(methods[kind].path,{[methods[kind].param]:value},{key,fetchImpl,format});
}
export async function request(apiPath,params,{key=process.env.SEOUL_BUS_SERVICE_KEY,fetchImpl=fetch,format='json'}={}) {
  if(!key)throw new Error('SEOUL_BUS_SERVICE_KEY가 필요합니다. 실제 연결은 키 발급 후 검증하세요.');
  const url=new URL(apiPath,'http://ws.bus.go.kr/api/rest/');
  // Use the decoded key from data.go.kr; URLSearchParams performs exactly one encoding.
  url.searchParams.set('serviceKey',key);
  for(const [name,value] of Object.entries(params))url.searchParams.set(name,value);
  if(format==='json')url.searchParams.set('resultType','json');
  let response;
  try{response=await fetchImpl(url,{signal:AbortSignal.timeout(10000)});}catch{throw new Error('API 네트워크 오류 또는 10초 시간 초과');}
  if(!response.ok)throw new Error('API HTTP 오류 '+response.status);
  const xml=await response.text();
  if(format==='json'){
    let result;try{result=JSON.parse(xml);}catch{throw new Error('예상하지 못한 JSON 응답');}
    // headerCd 4 = 결과 없음: an empty list, not a failure.
    const code=String(result.msgHeader?.headerCd);
    if(code!=='0'&&code!=='4')throw new Error('기관 오류; 활용승인과 인자를 확인하세요.');
    return result;
  }
  if(!/<headerCd>\s*0\s*<\/headerCd>/.test(xml))throw new Error('기관 오류 또는 예상하지 못한 XML 응답; 활용승인과 인자를 확인하세요.');
  return xml;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [kind,value,format='xml']=process.argv.slice(2);
  try{
    const response=await collect(kind,value,{format});
    const dir=fileURLToPath(new URL('../data/raw/',import.meta.url));await mkdir(dir,{recursive:true});
    const filename=kind+'-'+Date.now()+'.'+format;
    const content=format==='json'?JSON.stringify({fetchedAt:new Date().toISOString(),query:value,response},null,2):response;
    await writeFile(path.join(dir,filename),content,'utf8');
    console.log('로컬 원본 저장: data/raw/'+filename+' (정규화·실측 검토는 별도)');
  }catch(e){console.error(e.message);process.exitCode=1;}
}

