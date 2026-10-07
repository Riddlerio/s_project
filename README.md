# Speech Hero

Speech Hero는 만 4~7세 아동이 음성으로 두두와 대화하고 게임을 진행하며, 치료사가 관찰 근거를 검토해 목표를 조정하는 웹 앱입니다. 아동에게 임상 점수를 보여주지 않고, 치료사 화면에서 발화·결정·추천의 근거를 확인합니다.

**2026-10-05 5일 데모(10/5~10/9) 진행 중:** 로그인 → 두두 인사·/ㅅ/ 유도 대화 → 리듬게임 '대구대 건너기' → 칭찬·마무리 → 치료사 기록 확인 흐름입니다. 지금까지 한 일과 중요한 결정은 [작업 기록](docs/WORK_HISTORY.md), 다른 기기에서 이어 하는 방법과 앞으로 할 일은 [앞으로 할 일](docs/NEXT_STEPS.md), Codex에게 번호로 시키는 일은 [작업 순서](docs/CODEX_TASKS.md), 시연 순서·계정·초기화·리허설 확인 목록은 [시연 진행표](docs/handoff/DEMO_RUNSHEET_2026-10-05.md)에 있습니다. 두두는 Meshy GLB를 로드하며, 모델 로딩이 실패하면 절차형 시제품으로 돌아갑니다. 3D 제작·보정 과정은 [3D 제작 자료](assets/dudu3d/README.md), 남은 Phase와 역할 분담은 [로드맵](docs/ROADMAP.md)을 확인합니다. 이전 검사 수치는 당시 기록이며 현재 브랜치의 최종 결과와 구분합니다.

