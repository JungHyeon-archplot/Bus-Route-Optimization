# GitHub 협업 설정 기록

설정일: 2026-09-28.

## 적용

- 문서·이슈 템플릿·PR 템플릿을 main에 생성.
- CODEOWNERS: @wkddudghks. write 권한 초대 발송; 수락 후 담당자 리뷰 기능이 활성화됨.
- Issues 사용, Squash merge만 허용, 병합 후 브랜치 자동 삭제.
- 구현 PR에 CI 추가: `simulation-tests`, Node.js 22, 외부 API 키 없이 테스트.
- 이슈 #1~#14에 결함·구현·실측 후속 작업 등록.

## 적용되지 않은 강제 규칙

main 보호 API가 HTTP 403 및 “Upgrade to GitHub Pro or make this repository public”를 반환했습니다.
현재 요금제의 비공개 저장소에서는 브랜치 보호를 사용할 수 없습니다.
저장소 공개 전환 또는 유료 결제는 수행하지 않았습니다.

따라서 현재 CODEOWNERS·리뷰·CI는 자동 요청/검사와 팀 운영 절차이며 **병합을 강제로 차단하는 규칙은 아닙니다.**
관리자·팀원은 수동으로 리뷰 1명 및 CI 성공을 확인하고 병합해야 합니다.

계정에서 보호 기능이 가능해지면 다음을 적용합니다:
- PR 승인 1명, CODEOWNERS 승인, 새 커밋 시 이전 승인 취소
- simulation-tests 필수, main 최신 상태 요구
- 대화 해결, 선형 이력, 관리자 포함, 강제 푸시·브랜치 삭제 금지

## 후속

팀원이 초대를 수락해야 공동 개발·리뷰가 가능합니다.
초대 대기 중에는 reviewer 요청이 실패할 수 있으며 CODEOWNERS 파일만으로 접근 권한이 생기지 않습니다.

