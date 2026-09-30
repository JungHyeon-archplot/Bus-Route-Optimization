let sdkPromise;
export function loadSdk(key){
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
