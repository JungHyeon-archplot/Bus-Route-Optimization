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
