# Speech Hero 검증 기록

## Hook 상태

사용자가 별도 최상위 Codex 세션에서 `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop` 모두 Completed, `Hook failed` 0회를 확인했다. 이 작업에서는 Hook 설정과 Orca source를 변경하지 않았다. 이전 Hook 수정 원인과 백업 경로는 이 세션에서 재확인하지 않았으므로 기록하지 않는다.

## 실행 결과

| 명령 또는 확인 | 종료 코드 | 결과 |
| --- | ---: | --- |
| `npm.cmd install` | 0 | 의존성 최신 상태 |
| `npm.cmd run typecheck` | 0 | TypeScript 통과 |
| `npm.cmd run build` | 0 | Vite 생산 빌드 통과; 번들 크기 경고 |
| `npm.cmd test` | 0 | Vitest 5개 통과 |
| `backend\\.venv\\Scripts\\python.exe -m pip install -r backend\\requirements.txt` | 0 | 런타임 및 테스트 의존성 설치 |
| `backend\\.venv\\Scripts\\python.exe -m pytest backend -q` | 0 | 13개 통과; Starlette deprecation 경고 1건 |
| `backend\\.venv\\Scripts\\python.exe backend\\scripts\\smoke_api.py` | 0 | 로그인, 게임 세션, 발화, 완료, 상세, 피드백, 추천, 비인증 401 통과 |
| `GET http://127.0.0.1:5173/` | 200 | Vite 페이지 응답 |
| `GET http://127.0.0.1:5173/therapist/children/demo-refresh` | 200 | 새로고침 경로 응답 |
| `GET http://127.0.0.1:5173/api/system/info` | 200 | 프록시를 통한 FastAPI 응답 |
| `git diff --check` | 0 | 공백 오류 없음 |

프런트엔드 테스트는 몬스터 타워 상태 전이, 재시도·힌트·보상, 마법 빔 발성 흐름, DEMO 인식기와 VAD를 검증했다. 백엔드 테스트는 임시 SQLite DB에서 발화 분석·대시보드·치료사 피드백·추천 수락/수정/거절의 저장과 목표 버전을 검증했다.

## 보안과 범위

`npm.cmd audit --json`은 종료 코드 1이며 취약점 7건(치명적 1, 높음 1, 보통 5)을 보고했다. 제시된 주요 수정은 Vite, Vitest, React Router의 메이저 버전 전환을 요구하므로 안정성 검토 없이 강제 적용하지 않았다. 원본 음성은 서버에 저장하지 않는다. 실제 음성 모드는 Web Speech API 기반의 ASR 근사 분석이며 임상 진단이 아니다. DEMO 모드는 인식 문장만 스크립트로 대체한다. 실제 브라우저 마이크·오디오 품질의 수동 검증과 배포 환경의 보안 검증은 수행하지 못했다.

이 기록은 이 세션에서 직접 실행한 명령을 기준으로 한다. Hook PASS는 사용자가 전달한 별도 세션 검증 결과다.