**2026-10-06:** 자연스러운 대화 대본·새 두두 음성(PR #23), 치료사 건너기 분석 화면(PR #24·#25), 치료사 화면 시각·빈 대화·시연 동선 수정(PR #22·#26)을 병합했습니다. 휴대폰 폭(390px)으로 전체 흐름을 자동 점검했고(가짜 마이크, PR #27), 실제 아이폰 리허설이 남았습니다.

## 현재 상태

| 항목 | 상태 |
|---|---|
| M1 (음성 입력·두두 시제품·Magic Beam 경로) | PARTIAL |
| M2 (네 게임 5라운드·임상 관찰·치료사 검증) | PARTIAL |
| M3 (추천·대화·운영 준비) | PARTIAL |
| 5일 데모(2026-10-05~07 main 병합, PR #11~#31) | CI 통과 · 휴대폰 폭 전체 흐름 자동 점검 통과(2026-10-06, 가짜 마이크) · **실제 마이크·아이폰·실제 LLM 미확인**(리허설 예정) |
| Production Ready | **NO** |

PARTIAL은 기능이 동작하지 않는다는 뜻이 아닙니다. 코드와 자동 테스트로 확인한 범위는 [V2 검증 기록(원문)](https://github.com/Riddlerio/s_project/blob/22eef9b993475537ec55859e1cca17dc15d02e73/docs/v2/VALIDATION_REPORT.md)에 있습니다. 실물 마이크·Android 브라우저·3D 렌더·HTTPS 배포의 수동 확인, 라벨링된 아동 음성으로 하는 발음 정확도·임상 검증이 아직 남았다는 뜻입니다.

핵심 원칙은 **음성이 게임을 움직인다**, **아동에게는 모험으로 보인다**, **치료사의 판단이 다음 훈련에 반영된다**입니다. 캐릭터는 동행자이며 치료사나 의사의 역할을 하지 않습니다.

## 주요 기능

- 5일 데모 흐름(2026-10-05): 로그인하면 두두가 점프하며 인사하고 "오늘 뭐 하고 놀았어?"로 대화를 엽니다. 아이가 말한 주제에서 /ㅅ/ 낱말이 나오기 쉬운 질문을 하고(예: 놀이터 → "시소도 탔어?"), 목표 소리가 두 번 연달아 없을 때만 그림 고르기·빈칸·먼저 들려주기로 돕습니다. 목표 낱말 시도 10회와 2분, 또는 5분이 지나면 두두가 아래 '대구대 건너기'를 권합니다. 게임은 리듬게임입니다. '하나·둘·셋·넷' 뒤 낱말 카드가 4박 한 마디마다 한 장씩 내려오고(1~3박에 '똑', 4박에 착지), 아이는 카드가 내려앉을 때 말합니다. 서버 판정이 성공이면 두두가 횡단보도 흰 줄을 하나 건넙니다(총 10줄, 5라운드 × 2줄). 빠르기는 84BPM에서 시작해 잘하면 조금씩 빨라지고, 치료사가 아동별로 시작 박자(76~100)와 빨라지기를 정합니다. 정문에 도착하면 "역시 ○○야!"라고 칭찬하고 대화로 돌아가 마무리 인사를 합니다. 아이템·보상은 쓰지 않습니다.
- '네 차례' 신호(2026-10-05 Phase 4): 아이가 말할 차례마다 대화·대구대 건너기·게임 4종이 같은 신호를 씁니다. 두두 귀가 쫑긋 서고 짧은 차임이 울린 뒤, 차임이 다 들리면(약 0.5초) 마이크가 듣기 시작하고 화면 가장자리 빛과 '네 차례!'가 켜집니다. 차임이 아이 말로 잡히지 않게 듣기 전에만 울립니다. 움직임 줄이기 설정이면 두두와 효과가 멈춰 보입니다([작업 기록](docs/WORK_HISTORY.md)).
- 두두 목소리: VOLI 베이직 보이스 '하람'(소년)으로 미리 만든 음성 파일 92개를 재생합니다. 파일이 없는 말은 브라우저 음성으로 말합니다. **무료 플랜이라 비상업적 사용만 가능하고, 두두가 말하는 화면에 출처 문구를 표시합니다**([음성 기록](docs/handoff/DUDU_VOICE_VOLI_2026-10-05.md)).
- 아동: 계정 로그인, 두두 시제품 홈, 네 게임의 5라운드, 두두와 대화하기(자유대화), DEMO 또는 실제 음성 입력, XP·뱃지·카드 확인
- 데모 확장: 치료사가 승인·철회하는 매직빔, 다른 기기에서 명시적으로 이어받는 회기, 농사/낚시 장면의 재료와 참치초밥 한 가지 제작, 라운드 참여별. 임상 판단과 제작 보상은 분리합니다.
- 치료사: 로그인, 담당 아동 목록, 아동별 4영역 작업 공간(요약·치료 목표·다음 회기·경과 · 기록), 검증된 근거로 다음 회기 계획 작성·승인, 세션 기록·발화 교정, 기존 자동 추천(규칙 기반)과 규칙(고급 정보)
  - '치료 목표' 탭: 대구대 건너기 설계 근거(왜 /ㅅ/·누구에게·무슨 연습)와 대상별 빠른 설정(시작 박자·빨라지기)
  - '경과 · 기록' 탭: 대구대 건너기 분석(치료사 확인 비율 추이와 숙달선, 단계 × 위치 표, 자동 추정 오류 유형(의심), 시작 박자, 전문 정보, 가정 연습·회기 기록(SOAP) 초안 복사). 새 라이브러리 없이 SVG로 그리고, DEMO·샘플 회기는 비교에서 뺍니다
- 서버: FastAPI·SQLite, 쿠키 세션·역할 접근 제어·CSRF 방어, 발화 분석, 라운드 이벤트와 임상 관찰·치료사 검증 기록

음향·발음 판정은 **기초 근사 분석**이며 임상 진단이나 치료사의 판단을 대체하지 않습니다. 5라운드 난이도 규칙은 제품 운영 규칙입니다. 원본 음성은 앱 서버에 저장하지 않습니다. 실제 음성 모드에서 브라우저의 Web Speech API 제공업체로 음성이 전송될 수 있습니다. DEMO는 스크립트 인식 결과를 사용하며 아동 화면에 명시됩니다. 학습 모델 재훈련은 하지 않습니다. 외부 LLM은 아래 "두두와 대화하기"에서 서버 설정으로 켰을 때만 대화 문장을 만드는 데 쓰입니다. 발음 판정·치료 결정에는 쓰이지 않습니다. 학습형 발음 모델 도입 가능성은 [발음 연구 최종 결정](research/pronunciation/reports/pronunciation_final.md)에서 검토했으며, Speech Hero 목표에 맞는 공개 한국 아동 데이터가 없어 실험하지 않았습니다(DATASET_NOT_SUITABLE). 제품 동작은 바뀌지 않았습니다.

## 구조와 음성 처리

브라우저 `src/child`가 마이크 입력의 음량과 발성 시간을 감지합니다. Magic Beam의 실제 마이크 입력은 고주파 에너지와 스펙트럼 중심으로 마찰음 구간을 찾고 연속 발성 길이를 서버에 보냅니다. 신호 대 잡음비가 낮거나 발화가 너무 짧으면 평가를 보류하고 다시 듣기를 안내합니다. 이 임계값은 기기별 보정과 실제 아동 음성 검증이 필요합니다. 발화 끝 판단 전 기다리는 시간은 기본 700ms입니다. Sky Climb R4(쉬었다가 다시)는 2.5초, Magic Beam R4(리듬 펄스)는 1.2초로 늘려 자연스러운 쉼이 한 발화 안에서 측정되게 합니다. Sky Climb R4는 한 발화 안의 가장 긴 쉼이 300~2200ms일 때만 "쉬었다가 다시"로 인정합니다. 상한은 발화 종료 유예(2.5초)보다 짧아, 그보다 길게 쉬면 브라우저가 발화를 나누고 서버도 한 발화 안의 쉼으로 인정하지 않습니다. 평균 음량·SNR은 발성 frame으로만 계산하고, 잡음 기준은 시작 전 1초 무음에서 구하며, 발화 길이에는 끝의 종료 유예 무음을 넣지 않습니다. 쉼이나 긴 유예 때문에 정상 발성이 음질 불량이 되지 않게 하기 위해서입니다. 음성 인식이 필요한 게임의 실제 모드에서는 Web Speech API가 한국어 인식 문장을 만듭니다. DEMO에서는 게임별 정해진 문장이나 선택·입력한 문장과 키보드 발성 시간을 사용합니다. 서버는 문장을 정규화하고 한글 음소로 변환한 뒤 목표와 정렬하여 근사 점수와 재시도 패턴을 계산합니다. V2 활동 서비스는 게임별 5라운드의 과제·단서·다음 항목을 정하며, 서버가 반환한 라운드 이벤트가 게임 진행과 보상에 연결됩니다. 발화·분석·결정·이벤트는 SQLite에 저장되고 치료사 대시보드에 표시됩니다.

치료사 추천은 관찰·근거·신뢰도·제안을 보여 줍니다. 수락이나 수정 때만 새 목표 버전이 만들어지고, 거절은 사유와 함께 기록됩니다. 추천 자체가 목표를 자동 변경하지 않습니다.

라운드별 임상 요약은 실제 음성 관찰 전체(`totalObservedN`)와 평가 가능한 표본(`evaluableN`, AI가 성공·재시도로 판단한 관찰)을 나눕니다. 불확실(`uncertainN`)·발화 없음(`noSpeechN`)은 따로 세며 실패가 아닙니다. 치료사 확인 비율은 성공·재시도로 확인된 관찰만 분모로 씁니다. 자료가 없으면 0%가 아니라 "자료 없음"입니다. DEMO·샘플 관찰은 카드에 DEMO로 표시되고, 치료사가 검토해도 `DEMO_CONFIRMED`처럼 기록되어 임상 검증 통계와 활동 제안에 쓰이지 않습니다. 모든 라운드 항목은 기존 훈련 단어 목록에서 고르므로 Monster Adventure R4는 미훈련 단어가 아니라 "새 장면에서 훈련 단어 산출"로 표시합니다. 자세한 구조는 [아키텍처](docs/ARCHITECTURE.md)에 있습니다.

## 두두와 대화하기

두두 홈의 "두두와 대화하기"(`/play/chat`)는 게임 밖 자유대화입니다. 아동이 말하면 기존 음성 경로(AudioCapture·MicUtterancePipeline·VAD·WebSpeechRecognizer)로 발화를 요약하고, 서버가 목표 음소가 관찰됐는지(`TARGET_OBSERVED`·`TARGET_NOT_OBSERVED`·`UNCERTAIN`·`NO_SPEECH`)만 기록합니다. 정해진 목표 단어가 없으므로 발음의 정오를 판정하지 않습니다. 결정적 대화 정책이 다음 전략을 정하고, 대화 제공자는 그 전략을 짧은 한국어 문장으로 표현만 합니다. 두두는 아동이 한 말에 먼저 반응하고, 같은 주제 안에서 목표 음소가 자연스럽게 나올 질문을 합니다.

- 흐름: "대화 시작"을 한 번 누르면 호야 말하기 → 듣기 → (발화 끝) 생각하기(THINKING) → 말하기 → 듣기가 자동으로 이어집니다. 응답이 750ms보다 늦을 때만 "음..."을 한 turn에 한 번 말합니다(`HOYA_THINKING_FILLER_DELAY_MS`, `src/child/hoyaChatController.ts`). 호야가 말하거나 생각하는 동안에는 마이크 소리를 아동 발화로 보내지 않습니다. 호야의 표정·동작(THINKING·TALKING·LISTENING)은 이 대화 상태가 정하며, 대화 제공자(LLM)는 동작을 정하지 않습니다.
- 재시도와 중복 방지: 브라우저는 발화 1회마다 임의의 요청 ID(`clientRequestId`, UUID)를 만들고, 같은 발화의 재시도에는 같은 ID만 씁니다. 서버는 제공자를 부르기 전에 turn을 `PROCESSING`으로 먼저 저장하고(같은 turn·같은 ID는 한 요청만 성공), 같은 ID가 다시 오면 저장된 답을 돌려주거나 처리 중이면 202를 돌려줍니다. 같은 ID는 내용이 정확히 같은 요청(turn 번호·인식 문장·대체 후보·인식기·음향 요약의 SHA-256 fingerprint가 같음)에만 쓸 수 있고, 다르면 `409 REQUEST_ID_REUSED`입니다. 그래서 응답만 유실돼도 같은 답을 복구하고, 같은 발화로 외부 LLM을 두 번 부르지 않습니다. 응답을 못 받으면 브라우저는 `RECOVERING`이 되어 새 발화를 받지 않고(마이크 입력도 보내지 않음) 같은 ID로만 다시 묻습니다. 복구한 호야 답을 실제로 말한 뒤에만 다시 듣고, 여러 번 실패하면 인사하고 대화를 끝냅니다. 그래서 서버에 저장된 대화와 아이가 실제로 들은 대화가 같습니다. fingerprint는 인식 문장에서 나온 값이므로 보존 기간이 지나면 문장과 함께 비웁니다. 서버 중단 등으로 `HOYA_CHAT_STALE_SEC`(기본 30초, 제공자 timeout보다 김)가 지나도 `PROCESSING`인 turn은 외부 제공자를 다시 부르지 않고 DEMO 응답으로 마무리합니다.
- 대화 끝: 마지막 허용 turn(`HOYA_CHAT_MAX_TURNS`, 기본 30)을 저장하는 순간 서버가 대화를 끝냅니다. "대화 끝내기"(`/complete`)는 여러 번 불러도 안전합니다.
- 제공자: 기본은 LLM 없이 동작하는 DEMO 제공자입니다. `HOYA_CHAT_ENABLED=true`, `HOYA_CHAT_PROVIDER=openai`, `HOYA_CHAT_MODEL`(모델 이름, 코드에 고정하지 않음), `OPENAI_API_KEY`를 모두 넣으면 OpenAI Responses API를 씁니다. key가 없거나 시간 초과(`HOYA_CHAT_TIMEOUT_SEC`, 기본 8초)·서버 오류·형식이 틀린 응답·검증 실패가 나면 DEMO 응답으로 대신하고 대화는 계속됩니다. DEMO 대본의 질문 순서·돕는 규칙은 [기준값 목록](docs/audit/HEURISTIC_REGISTER.md) 9절에 있고, 두두가 하는 DEMO 문장은 모두 녹음 파일이 있습니다(`backend/tests/test_dudu_voice_lines.py`).
- 안전: 서버가 응답의 형식·전략·목표 단어(훈련 단어 목록 안)·금지 표현(교정·진단·치료 기법·개인정보 요청·지시문 노출)을 검사합니다. 아동 발화는 신뢰하지 않는 내용으로 서버 지시와 따로 보냅니다. LLM에는 도구를 주지 않습니다.
- 개인정보: 외부 LLM을 켜면 아동 발화의 인식 문장과 최근 대화 몇 turn, 목표 음소·단어·연령대가 설정한 제공자에게 전송됩니다. 이름·계정·play code·원본 음성은 보내지 않습니다. 보호자 동의가 있는 아동만 대화를 시작할 수 있습니다. 대화 문장은 `HoyaChatTurn`에 저장되고, 보존 기간(`TRANSCRIPT_RETENTION_DAYS`)이 지나면 아동 발화와 호야 응답 문장을 비웁니다. 치료사의 음성 자료 삭제는 대화 기록도 지웁니다.
- 임상 분리: 대화 기록은 진행 지표·임상 요약·활동 제안·임상 관찰에 들어가지 않습니다. 치료사는 '경과 · 기록' 탭에서 대화 회기 기록을 읽기 전용으로 봅니다(대화 없이 끝난 기록은 숨김). 실제 OpenAI 호출은 자동 테스트하지 않았습니다(가짜 transport만 사용).

API는 `POST /api/hoya/chat/sessions`, `GET /api/hoya/chat/sessions/{id}`, `POST /api/hoya/chat/sessions/{id}/turns`, `POST /api/hoya/chat/sessions/{id}/complete`입니다. turn 요청에는 `turnIndex`와 `clientRequestId`가 필요합니다. 기존 쿠키 인증·CSRF·Origin 검사를 그대로 쓰고, 아동은 로그인한 계정의 자기 대화만 쓸 수 있습니다. PR #4 초기 버전으로 만든 로컬 개발 DB의 `hoya_chat_turns` 표는 서버 시작 때 자료를 보존한 채 현재 구조로 옮깁니다(`app/hoya/schema_compat.py`).

## 치료사 데이터 읽기 화면

아동의 **경과 · 기록** 탭에서 목표 음소·위치·수준·활동별 첫 평가 가능 회기(기준선)와 이후 최근 최대 5회기를 비교합니다. 그래프 아래 표에도 같은 수치와 단서 유형별 건수가 나옵니다. 단서 유형은 순서 점수로 평균하지 않습니다.

- 실제·DEMO·샘플의 회기와 관찰 수를 따로 보여 줍니다. 비교에는 실제·비샘플이고 마지막 치료사 결정이 확인·교정인 자료만 씁니다.
- 불확실·무발화·목표 관찰·음질 POOR는 성공률 분모에서 뺍니다. 새 읽기 화면은 기존 음질 판정기의 잡음·클리핑 등 불량 신호도 보수적으로 제외합니다. 잡음 기준 미측정 안내만으로는 자동 제외하지 않습니다. 기존 계획·활동 제안의 계산 규칙은 바꾸지 않습니다.
- 회기를 열면 5라운드 가로 띠에서 시도 하나를 점 하나로 고를 수 있습니다. 원형은 시스템 측정, 삼각형은 자동 추정(규칙·기준값, 학습 모델 아님), 마름모는 치료사 확인·교정입니다. 선택한 관찰에서 측정 요약·단서·품질·판정 방식·원래 자동 추정 결과와 현재 검토 결과를 보고 기존 확인·교정·거부 동작을 사용합니다.
- 세션 노트는 서버 집계만으로 만든 복사 가능한 초안입니다. LLM과 원음 재생은 사용하지 않습니다. 치료사가 검토한 뒤 기록지에 붙여 넣으세요.
- 다음 회기와 활동 제안의 펼치기 영역에서 입력·규칙·한계를 확인할 수 있습니다. 수락·저장·승인은 여전히 치료사가 직접 선택합니다.

같은 탭 맨 위의 **대구대 건너기 분석**(2026-10-06)은 치료사 확인 비율 추이와 숙달선(80%·최근 실제 3회기), 단계 × 위치 표, 자동 추정 오류 유형(의심), 시작 박자, 전문 정보(/ㅅ/ 발달 시기·오류와 자동 추정·단서·서버 계산 다음 회기 제안), 가정 연습·회기 기록(SOAP) 초안 복사를 보여 줍니다. 새 라이브러리 없이 SVG로 그리고, DEMO·샘플 회기는 자리만 보이며 비율에 넣지 않습니다. '치료 목표' 탭에는 설계 근거 패널과 대상별 빠른 설정(시작 박자·빨라지기)이 있습니다.

읽기 API는 `GET /api/children/{id}/goal-trends`, `GET /api/sessions/{id}/insights`, `GET /api/therapist/children/{id}/crossing-analytics`입니다. 두 경로 모두 담당 아동 소유권을 확인합니다. 기존 `/progress` API·진행 그래프·`recharts` 의존성은 제거했습니다. 자료 없음은 0점이나 실패가 아니며, 회기 간 변화는 치료 효과의 증명이 아닙니다.

당시 작업 요약은 [작업 기록](docs/WORK_HISTORY.md)에 있습니다.

## 치료사 회기 계획

치료사 화면은 담당 아동 목록에서 시작합니다. 아동을 고르면 작업 공간이 열리고, 탭은 **요약 → 치료 목표 → 다음 회기 → 경과 · 기록** 순서입니다.

- 다음 회기 탭은 다섯 단계로 진행합니다: 최근 검증 근거 확인, 시스템 요약, 다음 회기 제안, 치료사 수정, 승인.
- 치료사는 긴 프롬프트를 쓰지 않습니다. 목표 음소, 위치, 단계, 시간, 시도 횟수, 단서, 단어, 대화 주제, 활동 순서를 선택지로 정하고, 자유 입력은 메모 하나뿐입니다.
- 회기 계획(`TherapistSessionPlan`)은 장기 목표(`TrainingGoal`)나 게임 실행 계획(`TrainingPlan`)과 다른 개념입니다.
  - 초안(DRAFT)만 수정할 수 있습니다.
  - 승인(APPROVED)된 계획은 바꿀 수 없고, 복제해서 새 revision을 만들어야 합니다.
  - 새 계획을 승인하면 이전 승인본은 SUPERSEDED가 됩니다.
  - 승인 시점의 목표와 근거 지표를 스냅숏으로 남깁니다.
- 근거로는 실제 음성 회기에서 치료사가 확인하거나 교정한 관찰만 씁니다.
  - DEMO, 샘플, 검토 대기, 거부된 관찰은 제외하고 건수만 보여 줍니다.
  - 불확실·무발화는 실패로 세지 않습니다.
  - 평가 가능한 시도가 5건보다 적으면 `INSUFFICIENT_DATA`로 표시하고 "현재 목표 유지 + 추가 관찰"을 제안합니다.
- 계산은 서버가 하고 AI는 설명만 합니다.
  - 지표와 제안은 Python이 결정적으로 계산합니다.
  - 요약 AI는 `THERAPIST_SUMMARY_ENABLED=true`, `THERAPIST_SUMMARY_MODEL`, `OPENAI_API_KEY`가 모두 설정됐을 때만 부릅니다. 이때도 계산된 값을 문장으로 옮기는 일만 합니다.
  - AI 출력에 진단 같은 금지 표현이나 입력에 없는 숫자가 있으면 버리고 템플릿 요약을 씁니다.
  - LLM에는 이름, id, play code, transcript, 치료사 메모를 보내지 않습니다.
  - 흐름은 LangGraph 그래프 한 방향 6단계이며 루프나 도구 호출은 없습니다.
  - LangSmith는 선택 사항인 모니터링 도구입니다. 제품 로직은 LangSmith에 의존하지 않고, 기본으로 꺼져 있습니다.
- 승인된 계획을 아동 화면(호야→게임→호야)에서 실행하는 기능은 다음 단계에서 구현합니다.

설계와 API 계약은 [치료사 업무 흐름과 AI 경계](docs/therapist-workflow.md)에 있습니다. 실제 OpenAI 요약 호출은 자동 테스트하지 않았습니다. 테스트에는 가짜 client만 썼습니다.

## 사전 요구사항

- Node.js 22.12 이상과 npm
- Python 3.11 이상 및 `pip`(CI는 Python 3.14)
- 실제 음성 모드에는 마이크 권한과 보안 컨텍스트(HTTPS 또는 localhost)가 필요합니다. Magic Beam·Sky Climb·대구대 건너기는 마이크와 Web Audio만 있으면 됩니다. Monster Adventure·Conversation Quest는 Web Speech API 음성 인식도 필요합니다. 지원하지 않는 게임은 실제 음성 버튼이 꺼지고 DEMO로 할 수 있습니다.

## 설치 방법

저장소 루트에서 프런트엔드 의존성을 설치하고, `backend`에서 Python 의존성을 설치합니다. Windows PowerShell에서 스크립트 실행이 제한되어 있으면 `npm.cmd`를 사용합니다.

```powershell
npm.cmd install
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

이 작업 환경에서는 `npm.cmd install`과 백엔드 의존성 설치를 확인했습니다. 가상환경에 `pip`가 없으면 `.venv\Scripts\python.exe -m ensurepip --upgrade` 후 설치 명령을 다시 실행합니다.

## 실행 방법

로컬 HTTP 시연에서는 `backend/.env`에 `SEED_DEMO_DATA=true`와 `COOKIE_SECURE=false`를 설정합니다. 서버는 저장소 루트와 `backend` 중 어디에서 실행하든 `backend/.env` 하나만 읽고, 같은 이름의 OS 환경 변수가 있으면 그 값이 우선합니다. 운영 환경은 `.env` 없이 OS 환경 변수만으로 실행할 수 있습니다. 운영 환경은 HTTPS와 `COOKIE_SECURE=true`를 사용하고 데모 데이터 생성을 끕니다. 각각 별도 터미널에서 실행합니다.

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
npm.cmd run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다. `SEED_DEMO_DATA=true`일 때만 샘플 치료사·아동 계정이 만들어지고, 로그인 화면에 "DEMO 치료사로 시작"·"DEMO 아동으로 시작" 버튼이 나타납니다. 이 버튼은 `POST /api/auth/demo-login`으로 서버가 샘플 계정 세션을 만들게 하며, 비밀번호는 프런트엔드 코드·API 응답·브라우저 저장소 어디에도 없습니다. `SEED_DEMO_DATA=false`이면 `demo-login`은 404이고, 기존 DB에 남아 있는 샘플 계정(샘플 치료사, `is_seed` 아동)은 비밀번호가 맞아도 로그인할 수 없으며 이전에 만든 세션도 거부됩니다. 로컬 스크립트용 샘플 비밀번호는 `backend/app/seed.py`에만 있습니다. 프런트엔드 개발 서버는 `/api`를 백엔드로 전달합니다. 새 아동 등록 시 생성되는 임시 비밀번호는 치료사에게 한 번만 표시됩니다. 기존 DB의 계정은 `cd backend; .venv\Scripts\python.exe -m scripts.provision_account <아이디> <STUDENT|THERAPIST|ADMIN> --child-id <ID>` 형식으로 생성할 수 있습니다. 치료사 계정은 `--therapist-id`를 사용합니다.

## 사용 방법

1. 아동 계정으로 로그인하면 두두가 바로 인사하는 대화로 갑니다(5일 데모 흐름). 두두의 집과 모험 지도는 `/play/home` 주소로 엽니다.
2. DEMO를 선택하면 `Space`를 누르는 동안 발성합니다. 마이크가 없을 때도 `Space`로 발성 시간을 입력할 수 있으며 음성 인식 결과는 스크립트입니다.
3. 실제 음성 모드를 선택하면 마이크 권한을 허용합니다. 발성 시작과 끝을 감지해 게임이 진행됩니다.
4. 치료사 화면에서 세션 기록과 추천 근거를 확인하고 목표를 결정합니다. 목표 변경은 다음 세션에 적용됩니다.

## 테스트 방법

저장소 루트에서 다음 명령을 실행합니다.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
backend\.venv\Scripts\python.exe -m pytest backend\tests -q --basetemp backend\test-temp\readme-full -p no:cacheprovider
backend\.venv\Scripts\python.exe backend\scripts\smoke_api.py
```

GitHub Actions의 최소 CI(`.github/workflows/ci.yml`, 2026-10-05)가 `main`·`claude/**`·`codex/**`에 올릴 때와 PR에서 같은 검사를 돌립니다. 프런트는 Ubuntu에서 타입 검사·테스트·빌드·`npm audit`(high)를, 백엔드는 Windows에서 pytest와 DEMO API smoke를 실행합니다. 배포와 브랜치 보호는 하지 않습니다.

pytest가 Windows 임시 폴더 접근 오류를 내면 `backend/tests`를 대상으로, 새 `--basetemp` 경로와 `-p no:cacheprovider`를 지정합니다. 2026-10-05 `claude/dudu-followup`의 CI(GitHub Actions)에서 백엔드 446개(건너뜀 0)·프런트엔드 248개와 타입 검사·빌드·smoke 3항목·`npm audit`이 통과했습니다. 2026-09-29 백엔드 228개·프런트엔드 62개 통과는 [V2 검증 기록(원문)](https://github.com/Riddlerio/s_project/blob/22eef9b993475537ec55859e1cca17dc15d02e73/docs/v2/VALIDATION_REPORT.md)의 과거 수치입니다. 2026-10-04 통합 검사에서 백엔드 324개·프런트엔드 172개와 타입 검사·빌드·DEMO API smoke가 통과했습니다. 회귀 명령은 [동결 계약](docs/audit/FROZEN_CORE_CONTRACT.md) 6절에 있습니다.

## 환경 변수와 API

백엔드는 `backend/.env.example`을 참고합니다. `.env`는 커밋하지 않습니다. `OPENAI_API_KEY`는 서버에만 두며 프런트엔드 코드·빌드에 넣지 않습니다(`npm.cmd run build`가 dist에서 key 이름과 로컬 `backend/.env`의 key 값을 검사합니다). `DATABASE_URL`은 SQLite 주소, `CORS_ORIGINS`는 허용할 프런트엔드 주소, `SEED_DEMO_DATA`는 샘플 데이터 생성 여부, `COOKIE_SECURE`는 HTTPS 전용 쿠키 여부입니다. 기본값은 샘플 데이터 비활성화와 보안 쿠키 활성화입니다. `TRANSCRIPT_RETENTION_DAYS`(기본 90일)와 `TRANSCRIPT_PURGE_INTERVAL_HOURS`(기본 24시간, 0이면 주기 실행 끔)는 인식 문장 보존 기간과 삭제 주기입니다. `LOGIN_WINDOW_MINUTES`(15분) 동안 같은 IP+아이디 5회, 같은 아이디 10회, 같은 IP 30회 실패하면 로그인을 잠시 막습니다(`LOGIN_MAX_FAILURES_PAIR`, `LOGIN_MAX_FAILURES_USERNAME`, `LOGIN_MAX_FAILURES_IP`). 없는 계정도 같은 비밀번호 해시 비용을 치르고 같은 오류 문구를 받습니다. 기존 DB에서는 서버 시작 시 `login_failures` 표가 새로 만들어지고, 이전 `login_throttles` 표는 더 쓰지 않습니다.

주요 경로는 `/api/auth/login`, `/api/auth/logout`, `/api/me/home`, `/api/activities`, `/api/activities/{id}/utterances`, `/api/sessions/{id}/timeline`, `/api/sessions/{id}/clinical-summary`, `/api/observations/{id}/decision`입니다. 로그인은 HttpOnly·SameSite 쿠키를 설정하고 응답의 CSRF 값을 이후 변경 요청의 `X-CSRF-Token` 헤더에 사용합니다. 역할과 아동 배정은 서버 DB가 결정합니다. `/api/system/info`와 `http://127.0.0.1:8000/docs`에서 API 정보를 확인할 수 있습니다.

API의 모든 응답(403·413 같은 조기 거부 포함)에는 `Cache-Control: no-store`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Content-Security-Policy`(기본 `default-src 'none'; frame-ancestors 'none'`, `CONTENT_SECURITY_POLICY`로 변경)가 붙습니다. 프로덕션 빌드의 `index.html`에는 `script-src 'self'` 중심의 CSP meta 태그가 들어갑니다. 개발 서버에는 넣지 않습니다. meta 태그로는 `frame-ancestors`가 적용되지 않으므로 화면 응답에도 HTTP 헤더가 필요합니다. 아래 공식 production 경로에서는 FastAPI가 화면(`/`, `/play/...`, `/therapist/...`, `/assets/...`)에도 `shared/frontend_csp.json` 정책에 `frame-ancestors 'none'`을 더한 CSP와 `X-Frame-Options: DENY`·`nosniff`·`Referrer-Policy`를 HTTP 헤더로 붙입니다.

### Production 실행 (공식 경로)

API와 화면을 uvicorn 하나로 같은 origin에서 서비스합니다. HTTPS는 앞단 TLS 종료(리버스 프록시 등)에서 처리하고, 헤더는 그대로 전달합니다.

```powershell
npm.cmd run build
cd backend
$env:FRONTEND_DIST = "..\dist"; $env:SEED_DEMO_DATA = "false"; $env:COOKIE_SECURE = "true"; $env:CORS_ORIGINS = "https://<서비스 주소>"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`npm.cmd run build`는 빌드 뒤 `scripts/check-dist.mjs`로 `dist`에 샘플 계정 문자열이 없는지 검사하고, 있으면 실패합니다. `FRONTEND_DIST`가 비어 있으면 API만 서비스합니다. 확장자가 없는 경로는 SPA이므로 `index.html`을 돌려주고, 없는 정적 파일과 `/api/...`는 404입니다.

## 프로젝트 구조

- `src/child`, `src/speech`: 아동 화면과 음성 입력
- `src/game`, `src/tiger`: 게임 장면과 두두 3D 캐릭터
- `src/therapist`: 치료사 화면(`analytics/`는 대구대 건너기 분석·설계 근거 패널)
- `backend/app/games`, `backend/app/training`, `backend/app/speech`, `backend/app/analysis`: 5라운드 규칙, 단어 목록·보상, 발화 분석, 진행 지표
- `backend/app/main.py`: API 및 세션 흐름
- `backend/tests`: 정책과 독립 테스트 DB를 쓰는 API 테스트
- `docs/ARCHITECTURE.md`: 구조와 데이터 흐름

## 문제 해결 방법

- 마이크를 사용할 수 없으면 DEMO 모드에서 `Space`로 발성 시간을 입력합니다.
- 실제 음성 인식을 지원하지 않는 브라우저에서는 DEMO 모드를 사용합니다.
- 포트가 사용 중이면 백엔드 포트와 `vite.config.ts`의 프록시 주소를 함께 변경합니다.
- 로컬 DB를 초기화하려면 앱을 중지한 뒤 `backend/speech_hero.db`를 삭제하고 재시작합니다. 이 작업은 저장된 세션을 지웁니다.
- Windows에서 백엔드 테스트가 `DLL load failed … 애플리케이션 제어 정책에서 이 파일을 차단했습니다`로 멈추면 SQLAlchemy C 확장(.pyd)이 막힌 것입니다. 보안 정책은 끄지 말고, 같은 버전의 순수 Python 휠(`py3-none-any`)로 다시 설치합니다: `.venv\Scripts\python.exe -m pip download --only-binary=:all: --platform any --implementation py --abi none --no-deps sqlalchemy==<버전> -d <빈 폴더>` 뒤 그 휠을 `pip install --force-reinstall --no-deps`로 설치합니다.

## 개인정보와 알려진 한계

원본 음성 파일은 서버에 저장하지 않지만 인식 문장과 발성 특징·세션 기록은 저장됩니다. 보존 기간이 지난 인식 문장과 대체 인식 결과는 서버 시작 시와 서버가 켜져 있는 동안 `TRANSCRIPT_PURGE_INTERVAL_HOURS`마다 비웁니다. 서버가 꺼져 있는 동안에는 실행되지 않으며 다음 시작 때 처리됩니다. 3D 호야를 그릴 수 없는 브라우저(WebGL 없음, GPU 오류, 컨텍스트 손실)에서는 간단한 호야 그림과 안내로 바뀌고 게임은 계속됩니다. 이 대체 화면은 3D 렌더가 아닙니다. 개발용 데모 계정은 운영 서비스에 사용할 수 없습니다. 실제 모드의 인식 품질은 브라우저·마이크·주변 소음에 영향을 받으며, Web Speech API가 발음을 표준 단어로 보정할 수 있습니다. 물리 마이크·3D 장면·배포 환경의 수동 검증과 라벨링된 아동 음성 데이터 기반 정확도 검증은 아직 완료되지 않았습니다.
