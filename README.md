# Bus Route Optimization

충무로·동국대 주변 버스 운행을 수학적으로 설명하고 비교하는 팀 프로젝트입니다.
**같은 노선·차량·속도·정차시간에서 출발 시점만 바꿔 효과를 비교합니다.**

## 문서

- [필요한 API와 연결 방법](docs/API.md)
- [수학 공식과 적용 위치](docs/MATHEMATICS.md)
- [구현 계획과 완료 기준](docs/IMPLEMENTATION_PLAN.md)
- [기존 구현 검토](docs/PROTOTYPE_REVIEW.md)
- [데이터 계약](docs/DATA_CONTRACT.md)
- [논의 내용](docs/MEETING_NOTES.md)
- [협업과 PR](CONTRIBUTING.md)
- [검증 결과](docs/VALIDATION.md)
- [GitHub 설정과 제한](docs/GITHUB_SETUP.md)
- [이슈 목록](docs/ISSUE_INDEX.md)

기본 데모는 API 키 없는 **가상 6거점 순환노선**입니다. 실측 결과로 발표하지 마세요.
첫 구현은 기능 브랜치 PR로 제공하며 리뷰 후 main에 병합합니다.
구현 브랜치에서 Node.js 22 이상으로 `npm test`, `npm start`를 실행합니다.

```sh
git switch feat/reproducible-simulator
npm test
npm start
```

브라우저에서 http://localhost:8080 을 엽니다. PR 병합 후에는 main에서도 실행할 수 있습니다.
`npm run experiment`는 비교 수치를 출력합니다. 화면에서 결과 JSON과 두 조건을 합친 CSV를 내려받을 수 있습니다.

`legacy/`는 팀원이 제공한 원본 보존용이며 알려진 오류가 있어 결과 산출에 사용하지 않습니다.
API 비밀키·원시 차량 식별정보는 커밋하지 않습니다. 공개 라이선스는 팀 합의 전 부여하지 않습니다.

## 실제 지도 및 팀 자료 (2026-09-30)

`npm start`는 로컬 `.env`에서 `KAKAO_MAP_JS_KEY`를 읽습니다. 카카오 개발자 콘솔의 JavaScript SDK 도메인에 `http://localhost:8080`을 등록하세요. 브라우저 키는 도메인 제한을 사용하며, 서버용 `SEOUL_BUS_SERVICE_KEY`는 공개하지 않습니다.

`data/public/stations.json`에는 충무로역~동국대 사이 중심 반경 800m 안의 모든 승차 정류장(`getStationByPos`)과 정류장별 경유 노선(`getRouteByStation`)을 보존합니다. 이름이 같은 정류장도 ID별로 구분하고, 미정차 지점(ARS 0)은 제외합니다. 배차간격은 기관 계획값이며 실측이 아닙니다. 수집시각과 출처는 데이터 및 화면에 표시됩니다. 화면의 "노선 쌍" 표는 정류장 공유 수만 셉니다. 시간표 겹침이나 혼잡 원인을 뜻하지 않습니다.

```sh
npm run collect:area              # 기본 중심·반경 800m, API 호출 = 정류장 수 + 1
npm run collect:area -- 127.0000 37.5595 1000
npm start
```

노선 경로·정류장 순서(노선정보조회 15000193)는 `npm run collect:routes`로 `data/public/routes.json`에 저장합니다(노선 수 × 2회 호출). "정차면 나누기" 화면은 이 실제 경로 위에서 버스를 움직이고, 선택한 정류장에서만 정차면 줄을 계산합니다. 속도(평균 15km/h)와 차량 수는 가정값입니다. "실제 버스 위치" 표시는 서버가 버스위치정보(15000332)를 수집한 노선에 한해 30초 캐시로 중계하며, 인증키는 브라우저로 나가지 않습니다.

고른 정류장에 도착한 버스마다 도착 시각·노선·자리·기다린 시간·앞에 있던 노선을 기록합니다. 화면의 "문제가 생긴 곳" 표에서 노선 쌍별로 모아 보고, 세 방식의 2시간 기록을 CSV로 받을 수 있습니다. 같은 조건과 seed는 노선을 나열한 순서와 관계없이 같은 결과를 냅니다.

"지금 조건의 결과 기록하기"를 누르면 조건(정류장, 서는 방식, 오는 시점, 정차 시간, seed, 함께 달림 기준)과 2시간 결과가 실험 기록에 쌓입니다. 기록은 그 브라우저에 저장되고(localStorage) CSV로 받아 팀원과 나눌 수 있습니다. 같은 조건을 다시 기록하면 덮어씁니다.

이름 검색만 필요하면 `npm run collect -- stations 충무로 json` 후 `node scripts/import-stops.mjs <생성된 파일>`을 씁니다(경유 노선 없이 덮어씀).

서울시 API는 이번 환경에서 공식 HTTP 주소로 응답을 확인했고 HTTPS 요청은 시간 초과됐습니다. 현재 수집은 로컬에서만 수행합니다. 공개 배포 전에는 HTTPS 지원 게이트웨이 또는 공개 데이터 스냅샷 갱신 방식을 확정해야 합니다. Cloudflare에 인증키를 브라우저 코드로 올리지 마세요.

팀 자료 연결은 `docs/TEAM_EVIDENCE.md`, 두 거점 목록은 `data/reference/hub-models.json`을 참고하세요. 실제 노선 순서 수집과 다중 노선 최적화는 아직 완료되지 않았습니다. 지도 표시가 가상 실험 결과를 실측으로 바꾸지는 않습니다.
