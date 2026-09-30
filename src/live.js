// Shared by the local server and the Cloudflare worker: the page gets positions only, never the key.
export const CSP="upgrade-insecure-requests; default-src 'self'; script-src 'self' https://dapi.kakao.com https://t1.daumcdn.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.daumcdn.net https://*.kakaocdn.net; connect-src 'self' https://dapi.kakao.com; object-src 'none'; frame-ancestors 'none'";
export function toLiveBuses(routeId,response){
 const buses=(response.msgBody?.itemList??[]).map(item=>({vehId:item.vehId,plainNo:item.plainNo,lat:Number(item.gpsY),lng:Number(item.gpsX),dataTm:item.dataTm,stopFlag:item.stopFlag==='1'}))
  .filter(bus=>Number.isFinite(bus.lat)&&Number.isFinite(bus.lng));
 return {routeId,fetchedAt:new Date().toISOString(),buses};
}
