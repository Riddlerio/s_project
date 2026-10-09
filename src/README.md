# 프런트엔드 소스

React 화면과 브라우저에서 실행되는 기능을 모아 둡니다. 진입점은 `main.tsx`, 화면 경로는 `App.tsx`에 있습니다.

- `child/`, `therapist/`: 아동용 활동 화면과 치료사용 화면.
- `game/`, `speech/`, `control/`, `tiger/`: 게임 규칙, 음성 처리, 동작 제어, 두두 3D 표현.
- `api/`, `shared/`, `styles/`: 서버 호출, 프런트 공통 코드, 화면 스타일.
- `dev/`, `build/`: 로컬 검토 화면과 빌드 설정.

다른 위치의 `shared/`는 JSON 계약과 검사 자료를 담는 별도 폴더입니다. 파일을 옮길 때 상대 import와 개발용 HTML의 진입 경로를 함께 확인하세요. Windows PowerShell에서는 저장소 루트에서 `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`로 확인합니다.
