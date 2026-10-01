import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {normalizeStations} from '../src/data/normalize.js';
try{
 const input=JSON.parse(await readFile(process.argv[2],'utf8'));
 if(String(input.response?.msgHeader?.headerCd)!=='0')throw new Error('서울시 응답 성공 코드가 아닙니다.');
 const dataset=normalizeStations(input.response.msgBody?.itemList??[],{
  datasetId:'seoul-chungmuro-'+(input.fetchedAt?.slice(0,10)||'unknown'),
  source:'서울특별시_정류소정보조회 서비스 (공공데이터포털 15000303)',
  fetchedAt:input.fetchedAt,coordinateSystem:'WGS84'
 });
 const dir=fileURLToPath(new URL('../data/public/',import.meta.url));
 await mkdir(dir,{recursive:true});await writeFile(dir+'stations.json',JSON.stringify(dataset,null,2)+'\n');
 console.log(`정규화 완료: ${dataset.stops.length}개 정류장. 원본의 검색 범위만 포함합니다.`);
}catch(error){console.error(error.message);process.exitCode=1;}
