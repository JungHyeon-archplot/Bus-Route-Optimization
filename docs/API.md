# 필요한 API와 연결 방법

확인일: 2026-09-28. 키 발급·이용승인·현재 할당량은 팀 계정에서 확인합니다.
키 없는 데모와 실제 API 연결 성공은 구분합니다.

| 우선순위 | 서비스 | 사용 위치 | 입력과 결과 |
|---|---|---|---|
| 필수 | [서울 노선정보](https://www.data.go.kr/data/15000193/openapi.do) | 실제 정류장 순서·방향 | busRouteId → seq, station, stationNo, gpsX/Y, direction |
| 필수 | [서울 정류소정보](https://www.data.go.kr/data/15000303/openapi.do) | 정류장 후보와 고유 ID | stSrch → stId, stNm, arsId, 좌표 |
| 실측 | [서울 도착정보](https://www.data.go.kr/data/15000314/openapi.do) | 도착 간격 관측 자료 | busRouteId → 정류장별 도착예정정보 |
| 후속 | [서울 버스위치](https://www.data.go.kr/data/15000332/openapi.do) | 위치 시계열·정차 추정 | 노선 ID → 위치·정류장 도착 여부 |
| 화면 확장 | [Kakao Maps JavaScript](https://apis.map.kakao.com/web/guide/) | 배경지도·정류장·경로 표시 | JavaScript 키와 등록 도메인 |
| 선택 | [Kakao Mobility 길찾기](https://developers.kakaomobility.com/guide/) | 자동차 경로·시간 참고 | 버스 통행 가능 경로의 증명은 아님 |

서울열린데이터광장 키와 공공데이터포털 serviceKey를 혼용하지 않습니다.
예상 도착시간을 실제 도착 사건으로 단정하지 않습니다. 기관의 출처표시·이용조건을 따릅니다.

## 확인된 요청 경로

공식 문서 기준 주소: `http://ws.bus.go.kr/api/rest`.
HTTP는 암호화되지 않으므로 실운영 전 기관의 HTTPS 지원 여부를 확인합니다.
수집은 명시적으로 실행하며 브라우저에 serviceKey를 전달하지 않습니다.

| 목적 | 경로 | 인자 |
|---|---|---|
| 정류장 검색 | /stationinfo/getStationByName | stSrch |
| 노선별 정류장 | /busRouteInfo/getStaionByRoute | busRouteId |
| 노선 전체 도착예정 | /arrive/getArrInfoByRouteAll | busRouteId |

`getStaionByRoute`는 공식 명세 철자 그대로입니다. 공통 serviceKey는 환경변수에서만 읽습니다.
서비스별 JSON 지원 차이가 있어 초기 수집기는 XML을 로컬 저장하고 기관 오류 코드도 검사합니다.

## 사용 순서

1. 공공데이터포털에서 서비스별 활용 신청. `.env.example`을 `.env`로 복사해 개인 키 입력.
2. `npm run collect -- stations 충무로`로 후보 조회. ID와 운행 방향을 사람이 확인.
3. `npm run collect -- route <busRouteId>`로 정류장 순서 확보. 실제 조회한 ID만 사용.
4. 원본은 Git에서 제외되는 `data/raw/`에 저장. 데이터 계약에 맞춰 정규화한 뒤 검토 PR 생성.
5. 도착정보는 승인된 할당량·보관 조건 안에서 수집. 기본 코드에는 자동 반복 수집이 없음.
6. 실패·무응답·기관 오류는 성공 데이터로 취급하지 않음. 키를 포함한 요청 URL을 로그에 남기지 않음.

수집 도구는 mock 응답 테스트를 제공하며 실제 키 연결은 미검증입니다.
원본 수집만으로 데모 데이터가 실제 데이터로 교체되지는 않습니다.

## 카카오 지도

개발자 앱의 JavaScript 키와 SDK 도메인을 설정합니다(예: http://localhost:8080).
JavaScript 키는 브라우저에 필요한 키이므로 도메인 제한을 적용합니다.
REST 키와 serviceKey는 서버 전용이며 종류를 구분합니다.

지도는 계산 결과를 그리는 도구입니다. 최적화 기능 자체가 아닙니다.
현재 MVP는 키 없는 SVG 개념도를 사용하고 카카오 모듈은 후속 이슈로 둡니다.

## API만으로 알 수 없는 것

승객별 출발지·목적지, 환승 의사, 정차 지연 원인, 새 노선의 운행 허용 여부, 인력 조건은
별도 조사·가정이 필요합니다. 실측이 없는 값을 실측이라고 표기하지 않습니다.
