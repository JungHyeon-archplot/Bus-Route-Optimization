# 배포 (Cloudflare Workers)

주소: https://bus-route-lab.jhsimon7.workers.dev

## 구조

- 정적 파일(`dist/`): 화면, 브라우저 모듈, 수집해 둔 `stations.json`·`routes.json`·`observation.json`. `npm run build`가 필요한 파일만 복사하며 `.env`, `data/raw/`, 팀 원문 자료는 넣지 않습니다.
- Worker(`worker/index.js`)는 세 경로만 처리합니다.
  - `/config.json`: 브라우저용 카카오 지도 JavaScript 키.
  - `/live/buspos?routeId=`: 서울시 버스위치정보 API 중계. `routes.json`에 있는 노선만 허용하고, 응답을 10초 동안 엣지 캐시에 둡니다. 인증키는 브라우저로 나가지 않습니다.
  - `/records`: 팀 공유 실험 기록. Cloudflare D1(`bus-route-records`, 바인딩 `DB`)의 `records` 표에 기록마다 새 줄로 쌓습니다. 덮어쓰지 않고, 지우기는 `deleted_at`만 표시해 데이터베이스에는 남깁니다. 읽기는 누구나, 추가·삭제는 `x-team-code` 헤더가 비밀값 `TEAM_CODE`와 같을 때만 됩니다. 서버가 모든 항목을 다시 검사합니다(`src/records.js`). 표 구조는 `migrations/`에 있고 `npx wrangler d1 migrations apply bus-route-records --remote`로 적용합니다. 예전 KV(`RECORDS`)는 옮긴 뒤 쓰지 않습니다.
- 서울시 API는 `http://ws.bus.go.kr`만 응답합니다. 브라우저는 HTTPS 페이지에서 HTTP를 부를 수 없으므로 Worker가 대신 부릅니다.

## 처음 한 번

1. 비밀값 넣기 (값은 채팅·Git에 붙여넣지 않음):
   ```sh
   npx wrangler secret put KAKAO_MAP_JS_KEY
   npx wrangler secret put SEOUL_BUS_SERVICE_KEY
   npx wrangler secret put TEAM_CODE        # 팀원에게만 알려 주는 기록용 코드
   ```
   또는 대시보드 › Workers & Pages › bus-route-lab › Settings › Variables and Secrets.
2. 카카오 개발자 콘솔 › 앱(Bus Route Optimization) › 플랫폼 › Web 사이트 도메인에 `https://bus-route-lab.jhsimon7.workers.dev` 추가.

## 다시 배포

```sh
npm test
npm run deploy     # = npm run build && npx wrangler deploy
```

자료를 새로 모았다면(`collect:area`, `collect:routes`, `observe`) 그 뒤에 다시 배포합니다.

## 로컬에서 Worker로 확인

`.env`를 `.dev.vars`로 복사한 뒤 `npx wrangler dev`. 카카오 지도는 등록된 도메인에서만 뜨므로 로컬 확인은 `npm start`(localhost:8080)를 씁니다.

## 한계

- 팀 코드는 짧은 공유 코드라 강한 보안이 아닙니다. 기록 목록을 장난으로 바꾸는 것을 막는 정도입니다. 코드를 바꾸려면 `TEAM_CODE`를 다시 넣으면 됩니다(`TEAM_CODE`를 지우면 누구나 기록 가능).
- 지운 기록까지 보려면: `npx wrangler d1 execute bus-route-records --remote --command "SELECT * FROM records"`
- 로컬 서버(`npm start`)에는 공유 저장소가 없어 기록이 그 브라우저에만 남습니다.
- 실시간 위치의 하루 호출 수를 Worker가 세지 않습니다(KV나 Durable Object가 필요). 엣지 캐시와 서울시 개발계정 한도(기능별 하루 1,000회)가 상한입니다. 발표 전날 과도하게 켜 두지 마세요.
- 무료 Workers 한도(하루 100,000 요청, 요청당 CPU 10ms)는 배포 직전에 다시 확인합니다.
