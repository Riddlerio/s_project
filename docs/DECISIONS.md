# 결정 기록 (확정 전 포함)

작업 중에 정한 것을 한곳에 남긴다. **사용자 결정**은 확정이다. **임시 결정**은 작업자가 흐름을 끊지 않으려고 정한 것으로, 사용자 검토 뒤 확정하거나 되돌린다. 동결 경로 변경은 이 기록과 별개로 사전 승인이 필요하다(포괄 승인 없음, 2026-10-04).

이 표는 당시 결정의 이력이다. 현재 구현 상태와 시연 전 작업은 [로드맵](ROADMAP.md)에서 확인한다.

| 날짜 | 구분 | 무엇을 정했나 | 다른 선택지 | 관련 파일·커밋 | 되돌리는 방법 |
|---|---|---|---|---|---|
| 2026-10-04 | 사용자 결정 | Claude와 Codex가 작업을 나눠 병행한다. Codex는 치료사 데이터 화면·legacy 진행 그래프, Claude는 3D(Meshy)·seed 재작성·legacy 모험 제거·문서 정리 | Codex를 멈추고 Claude 단독 진행 | [작업 지시(원문)](https://github.com/Riddlerio/s_project/blob/22eef9b993475537ec55859e1cca17dc15d02e73/docs/handoff/CODEX_THERAPIST_DATA_TASK.md) | 분담표 수정 |
| 2026-10-04 | 사용자 결정 | 한 작업 폴더에는 한 작업자만 둔다 | 같은 폴더 공유 | 같은 문서 "작업 폴더 규칙" | — |
| 2026-10-04 | 사용자 결정 | Meshy Pro로 업그레이드(사용자 결제). 두두 최종 모델은 Pro의 비공개(Private) 생성으로 만든다. 대학 사용 허락은 확인됨 | 무료 미리보기만, 코드 모델 유지 | `assets/dudu3d/README.md` | 구독 해지는 사용자가 한다 |
| 2026-10-04 | 기록 | 무료 체험: 일반 호랑이 텍스트로 만든 형태(이전 생성)에 텍스처를 1회(10크레딧) 입혔다. 두두 원본은 올리지 않았다. 결과는 CC BY 공개 조건이며 앱에 쓰지 않는다 | — | Meshy 계정 기록 | — |
| 2026-10-04 | 사용자 결정 | 대표 게임은 빛의 마법, 전부 3D. 포스터는 언어치료가 주인공 | 몬스터 모험·하늘 오르기 | `src/game/magicBeam/`, `docs/clinical/CLINICAL_RATIONALE_AND_POSTER_2026-10-04.md` | — |
| 2026-10-04 | 사용자 결정 | 매직빔 철회는 다음 라운드부터 적용 | 즉시 적용 | 커밋 `aabe22e` | 서비스 함수 되돌림 |
| 2026-10-04 | 임시 결정 | 라운드 도중 매직빔 승인은 즉시 쓸 수 있고, 아이가 본 선택지는 라운드 끝까지 유지 | 승인도 다음 라운드부터 | 커밋 `aabe22e`, `adventure/service.py` | `check_attack`의 래치 제거 |
| 2026-10-04 | 임시 결정 | 아동 화면 문구: 매직빔 카드 "선생님이 열어 준 힘"·"선생님과 함께 열어요", 거부 시 "이번엔 기본 공격으로 해보자!" | "치료사 승인" 표기 | `src/child/AttackChoice.tsx`, `ActivitySession.tsx` | 문구 교체 |
| 2026-10-04 | 임시 결정 | 흉장은 캔버스 근사 재현으로 표시(공식 파일 아님) | 공식 엠블럼 파일 사용 | `src/tiger/duduEmblem.ts` | 공식 파일 확보 시 교체 |
| 2026-10-04 | 사용자 결정 | GLB 로더 도입 승인(three 내장 GLTFLoader, 압축 디코더 없이) | 보류 | `src/tiger/DuduCharacter.tsx`, 동결 계약 §4 | `Hoya3D`에서 `DuduModel`로 되돌림 |
| 2026-10-04 | 사용자 결정 | 텍스처는 한 번 더 비교한 뒤 선택 | 정면만·멀티뷰 중 바로 선택 | Meshy 계정 | — |
| 2026-10-04 | 임시 결정 | 텍스처 B(정면 이미지만)를 채택. 망토 색·뒷머리 줄무늬는 나중에 Blender로 고침 | A(멀티뷰), C(정면+후면) | `assets/dudu3d/README.md` | 다른 후보로 다시 리깅·내보내기 |
| 2026-10-04 | 임시 결정 | 대기 동작을 `Idle_14` 대신 `Happy_Sway_Standing`, 말하기는 `Talk_with_Left_Hand_on_Hip`(원화의 허리 손 자세) | Meshy의 다른 프리셋 | `src/tiger/duduClips.ts` | 대응표 수정 |
| 2026-10-04 | 임시 결정 | 웹용 GLB는 `KHR_mesh_quantization`·`EXT_texture_webp`(three가 디코더 없이 읽음)로 13.5MB→2.62MB | 원본 그대로 13.5MB, meshopt 압축(디코더 필요) | `assets/dudu3d/tools/build_dudu.mjs` | 원본 GLB로 교체 |
| 2026-10-04 | 사용자 결정 | Blender를 설치해 망토 색과 뒷머리 줄무늬를 먼저 고친다 | seed 재작성·legacy 제거 먼저 | `assets/dudu3d/tools/repaint_texture.py` | — |
| 2026-10-04 | 임시 결정 | 망토·뒷머리 보정은 텍스처만 다시 칠한다(형태·뼈대·동작 유지). 스카프는 앞쪽이 흉장과 겹쳐 이번에 바꾸지 않음 | Blender로 다시 내보내기, Meshy 재텍스처 | `assets/dudu3d/tools/repaint_texture.py` | 원본 텍스처로 다시 변환 |
| 2026-10-04 | 임시 결정 | legacy 모험을 지우면서 사용처가 그것뿐이던 `magicBeam/machine.ts`·`BeamCanvas.tsx`도 함께 지웠다. 빛의 마법 3D 장면·`sceneState`·검토 화면은 그대로 | `src/game/magicBeam` 전체 유지 | 로드맵 5절 3번, 동결 계약 §4 | 커밋 되돌림 |
| 2026-10-04 | 임시 결정 | 샘플 회기는 실제 5라운드 처리 함수를 서버 안에서 호출해 만든다(HTTP·쿠키 없이). 일부 회기는 첫 시도를 일부러 짧은 발성으로 넣어 다시 시도 흐름을 보여 준다 | 결과 행을 직접 써 넣기 | `backend/app/seed.py` | seed 파일 되돌림 |
| 2026-10-05 | 사용자 결정 | 5일 데모 흐름: 로그인 → 두두 점프 인사 → /ㅅ/ 유도 대화(약 10번·약 5분) → '대구대 건너기' → "역시 ○○야" → 마무리 인사 → 치료사 화면. 아이템·보상 없음. 목표 소리 /ㅅ/. 놓침은 글자 없이 웃긴 반응 | 기존 모험·지도 중심 흐름 | [흐름 설계안(원문)](https://github.com/Riddlerio/s_project/blob/22eef9b993475537ec55859e1cca17dc15d02e73/docs/handoff/DEMO_FLOW_PLAN_2026-10-05.md) | 흐름 설계안 수정 |
| 2026-10-05 | 사용자 결정 | 대구대 건너기는 성공할 때마다 한 줄씩 건너고 총 10줄(5라운드 × 2줄). 박자에 맞으면 '펑' 효과 | 20줄(5×4), 5번에 한 줄 | 커밋 `b8b99b6`, `backend/app/games/crossing.py` | 줄 수·라운드 표 수정 |
| 2026-10-05 | 임시 결정 | 건너기 판정: 시작 마찰 70ms·뒤 유성 80ms 이상이면 성공, 잡음보다 15dB 미만이면 불확실. 사용자 실측 2회(정답 확인 포함)에서 바른 '사' 79~99ms, '차·자' 39~59ms. 마찰 60ms인 바른 '사' 2개는 놓침(정확성 우선) | 60ms(바른 소리를 더 받지만 차·자와 겹침) | `docs/handoff/MIC_MEASUREMENT_2026-10-05.md`, `games/evaluation.py`, `crossingFlow.ts` | 두 곳의 기준값을 함께 바꿈 |
| 2026-10-05 | 사용자 결정 | 두두 목소리는 VOLI 무료 플랜의 활기찬 소년 목소리. 베이직 보이스 '하람'을 골랐다(오픈 보이스는 저작권 미보증이라 쓰지 않음). 비상업적 사용·출처 표기 | Edge 남성 음성(InJoon), 유료 플랜 | `docs/handoff/DUDU_VOICE_VOLI_2026-10-05.md`, 커밋 `b3127a7`·`dc9709c` | `KoreanTts`의 `clips: null`(브라우저 음성만) |
| 2026-10-05 | 임시 결정 | 음성 파일로 말하려고 마무리 대사의 횟수를 "정말 많이"로 고정하고, 다시 단서 문장 두 개를 다듬었다 | 숫자를 말함(브라우저 음성) | `src/child/DuduGoodbye.tsx`, `crossingFlow.ts` | 문장 되돌림 + 새 음성 파일 |
| 2026-10-05 | 사용자 결정 | Codex가 토큰을 다 써서 Claude가 서버·치료사 작업을 이어받는다. Codex 작업 폴더는 읽기만 하고 고치지 않는다 | Codex 재개 대기 | 커밋 `276865c`, `795af09` | — |
| 2026-10-05 | 임시 결정 | 리허설 초기화에 `--include-mic`를 더해 시연 전용 seed 아동의 오늘 마이크 회기도 지울 수 있게 했다. 기본값(DEMO 모드만)은 Codex 설계대로 유지 | 기본값을 바꿈 | `backend/scripts/demo_rehearsal.py`, `app/demo_seed.py` | 옵션 제거 |
| 2026-10-05 | 임시 결정 | 시연 흐름으로 들어온 대화에서는 집(지도·아이템)으로 나가는 버튼을 숨기고, 대화를 끝내면 아래 '대구대 건너기'를 연다. 원래 앱 흐름은 그대로 | 집으로 보냄 | `src/child/HoyaChat.tsx` | `autostart` 분기 제거 |
| 2026-10-05 | 사용자 결정 | 리허설(실제 마이크·아이폰 확인, 마이크 3차 측정, 최종 PR)은 사용자가 "리허설 할게"라고 할 때까지 보류 | — | — | — |
| 2026-10-05 | 사용자 결정 | 리허설과 관계없는 남은 일로 'AI' 표현·판정 안내 점검(Phase 2), 최소 CI(Phase 6 일부), Phase 1 과거 기록 수리 도구를 진행한다. 대구대 정문 3D(Meshy)는 하지 않음 | Meshy 정문 | 커밋 `ebb8ed6`, `b8e8418`, `.github/workflows/ci.yml` | — |
| 2026-10-05 | 임시 결정 | CI 백엔드는 지금까지 검증한 Windows에서 돌린다(운영 대상 OS는 미정). 배포·브랜치 보호는 넣지 않는다 | Ubuntu, 두 OS 모두 | `.github/workflows/ci.yml` | `runs-on` 변경 |
| 2026-10-05 | 사용자 결정 | 원래 Orca 폴더의 옛 DB 2개(9/28, seed 아동 회기 4개씩 잘못 표시, 임상 관찰 오염 0)는 지금 고치지 않는다. 필요해지면 수리 도구로 고친다 | 바로 `--apply` | `backend/scripts/repair_seed_provenance.py` | `--apply`(백업 자동) |
| 2026-10-05 | 사용자 결정 | 리허설 전에 `claude/dudu-followup`을 'CI 통과, 실제 마이크 미확인'으로 표시해 main에 먼저 병합한다(동결 계약 6절 "실제 마이크·시각 품질은 수동 검증 후 사용자 승인"의 예외). 리허설에서 나온 수정은 다음 PR로 올린다. Phase를 마칠 때마다 다음 Phase 승인을 요청한다 | 리허설 뒤 병합 | PR(이 결정으로 연 main 병합 PR) | main에서 병합 커밋 되돌림(revert) |
| 2026-10-05 | 사용자 결정 | 대구대 정문은 사용자가 준 정문 사진 두 장을 참고해 만든다(코드 3D, Meshy 미사용). 건너기에 횡단보도·글자 카드·'정말 잘했어' 말풍선 효과를 넣는다. 이후 변경도 'CI 통과, 실제 기기 미확인'으로 PR을 열어 main에 병합한다 | Meshy 생성, 리허설 뒤 병합 | `src/game/crossing/DaeguGate.tsx`, `CrossingScene.tsx`, `DaeguCrossing.tsx` | 이전 정문 아치로 되돌림 |
| 2026-10-05 | 사용자 결정 | Phase 3(시각 방향·에셋) 승인, Figma 제외. 범위: 디자인 토큰(한 파일, CSS의 직접 색을 토큰으로, 화면 모양 유지·전후 캡처 비교), 에셋·라이선스 표, 두두 3D 휴대폰 성능 점검. 대학 서면 허락 문서는 사용자 몫 | Figma 포함, 다른 Phase 먼저, 보류 | `shared/design-tokens.json`, `docs/ASSET_LICENSES.md` | — |
| 2026-10-05 | 사용자 결정 | Phase 4(아동 화면) 승인: ① '네 차례' 신호 통일(두두 귀 쫑긋·마이크 열리기 전 짧은 차임·화면 가장자리 빛·'네 차례!'), ② 접근성·저사양 점검. 집·지도·보상 재디자인은 리허설 뒤로 미룬다. 마이크 경로는 건드리지 않고, 차임은 마이크가 열리기 전에만 낸다 | Phase 4 전체, 다른 Phase, 보류 | Phase 4 PR | — |
| 2026-10-05 | Claude 결정(Phase 4 구현) | '네 차례' 순서: 두두 귀 쫑긋 + 차임 → 차임이 다 들린 뒤(기본 0.45초, 기기 출력 지연만큼 더, 최대 1초) 듣기를 열고 가장자리 빛·'네 차례!' 배지를 켠다. 빛과 차임을 함께 켜면 아이가 빛을 보고 바로 말을 시작해 첫소리(/ㅅ/ 마찰)가 마이크가 열리기 전에 잘릴 수 있어서다. 같은 항목을 다시 들을 때도 같은 신호를 내고, DEMO 누르고 말하기도 '네 차례!' 뒤에만 받는다 | 빛·차임 동시, 차임 없이 빛만 | `src/child/turnCue.tsx`, `src/child/demoFx.tsx`, `src/child/hoyaChatController.ts`(`beforeListen`), `DaeguCrossing.tsx`, `ActivitySession.tsx` | `TurnCue`·`playTurnChime`을 빼고 `beforeListen`을 넘기지 않으면 전과 같다 |
| 2026-10-05 | Claude 결정(Phase 4 구현) | 게임 4종의 반응 시간(`onsetLatencyMs`) 기준점을 듣기가 열린 때('네 차례!')로 바꿨다. 차임 대기(0.45초)나 주변 소리 보정(1초)이 반응 시간에 섞이지 않게 하려는 것이다. 이 값은 치료사 화면 '저장된 측정 요약'에만 보이고 판정·지표에 쓰지 않는다. 대화·건너기는 그대로다 | 기존 기준점(따라 말하기는 두두 시범 끝, 그 밖은 항목 표시) | `src/child/ActivitySession.tsx` | 차례 효과의 `open()`에서 `promptShownAt` 갱신을 지운다 |
| 2026-10-05 | Claude 결정(Phase 4 점검) | 움직임 줄이기에서 공통 3D 두두(`Hoya3D`)도 동작마다 한 자세로 멈춘다(건너기·빛의 마법과 같은 규칙). 앱에 배경음이 없어 '듣는 동안 배경음 낮춤'은 해당 없다 | 대화·집·다른 게임에서는 계속 움직이게 둠 | `src/tiger/Hoya3D.tsx`, `src/shared/useReducedMotion.ts` | `animate={!reduced}`를 뺀다 |
| 2026-10-05 | 사용자 결정 | '대구대 건너기'를 진짜 리듬게임으로 바꾼다. 다른 게임 4종은 만들지 않고 데모 하나에 집중한다 | 게임 여러 개 | `src/game/crossing/rhythm.ts` | — |
| 2026-10-05 | Claude 결정(리듬 구현) | '딱 맞았어!' 범위는 카드 착지 앞 0.3초~뒤 0.4초다. 화면에만 보이고 저장하지 않는다(`onsetLatencyMs`도 0) | 저장해 지표로 쓰기 | `rhythm.ts`의 `timingKind` | 값 수정 |
| 2026-10-05 | Claude 결정(리듬 구현) | 빠르기가 바뀌면 최근 결과 기록을 비운다(빨라짐·느려짐이 연달아 일어나지 않게) | 기록 유지 | `rhythm.ts`의 `nextBpm` | — |
| 2026-10-05 | Claude 결정(리듬 구현) | 박 소리('똑')는 아이 박(4박) 전에만 내고, 듣는 동안에는 내지 않는다 | 계속 박 소리 | `src/child/DaeguCrossing.tsx` | — |
| 2026-10-05 | 사용자 결정 | Codex 세션이 꺼져 Claude가 Codex의 미커밋 작업(아동별 박자 설정, 근거 문구)을 그대로 옮겨 넣는다. 이후 당시 [번호 작업 지시](https://github.com/Riddlerio/s_project/blob/575f8b27deac6dd1c1d72d9a75f793360ccd61a1/docs/CODEX_TASKS.md)로 지시한다 | Codex 복귀 대기 | PR #17, 완료 기록은 [작업 기록](WORK_HISTORY.md) | — |
| 2026-10-05 | 사용자 결정 | 끝난 작업 문서 29개는 `docs/WORK_HISTORY.md` 하나로 합치고 지운다. 포스터 검토본은 `docs/poster/`, 두두 참고 그림은 `assets/dudu3d/references/`로 옮긴다 | 그대로 두기 | PR #17 | 정리 직전 버전(`22eef9b`)에서 되살리기 |
| 2026-10-05 | 확인 필요 | 이름 'Speech Hero' 중복: 미국 Flint Rehabilitation의 실어증 앱 이름도 **Speech Hero**다(메트로놈 타이밍 판정, [NCT04471935](https://clinicaltrials.gov/study/NCT04471935)). 포스터·공개 전에 확인이 필요하다. | 이름 바꾸기 | — | — |
| 2026-10-06 | 사용자 결정 | 건너기 판정을 아주 살짝 너그럽게: 시작 바람 소리 70→60ms(3프레임), 시작 앞부분 봐주기 40→60ms. 뒤 모음 80ms·잡음 대비 15dB는 그대로 | 그대로 두기 | `games/evaluation.py`, `crossingFlow.ts`, `onsetPipeline.ts`, `MIC_MEASUREMENT` 6절 | 값을 70/40으로 되돌림 |
| 2026-10-06 | 사용자 결정 | 틀렸을 때 조언을 조금 더 자세히: 이유에 맞춘 입 모양 그림·짧은 안내를 제목 자리에 보이고, '바람 소리 먼저' 단서에도 낱말 시범을 붙인다. 두두 목소리는 기존 녹음만 쓴다(VOLI 남은 101자 보존) | 새 녹음 문장 | `src/game/crossing/retryTips.ts`, `src/child/RetryTip.tsx` | 도움말 카드 끄기 |
| 2026-10-10 | 사용자 결정 | AI가 답을 만드는 두두 대화는 인사·대체 문장까지 브라우저 음성 하나로 말한다(대화 중 목소리가 바뀌지 않게). 게임·마무리는 VOLI 음성을 그대로 쓴다 | 대화도 VOLI 음성 우선(인사와 AI 답의 목소리가 다름) | `src/child/HoyaChat.tsx`, `src/speech/koreanTts.ts`, `backend/app/hoya/service.py`(`generatedReplies`) | `recorded` 옵션을 빼면 이전 동작 |
| 2026-10-10 | 사용자 결정 | AI가 답을 만드는 대화를 시작한 탭에서는 이어지는 리듬게임·새 낱말 확인·마무리 인사도 VOLI 파일 대신 같은 브라우저 음성으로 말한다(두두 목소리 하나). 게임에서 두두가 박에 맞춰 부를 때는 브라우저 음성으로 말하라고 한 뒤 말소리가 들리기까지 걸린 시간(온라인 음성은 앞 무음 약 0.34초 포함, 최근 5번 중앙값)을 재서 그만큼 먼저 말한다. 위 줄의 `recorded` 옵션은 이 설정으로 바꿨다 | 게임·마무리는 VOLI 음성 유지(낱말 시범 발음이 정확하지만 대화와 목소리가 다름) | `src/speech/duduClips.ts`(`setDuduClipsAllowed`), `src/speech/koreanTts.ts`, `src/child/DaeguCrossing.tsx` | `HoyaChat.tsx`에서 `setDuduClipsAllowed`를 늘 true로 부르면 이전 동작 |

새 항목은 아래에 이어 적는다. 기존 게임의 판정 기준값과 임상 파라미터는 바꾸지 않았다(새 게임 '대구대 건너기'의 기준값은 2026-10-05 실측으로 정했고 위에 기록했다). 임상 효과 주장은 쓰지 않는다.
