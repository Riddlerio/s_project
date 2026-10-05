# Codex 치료사 데이터 화면 · 통합 결과

작성일: 2026-10-04. [승인된 작업 지시](CODEX_THERAPIST_DATA_TASK.md)의 읽기 화면과 legacy 진행 그래프 대체를 완료했다. 승인한 계획이 아동 게임을 실행하는 TherapyRun은 이번 범위에 포함하지 않았다.

## 작업 위치와 통합

- 작업 폴더: `C:\Users\kor02\orca\workspaces\s_project\codex_therapist_data`
- 브랜치: `codex/therapist-data-view`. 원래 Orca 폴더와 `dudu_claude` 작업 폴더의 파일은 수정하지 않았다.
- 기존 구현 `2268832`에 Claude의 V2 seed·legacy 모험 제거 `787f031`을 통합했다(`ba82ef1`). `test_api_flow.py`의 충돌은 V2 회기 완료와 목표별 추이·옛 API 제거 검사를 모두 유지해 해결했다.
- 통합 타입 검사에서 남은 `SessionMode` 미사용 import를 발견해 제거했다(`abfb4b8`).
- 검사 중 도착한 두두 스카프·꼬리·표정 보정 `7967d85`도 통합했다(`a9c437f`). 이후 프런트 전체 검사·타입 검사·빌드를 다시 실행했다. 백엔드와 의존성은 이 추가 통합에서 바뀌지 않았다.
- 마지막 fetch에서 도착한 공식 흉장 교체 `3c5c88e`도 통합하고 빌드를 다시 통과했다. GLB 텍스처·제작 스크립트·자료만 바뀌며 앱 실행 코드와 테스트·백엔드는 동일하다. 치료사 화면 검수는 이 자산 교체 직전의 동일한 화면 코드에서 수행했다.
- PR의 기준은 `claude/dudu-followup`이다. 치료사 변경만 별도로 검토할 수 있게 하며, 기능 브랜치 통합과 최종 `main` 병합은 검토 후 진행한다.

## 구현한 것

1. **회기 타임라인:** 5라운드 띠에서 관찰마다 버튼 하나를 표시한다. 출처 모양과 키보드 선택, 목표·측정값·단서·AI 원 결과·치료사 결과·검토 메모를 제공한다. 기존 확인·교정·거부 API를 사용한다.
2. **목표별 추이:** 음소·위치·정규화 수준·활동을 분리한다. 첫 평가 가능 회기와 이후 최근 최대 5회기를 비교하며 기준선을 중복 집계하지 않는다. 최근 성공률은 성공 수/평가 가능 수로 계산한다. SVG 아래 표에도 같은 값과 단서 유형별 건수가 나온다.
3. **자료 품질:** 실제·DEMO·샘플을 분리한다. 실제·비샘플이며 최신 치료사 결정이 확인·교정인 관찰만 비교 후보로 삼는다. 불확실·무발화·목표 관찰·POOR 및 잡음·클리핑 등 품질 경고는 분모에서 제외한다. 자료 없음은 0%가 아닌 null이다.
4. **결정 지원:** 다음 회기·활동 제안에서 입력·적용 규칙·한계를 펼쳐 볼 수 있다. 반영은 기존 치료사 선택 절차를 따른다.
5. **legacy 그래프 대체:** `/api/children/{id}/progress`, `SessionTrendChart`, `Progress`·`SessionPoint`, `recharts`와 전용 전이 의존성을 제거했다. 새 의존성은 없다.
6. **세션 노트:** 서버 집계로 만든 한국어 문장을 복사할 수 있다. LLM·원음 저장·재생을 추가하지 않았다.

## API와 변경 경계

새 모듈 `backend/app/therapist_insights/`에서 다음 GET을 제공한다.

- `/api/children/{child_id}/goal-trends`
- `/api/sessions/{session_id}/insights`

두 경로 모두 `require_therapist`와 `owned_child`를 거친다. 학생은 403, 비담당 치료사는 404, 비로그인 사용자는 401로 차단하는 회귀 검사를 포함한다.

치료사 변경의 `main.py` 수정은 새 router 등록과 `/progress` 제거다. 인증·DB 모델·검증 상태·append-only 기록·회기 계획 계약을 변경하지 않았다. 기존 근거 필터와 음질 판정기는 읽어서 재사용한다. Claude의 게임·seed·3D 변경은 해당 커밋을 병합한 것이다.

