let sdkPromise;
function loadSdk(key){
 if(window.kakao?.maps?.Map)return Promise.resolve();
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
 const fail=message=>{clearTimeout(timer);script.remove();sdkPromise=undefined;reject(new Error(message));};
 const timer=setTimeout(()=>fail('지도 응답 시간이 초과됐습니다.'),15000);
  script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(key);
  script.onerror=()=>fail('지도 인증 또는 네트워크 연결을 확인하세요.');
  script.onload=()=>{
   if(!window.kakao?.maps?.load){fail('지도 SDK를 사용할 수 없습니다.');return;}
   window.kakao.maps.load(()=>{clearTimeout(timer);resolve();});
  };
  document.head.append(script);
 });
 return sdkPromise;
}
export async function mountMap(element,dataset,config){
 if(!config.kakaoJsKey)throw new Error('지도 키가 아직 설정되지 않았습니다.');
 await loadSdk(config.kakaoJsKey);
 const maps=window.kakao.maps;
 const map=new maps.Map(element,{center:new maps.LatLng(37.558,126.998),level:5});
 const bounds=new maps.LatLngBounds();
 const markers=[];
 for(const stop of dataset.stops){
  const position=new maps.LatLng(stop.lat,stop.lng);
  const marker=new maps.Marker({map,position,title:`${stop.name} · ${stop.arsId} · ${stop.id}`});
  markers.push(marker);bounds.extend(position);
 }
 if(markers.length)map.setBounds(bounds);
 return {resize(){map.relayout();if(markers.length)map.setBounds(bounds);},destroy(){for(const marker of markers)marker.setMap(null);element.replaceChildren();}};
}
