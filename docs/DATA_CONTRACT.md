# 데이터 계약

| 자료 | 항목 | 규칙 |
|---|---|---|
| metadata | sourceType, source, units | synthetic/observed와 기준일 명시 |
| stops | id, name, x, y | 고유 ID, x/y는 SVG 좌표이며 위경도 아님 |
| edges | id, from, to, lengthM | 참조 유효·양수·방향 보존 |
| operating | speedMps, dwellSec, headwaySec | 단위·유한값·양수 |
| events | busId, trip, stopId, arrival, start, end | 초 단위, arrival ≤ start ≤ end |

실측은 busRouteId, stId, arsId, 순번, 방향, 좌표계와 수집시각을 보존합니다.
arsId와 내부 ID를 혼용하지 않고 순환 노선의 반복 정류장은 순번까지 구분합니다.
정류장 좌표는 도로 형상이 아닙니다. 중간 경로·회전 제한·일방통행을 확인합니다.
원본은 data/raw에 로컬 보관하며 익명 집계만 근거와 함께 PR로 추가합니다.
