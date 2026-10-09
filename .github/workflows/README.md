# GitHub 자동 검사

GitHub Actions 설정을 보관합니다. 현재 워크플로는 [ci.yml](ci.yml) 하나입니다.

> 이 안내는 `.github/README.md`에 두지 않습니다. GitHub는 그 파일을 루트 README보다 먼저 저장소 첫 화면에 보여 주기 때문입니다.

- 프런트 작업: 의존성 설치, 타입 검사, 테스트, 빌드, 의존성 감사.
- 백엔드 작업: 프런트 빌드, pytest, 시연 API 점검.

워크플로에서 쓰는 파일 경로나 명령을 바꾸면 저장소 루트의 `package.json`과 `backend/` 설정도 함께 확인하세요. 작업 브랜치와 PR의 검사 결과를 보고 병합합니다.
