# Bus Route Optimization

충무로·동국대 주변 버스 운행을 수학적으로 설명하고 비교하는 팀 프로젝트입니다.
**같은 노선·차량·속도·정차시간에서 출발 시점만 바꿔 효과를 비교합니다.**

## 프로젝트 한눈에 보기

| 항목 | 내용 |
| --- | --- |
| 목적 | 충무로·동국대 주변 정류장의 버스 도착·정차면 배치를 비교하는 시뮬레이터 |
| 형태 | 수업 팀 프로젝트 · 개발 중 |
| 본인 작업 | 수학적 모델·데이터 계약·협업 문서 정리, 실제 노선 지도 시뮬레이터 구현 PR |
| 구현 기술 | JavaScript, Node.js, 서울시 버스 API, Kakao Maps, Cloudflare Workers·D1 |
| 구현 상태 | [`feat/reproducible-simulator`의 PR #15](https://github.com/JungHyeon-archplot/Bus-Route-Optimization/pull/15)에서 리뷰 중 |

[지도 시뮬레이터 데모](https://bus-route-lab.jhsimon7.workers.dev/) · [구현 브랜치](https://github.com/JungHyeon-archplot/Bus-Route-Optimization/tree/feat/reproducible-simulator) · [개발자 프로필](https://github.com/JungHyeon-archplot)

현재 `main`은 문서와 기존 원본을 보관합니다. 실행 코드와 사용 방법은 구현 PR·브랜치에서 확인하세요. 데이터 수집 API와 지도 설정에 따라 데모 일부 기능은 제한될 수 있습니다.

### 구현 PR에서 확인할 수 있는 내용

- 서울시 정류장·경유 노선·도로 경로 자료 수집과 정규화
- 실제 경로 위의 버스 움직임과 정차면 배치·도착 시점 조건 비교
- 충돌 그래프 색칠, 실험 기록과 CSV 출력
- 서버를 통한 실시간 버스 위치 중계, Cloudflare Workers·D1 연결
- 재현 가능한 조건과 자동 테스트로 결과 확인

시뮬레이션의 속도·정차 시간 등 가정과 실측 자료를 구분합니다. 모의 결과를 실제 교통 개선 성과로 소개하지 않습니다.

## 문서

- [필요한 API와 연결 방법](docs/API.md)
- [수학 공식과 적용 위치](docs/MATHEMATICS.md)
- [구현 계획과 완료 기준](docs/IMPLEMENTATION_PLAN.md)
- [기존 구현 검토](docs/PROTOTYPE_REVIEW.md)
- [데이터 계약](docs/DATA_CONTRACT.md)
- [논의 내용](docs/MEETING_NOTES.md)
- [협업과 PR](CONTRIBUTING.md)

기본 데모는 API 키 없는 **가상 6거점 순환노선**입니다. 실측 결과로 발표하지 마세요.
첫 구현은 기능 브랜치 PR로 제공하며 리뷰 후 main에 병합합니다.
구현 브랜치에서 Node.js 22 이상으로 `npm test`, `npm start`를 실행합니다.

`legacy/`는 팀원이 제공한 원본 보존용이며 알려진 오류가 있어 결과 산출에 사용하지 않습니다.
API 비밀키·원시 차량 식별정보는 커밋하지 않습니다. 공개 라이선스는 팀 합의 전 부여하지 않습니다.