주요 화면은 `ClinicalTimeline.tsx`, `charts/GoalTrendChart.tsx`, `SessionNote.tsx`, `workspace/ProgressPanel.tsx`다. 새 계산과 권한은 `backend/tests/test_therapist_insights.py`, 화면의 출처·빈 자료·노트는 `src/therapist/insights.test.tsx`에서 검사한다.

## 통합 검사

환경: Windows, Node 22.23.2, Python 3.12.10, 전용 worktree의 `node_modules`와 `backend/.venv`. 기존 사용자 데이터와 분리된 임시 DB를 사용했다.

| 검사 | 결과 |
|---|---|
| `backend\.venv\Scripts\python.exe -m pytest backend -q --basetemp backend/test-temp/continuation-20261004 -p no:cacheprovider` | 324개 통과, 368.08초. 기존 httpx2 DeprecationWarning 1개 |
| `npm.cmd test` | 최종 25개 파일·172개 통과 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd run build` | 통과, dist 자격 증명 검사 통과 |
| `npm.cmd audit` | 취약점 0개 |
| `backend\.venv\Scripts\python.exe backend/scripts/smoke_api.py http://127.0.0.1:8017` | 쿠키·CSRF·역할·5라운드·관찰·계획 제안/승인/불변·DEMO 대화/재시도 통과 |
| 최종 dist를 제공한 헤드리스 Edge | 5라운드·키보드 선택·교정 API·노트 갱신·복사 피드백 통과. 390px 화면 가로 넘침 없음. 페이지 오류 0 |
| `git diff --check` | 통과 |

최초 통합 타입 검사는 미사용 import로 실패했다. 해당 한 줄을 수정한 뒤 다시 통과했다. Vite의 향후 native 설정 호환성 안내와 500kB 초과 청크 경고는 남아 있다. 과거 348개/168개 등 병합 전 검사는 현재 통합 결과와 구분한다.

검수 서버는 포트 8017, `backend/test-temp/continuation-smoke-20261004/demo.db`, `SEED_DEMO_DATA=true`, `COOKIE_SECURE=false`, 외부 LLM·추적 비활성으로 실행했다. 기본 8000 서버와 기존 DB에는 쓰지 않았다. 화면 검수 중 교정 동작은 이 임시 샘플 DB에만 적용했다.

## 화면 자료

[자동 검사 결과](therapist-data-review-2026-10-04/browser-review.json)와 다음 화면을 최종 빌드에서 다시 캡처했다.

- [데스크톱 타임라인](therapist-data-review-2026-10-04/01-timeline-desktop.png), [390px 타임라인](therapist-data-review-2026-10-04/02-timeline-mobile.png), [샘플 제외](therapist-data-review-2026-10-04/03-sample-excluded.png): 독립 샘플 DB.
- [목표별 추이](therapist-data-review-2026-10-04/04-synthetic-goal-trend.png), [390px 추이](therapist-data-review-2026-10-04/05-synthetic-goal-trend-mobile.png): 브라우저에서만 주입한 합성 응답. 화면에도 표시했으며 실제 아동 데이터나 임상 성능 근거가 아니다.

## 남은 한계와 다음 작업

- 새 읽기 화면은 잡음·클리핑 등도 보수적으로 제외하므로 기존 회기 계획 집계와 수치가 다를 수 있다. 잡음 기준 미측정 경고만으로는 제외하지 않는다.
- 기존 회기 제안은 목표 음소·위치별로 나누지 않는다. 기존 활동 제안은 POOR를 별도 필터링하지 않고 후보 최대 10건 중 근거 링크 최대 5건만 저장한다. 이 차이를 화면에 명시했고 기존 알고리즘은 변경하지 않았다.
- 단서 유형을 임의의 서열 점수로 환산하지 않는다. 조건이나 표본 수가 다른 회기의 변화는 치료 효과로 단정할 수 없다.
- 치료사 표현·기준선·단서 비교·노트의 사람 검토, 실제 마이크·휴대폰 성능·아동 음성·임상 효과 검수는 남아 있다.
- TherapyRun 계획 실행, 원음 청취/보존, 새 운영·배포 단계는 별도 범위다. 이번 결과로 Phase 7 전체나 Production Ready를 완료 표시하지 않는다.
