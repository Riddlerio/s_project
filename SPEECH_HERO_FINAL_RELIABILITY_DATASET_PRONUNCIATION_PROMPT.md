# Speech Hero V2 — Hoya Reliability Final Fix + Korean Child Pronunciation Dataset Experiment + Safe Runtime Promotion

> **목적**  
> `Riddlerio/s_project`의 현재 구조를 보존하면서  
> 1) PR #4의 마지막 Hoya 대화 복구 문제를 해결하고,  
> 2) 한국어 아동 발음 데이터셋을 실제로 검증·실험하고,  
> 3) 현재 Speech Hero 발음 판정보다 실제로 더 나은 경우에만 별도 단계에서 학습 모델을 제품에 **SHADOW** 방식으로 연결하며,  
> 4) 기존 게임·임상 통계·보안·개인정보·Hoya 대화 흐름을 깨뜨리지 않는 것을 목표로 한다.
>
> **자동 merge 금지.** 각 단계는 별도 branch / PR로 분리하며 이전 단계가 merge되기 전 다음 production 단계로 넘어가지 않는다.

---

## 0. 현재 기준 상태 — 실행 전에 반드시 다시 확인

Repository:

```text
Riddlerio/s_project
```

현재 확인 기준:

```text
PR #4
base: main
head: feature/hoya-adaptive-chat
state: OPEN
mergeable: true
known HEAD: b7dd92920667e653668d6ec2de0827a02c6bba90
main base: 09377fc6498e573bcfb6fda36e8d59758bf5fa39
```

이 값은 참고값일 뿐이다. 작업 시작 시 GitHub/local을 직접 다시 확인한다.

현재 구조에서 이미 중요한 사실:

- targeted word 발음 평가는 `Web Speech transcript → normalize → SimpleKoreanG2P → alignment` 중심의 근사 방식이다.
- Magic Beam / 일부 sound round는 `bestRunMs`, `fricationMs`, `activeMs`, RMS, 음질 gate 등 규칙 기반 acoustic feature를 사용한다.
- 학습된 pronunciation model은 현재 없다.
- Hoya 자유대화는 발음 정오를 판단하지 않고 `TARGET_OBSERVED / TARGET_NOT_OBSERVED / UNCERTAIN / NO_SPEECH`만 다룬다.
- 현재 일반 API body limit은 **65,536 bytes**이다.
- 현재 `src/api/client.ts`는 기본적으로 JSON 요청용이다.
- 현재 `AudioCapture`는 frame feature를 계산하지만 raw utterance waveform을 서버로 보내는 production path는 없다.
- `backend/requirements.txt`는 FastAPI/SQLAlchemy/Pydantic 중심의 가벼운 runtime 환경이며 PyTorch/Transformers가 없다.
- raw audio는 현재 앱 서버에 영구 저장하지 않는다.

위 사실을 깨뜨리는 변경을 무심코 넣지 않는다.

---

# 1. 가장 중요한 실행 원칙

이 작업은 한 번에 거대한 PR 하나로 만들지 않는다.

```text
PHASE A
PR #4 Hoya reliability 최종 수정
        ↓
독립 리뷰
        ↓
사용자가 merge

PHASE B
Pronunciation Dataset Research + Offline Experiment
별도 branch / 별도 PR
        ↓
실제 데이터 + 실제 수치로 기존 baseline과 비교
        ↓
RESEARCH GATE

PASS인 경우에만
        ↓

PHASE C
Pronunciation Model SHADOW Runtime Integration
별도 branch / 별도 PR
        ↓
현재 게임 결과에는 영향 없음
        ↓
실물 마이크 + 치료사 라벨 검증

그 이후에만 향후 ASSIST 검토
```

**PHASE B가 좋지 않으면 PHASE C를 만들지 않는다.**

다음 결과면 즉시 STOP:

```text
DATASET_NOT_AVAILABLE
DATASET_NOT_SUITABLE
LICENSE_UNCLEAR
BASELINE_NOT_COMPARABLE
NO_BASELINE_IMPROVEMENT
RESULT_INCONCLUSIVE
```

가짜 성능 수치, 가짜 데이터셋, 임의 라벨 생성 금지.

---

# 2. MULTI-AGENT ORCHESTRATION

가능하면 subagent를 병렬로 사용한다.

## MAIN AGENT

최종 책임자.

담당:

- Git 상태 확인
- subagent 범위 분리
- 충돌 방지
- 최종 코드 재검토
- 테스트 재실행
- commit / push / PR
- 최종 `READY_TO_MERGE / CHANGES_REQUIRED`
- 연구 결과의 최종 gate 판단

subagent의 보고를 그대로 신뢰하지 말고 실제 diff와 코드를 MAIN AGENT가 다시 읽는다.

## SUBAGENT A — Hoya Backend Reliability

PHASE A 전용.

담당 가능 파일:

```text
backend/app/hoya/api.py
backend/app/hoya/schemas.py
backend/app/hoya/schema_compat.py
backend/app/models.py
backend/tests/test_hoya_chat_reliability.py
```

목표:

- exact request identity
- request fingerprint
- migration compatibility
- idempotency / concurrency regression

## SUBAGENT B — Hoya Frontend Recovery

PHASE A 전용.

담당:

```text
src/child/hoyaChatController.ts
src/child/hoyaChatController.test.ts
src/api/hoyaChat.ts
src/api/hoyaChat.test.ts
src/child/HoyaChat.tsx
```

목표:

- unresolved turn 중 새 아동 발화 차단
- 복구된 Hoya response를 실제 TTS
- recovery final turn
- THINKING / filler / mic safety 유지

## SUBAGENT C — Dataset & License Research

PHASE B read-only research 우선.

담당:

- dataset 실제 접근 가능 여부
- dataset card / official site
- license
- speaker ID
- label granularity
- raw audio
- target word
- human transcription / correctness label
- redistribution / commercial constraints

코드를 먼저 수정하지 않는다.

## SUBAGENT D — Pronunciation ML Research

PHASE B.

담당:

- 논문 방법 검토
- baseline 정의
- speaker-disjoint split
- 모델 후보
- metric / statistical comparison
- data leakage 검토

## SUBAGENT E — Integration Safety

PHASE C read-only 설계 검토 후 필요한 최소 구현.

특히 확인:

- 64KB body middleware
- JSON-only API client
- raw audio privacy
- SQLite transaction duration
- optional ML dependencies
- lazy model loading
- existing `SpeechAnalysis.final_result`
- `ClinicalObservation`
- Hoya independence

## SUBAGENT F — Independent Final Reviewer

코드 수정 금지.

각 Phase 완료 후 latest diff를 읽고 blocker만 보고한다.

---

# 3. 작업 전 문서/코드 읽기

먼저 project-owned Markdown 목록을 확인한다.

```powershell
git ls-files "*.md"
```

최소 다음 파일을 읽는다.

```text
README.md
docs/v2/SPEECH_THERAPY_AI_CLINICAL_RATIONALE.md
docs/v2/VALIDATION_REPORT.md
SPEECH_HERO_HOYA_ADAPTIVE_CHAT_FINAL_PROMPT.md
```

관련 코드:

```text
backend/app/hoya/
backend/app/speech/
backend/app/pronunciation/
backend/app/games/
backend/app/clinical/
backend/app/analysis/
backend/app/models.py
backend/app/main.py
backend/app/config.py
backend/app/maintenance.py
backend/app/schemas.py
backend/app/db.py

src/child/HoyaChat.tsx
src/child/hoyaChatController.ts
src/child/ActivitySession.tsx
src/speech/
src/api/
src/shared/types.ts

backend/tests/
```

문서보다 **현재 코드가 실제 source of truth**이다.

---

# PHASE A — PR #4 Hoya Reliability 최종 수정

## 4. Preflight

실행:

```powershell
git status
git branch --show-current
git log -10 --oneline
git fetch origin
gh pr view 4
```

PR #4가 OPEN이면 branch:

```text
feature/hoya-adaptive-chat
```

에서만 수정한다.

금지:

```text
git reset --hard
git clean -fd
git add .
```

`backend/.env`는 절대 stage/commit/push하지 않는다.

로컬에 다음 파일이 존재하면 사용자가 만든 파일이므로 명시적 필요 없이는 stage/수정/삭제하지 않는다.

```text
T86BGWWKTY sk하이닉스 해커톤 지원번호.txt
.agents/skills/release-pr-readme/SKILL.md
SPEECH_HERO_V2_CLINICAL_MEANING_FINAL.md
SPEECH_HERO_V2_DECISIONS.md
SPEECH_HERO_V2_FINAL_REMEDIATION.md
SPEECH_HERO_V2_TASK.md
```

## 5. ISSUE A — response loss 뒤 child-heard history 불일치

현재 문제가 남아 있는지 **실제 최신 코드로 다시 확인**한다.

문제 상황:

```text
Child: "학교 갔어"
↓
Server turn 저장
Hoya response = "학교 다녀왔구나! 무슨 수업 했어?"
↓
HTTP response loss
↓
Frontend는 서버 결과를 모름
↓
Child가 다음 말을 먼저 함: "축구했어"
↓
Frontend가 뒤늦게 이전 turn을 복구하지만
복구된 Hoya response를 실제로 말하지 않고 다음 발화를 보냄
```

그 결과:

```text
server history != child가 실제 들은 history
```

가 된다.

### 필수 해결

결과를 모르는 logical turn이 존재하면:

```text
새 child utterance를 받지 않는다.
```

최종 flow:

```text
LISTENING
→ child speech
→ PROCESSING
→ HTTP result unknown
→ RECOVERING
→ THINKING
→ same requestId recovery
→ COMPLETED response
→ recovered Hoya response 실제 TTS
→ TALKING
→ TTS END
→ LISTENING
→ 그때 다음 child speech
```

recovery 중:

```text
controller.listening == false
submit(newUtterance) == false
```

이어야 한다.

## 6. Recovery 안내 문구

unresolved 상태에서:

```text
"다시 이야기해 줄래?"
```

처럼 새 발화를 요구하는 문장을 사용하지 않는다.

짧은 예:

```text
"음... 잠깐만, 호야가 다시 생각해 볼게."
```

하지만 이 문구가 끝나도 LISTENING으로 돌아가지 않는다.

## 7. Final turn recovery

복구된 response가:

```text
sessionComplete=true
```

이면:

```text
recovered final Hoya text TTS
→ TTS end
→ ENDED
```

순서.

final Hoya text를 건너뛰지 않는다.

## 8. ISSUE B — clientRequestId identity

같은 request ID는 **같은 logical request에만** 사용할 수 있어야 한다.

최소:

```python
stored_transcript != incoming_transcript
```

이면 409.

`None`도 정확한 값이다.

```text
None == None        허용
None != "학교 갔어" 거부
```

## 9. Request fingerprint 권장 구현

가능하면 Pydantic validation 후 다음 값을 canonical JSON으로 만든다.

```text
turnIndex
transcript
alternatives
recognizer
acoustic
```

그리고 SHA-256 fingerprint 저장.

raw HTTP body를 hash하지 않는다.

동일 `clientRequestId` retry:

```text
stored fingerprint == incoming fingerprint
```

일 때만 idempotent replay.

다르면:

```text
409 REQUEST_ID_REUSED
```

provider는 호출하지 않는다.

fingerprint에 child ID, account ID, play code, name, secret, API key를 넣지 않는다.

## 10. Hoya schema compatibility

fingerprint column을 추가한다면 현재 `schema_compat.py`의 detection이 `client_request_id` 존재 하나만으로 최신이라고 간주하지 않는지 확인한다.

다음 상태 모두 지원:

```text
A. Hoya table 없음
B. PR #4 초기 schema
C. b7dd929 계열 schema
   client_request_id 있음
   request_fingerprint 없음
D. 최종 schema
```

기존 local 개발 대화를 불필요하게 잃지 않는다.

## 11. PHASE A Tests

반드시 추가/유지:

```text
1. response loss → same request recovery → recovered Hoya text 실제 TTS → LISTENING
2. recovery 중 listening=false
3. recovery 중 new submit=false
4. final recovery → TTS → ENDED
5. recovery 오래 걸려도 filler "음..." logical turn당 최대 1회
6. recovery 중 end() → late response 무시
7. null transcript requestId 재사용 mismatch → 409
8. alternatives 변경 → 409
9. recognizer 변경 → 409
10. acoustic meaningful change → 409
11. canonical JSON order 차이 → fingerprint 동일
12. concurrent exact duplicate → provider call == 1
13. stale PROCESSING recovery 유지
14. /complete idempotent 유지
15. Conversation Quest 기존 flow 무변경
16. 기존 games에 THINKING이 새로 나타나지 않음
```

## 12. PHASE A 전체 검증

수정 전과 수정 후 둘 다 실행:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend -q --basetemp backend/test-temp -p no:cacheprovider
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git diff --check
npm.cmd audit
```

실제 OpenAI key가 없으면 real OpenAI call 성공을 주장하지 않는다.

## 13. PHASE A Git

logical commit만.

예:

```text
fix: preserve Hoya conversation history during recovery
fix: bind Hoya request ids to exact request fingerprints
test: cover recovered-response playback and identity reuse
docs: align Hoya recovery behavior
```

절대 `git add .` 하지 않는다.

PR #4에 push.

자동 merge 금지.

## 14. PHASE A Gate

최종:

```text
READY_TO_MERGE
또는
CHANGES_REQUIRED
```

PR #4가 아직 OPEN이면 **여기서 production coding STOP**.

사용자가 PR #4를 merge한 뒤 같은 프롬프트를 다시 실행하면 다음 Phase로 진행할 수 있어야 한다.

---

# PHASE B — Dataset Research + Offline Pronunciation Experiment

## 15. Phase B 시작 조건

GitHub에서 PR #4가 실제 main에 merge된 것을 확인한다.

그렇지 않으면 PHASE B production/research branch를 만들지 않는다.

merge 확인 후:

```powershell
git switch main
git pull --ff-only origin main
git switch -c research/pronunciation-v1
```

PHASE B는 **production runtime 변경이 아니다.**

---

# 16. 왜 dataset 실험을 하는가 — 문서에 남길 연구 근거

다음 내용을 최신 출처로 다시 검증한 뒤 `docs/v2/SPEECH_THERAPY_AI_CLINICAL_RATIONALE.md`에 새 섹션으로 추가한다.

권장 섹션:

```text
한국어 아동 발음 데이터셋 선택과 학습형 발음 모델 근거
```

## Evidence A — Korean Children SSD word-level study

Sung et al., 2024:

- Korean children age 2–9
- 573 participants
- 4.6 hours
- 21,915 word-level utterances
- 37 APAC target words
- metadata includes speaker ID, age, target word, human transcription
- Match/Mismatch label: human transcription == target word → correct, otherwise → incorrect
- speaker-disjoint five-fold cross-validation
- class distribution in paper: 약 66.3% correct / 33.7% incorrect
- word-level audio classification accuracy: **81.6%**
- ASR transcription accuracy in the same discussion: **60.2%**
- AC-2 speaker-level SSD detection: UAR 73.9 / F1 79.1 / Accuracy 90.9

논문의 중요한 해석:

```text
일반 ASR text만 보는 방식보다
아동 음성에 직접 fine-tune한 audio classifier가
target-word correctness에서 더 잘 동작할 가능성이 있다.
```

하지만 SSD label과 word correctness를 혼동하지 않는다.

Source:

```text
https://doi.org/10.13064/KSSS.2024.16.3.087
https://www.eksss.org/archive/view_article?pid=pss-16-3-87
```

## Evidence B — Korean SSD XLS-R pronunciation recognition

Clinical Linguistics & Phonetics 연구:

- 137 Korean children with SSD
- 73 clinical Korean words
- wav2vec2 XLS-R fine-tuned to recognise pronunciations **as actually produced**
- human heard-pronunciation annotations와 비교
- reported PER around 10%
- general Whisper around 50% PER
- study speech data is **not publicly available** because consent for public sharing was not obtained

이 연구는:

```text
general ASR가 표준 단어로 보정하는 문제를 피하고
실제 아동이 산출한 발음을 모델링할 필요성
```

의 근거로 사용한다.

하지만 dataset이 public이 아니므로 다운로드/학습 가능한 것처럼 쓰지 않는다.

Source:

```text
https://doi.org/10.1080/02699206.2024.2387609
```

## Evidence C — 2026 Korean toddler SSL study

Woodbridge & Suh, 2026 preprint:

- 53 Korean-speaking child recordings, age 2–5
- 3 independent reviewers
- 1,190 consonant binary correctness labels
- 748 vowel binary correctness labels
- consonant balanced accuracy 0.720 계열
- vowel balanced accuracy 0.845 계열
- reported cross-model mean around 0.782

이 연구는 Korean child pronunciation task에서 general ASR output만 보는 것보다 self-supervised speech representation을 직접 사용하는 접근을 비교 후보로 삼는 근거다.

현재 public dataset/code availability가 확인되지 않으면 method evidence로만 사용한다.

Source:

```text
https://arxiv.org/abs/2606.10213
```

## Evidence D — AI-Hub Korean Child Speech

AI-Hub "한국어 아동 음성 데이터":

- 5,000 hours
- WAV PCM
- 48 kHz 또는 16 kHz
- 16-bit mono
- speech transcription JSON
- 목적에 낮은 아동 음성 인식률 개선 명시
- structured/non-structured, noise/no-noise data

중요:

```text
ASR transcript label
!=
pronunciation correctness label
```

따라서 이 dataset을 `/ㅅ/ correct/incorrect` ground truth로 사용하지 않는다.

AI-Hub FAQ/정책은 raw data redistribution과 learned output usage를 구분하므로 실제 사용 시 **해당 dataset의 최신 개별 이용 조건**을 다시 확인한다.

Source:

```text
https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=540
https://www.aihub.or.kr/aihubnews/faq/list.do
```

## Evidence E — Hugging Face Pathological-child-voice

Dataset card 현재 설명:

- Korean children age 2–9
- 385 rows/speakers metadata
- 300+ minutes
- 16 kHz
- APAC / K-APP based recordings
- PCC (자음정확도)
- TD/SSD group
- stimulus type
- audio
- license: CC BY-NC-ND 4.0
- uploader states they did not participate in original dataset creation
- non-commercial/public-interest usage가 설명돼 있음

중요:

```text
PCC / TD-SSD group label
!=
한 utterance의 /ㅅ/ correct/incorrect label
```

따라서 특정 phoneme 정오 ground truth로 변환하지 않는다.

Source:

```text
https://huggingface.co/datasets/K-Univ/Pathological-child-voice
```

---

# 17. Dataset 후보를 무조건 2개 쓰지 않는다

사용자가 원하는 것은 "약 2개"지만 **부적합한 dataset을 숫자를 맞추기 위해 억지로 쓰지 않는다.**

## Candidate 1 — PRIMARY

```text
Korean Children SSD word-level dataset
(Sung et al., 2024)
```

가장 높은 우선순위.

이유:

```text
target word
human transcription
speaker ID
word-level Match/Mismatch
```

가 Speech Hero의 targeted pronunciation task와 가장 가깝기 때문.

단 실제 audio + metadata에 합법적으로 접근 가능해야 한다.

논문만 있고 dataset 파일이 없으면:

```text
DATASET_NOT_AVAILABLE
```

로 표시하고 사용 금지.

## Candidate 2 — SECONDARY

```text
K-Univ/Pathological-child-voice
```

이유:

- 실제 공개 audio
- 한국 아동
- APAC / K-APP domain
- age / PCC / SSD metadata
- Speech Hero 사용자 연령과 일부 겹침

용도:

```text
domain robustness
representation analysis
auxiliary / pretraining experiment
```

이지 individual phoneme correctness label이 아니다.

## Candidate 3 — FALLBACK / ASR AUXILIARY

```text
AI-Hub 한국어 아동 음성
```

직접 pronunciation correctness dataset이 아니라:

```text
child-ASR adaptation / child speech domain adaptation
```

용도.

5,000h 전체를 무조건 다운로드/학습하지 않는다.

subset experiment 또는 실제 자원에 맞춘 계획을 먼저 세운다.

---

# 18. Dataset selection decision

SUBAGENT C가 다음 표를 실제 근거로 작성한다.

```text
Dataset
Actual access
Audio
Speaker ID
Age
Target word
Human transcript
Per-utterance correctness
Phoneme label
License
Redistribution
Commercial restriction
Fit for Speech Hero
Selected role
```

최대 2개 선택.

가장 바람직한 조합:

```text
PRIMARY:
Korean Children SSD word-level
(실제 접근 가능한 경우)

SECONDARY:
HF Pathological-child-voice
```

PRIMARY를 실제로 얻을 수 없으면:

```text
HF + AI-Hub
```

를 research에 사용할 수는 있지만 둘만으로 direct word/phoneme pronunciation correctness model을 임상적으로 타당하다고 만들지 않는다.

이 경우:

```text
NO_DIRECT_PRONUNCIATION_DEPLOYMENT
```

가 될 수 있다.

---

# 19. PHASE B에서는 production runtime 수정 금지

PHASE B에서 수정 금지:

```text
backend/app/main.py의 production decision path
backend/app/speech/pipeline.py final result semantics
ClinicalObservation 결과 생성 규칙
ProgressMetric
TrainingPolicy
HoyaConversationPolicy
src/child/ActivitySession.tsx production audio upload
src/api/client.ts
현재 global 64KB body middleware
```

PHASE B에서 raw child audio upload endpoint를 만들지 않는다.

PHASE B에서 다음 dependency를 `backend/requirements.txt`에 추가하지 않는다.

```text
torch
transformers
datasets
librosa
torchaudio
```

---

# 20. Research-only 구조

예:

```text
research/pronunciation/
├── README.md
├── requirements.txt
├── datasets/
│   ├── base.py
│   ├── korean_ssd.py
│   ├── hf_pathological_child.py
│   ├── aihub_child.py
│   └── registry.py
├── preprocessing/
│   ├── audio.py
│   ├── labels.py
│   └── split.py
├── baselines/
│   ├── speech_hero_proxy.py
│   └── current_runtime_notes.md
├── experiments/
│   ├── ssl_classifier.py
│   ├── child_asr.py
│   └── run_experiment.py
├── evaluation/
│   ├── metrics.py
│   ├── statistics.py
│   └── report.py
└── reports/
    └── pronunciation_v1.md
```

구조는 repo에 맞춰 조정 가능.

---

# 21. Raw dataset / checkpoint Git 보호

기존 `.gitignore`를 비우거나 덮어쓰지 않는다.

필요하면 append:

```gitignore
research/data/
research/cache/
research/checkpoints/
research/outputs/audio/
models/private/
*.pt
*.pth
*.ckpt
*.safetensors
```

단 실제 project에 필요한 작은 fixture까지 막지 않게 확인한다.

raw dataset은 Git에 절대 commit하지 않는다.

model weight도 기본 Git commit 금지.

---

# 22. Dataset 자동 대용량 다운로드 금지

기본 실행에서 3.89GB HF data나 5,000h AI-Hub를 무조건 자동 다운로드하지 않는다.

환경 변수/CLI path:

```text
KOREAN_SSD_DATA_DIR=
HF_PATHOLOGICAL_CHILD_DIR=
AIHUB_CHILD_SPEECH_DIR=
```

등으로 받는다.

dataset이 없으면:

```text
NOT RUN — DATASET NOT AVAILABLE
```

라고 보고한다.

---

# 23. Label safety

절대 금지:

```text
PCC 낮음 → 이 utterance의 /ㅅ/ 틀림
SSD group → 모든 발음 incorrect
ASR transcript mismatch → 임상 발음 오류 확정
AI-Hub transcript → pronunciation correctness label
```

Label 의미를 원 데이터보다 확대하지 않는다.

---

# 24. Speaker leakage 절대 금지

split은 speaker-level.

```text
한 아동의 audio가 train과 test에 같이 들어가면 실패
```

가능하면 age / label / group 분포를 고려한 speaker-disjoint split.

Sung et al. 연구처럼 same-speaker leakage를 막는 원칙을 따른다.

---

# 25. 현재 Speech Hero baseline을 공정하게 정의

가장 중요한 부분.

현재 실제 product baseline은:

```text
browser Web Speech
→ transcript
→ normalize
→ SimpleKoreanG2P
→ target alignment
→ acoustic quality gate
→ rule result
```

이다.

하지만 Web Speech API는 offline dataset batch 평가가 재현 가능하지 않을 수 있다.

따라서 baseline을 억지로 동일하다고 주장하지 않는다.

## BASELINE TYPE A — CURRENT_RUNTIME_BASELINE

오직 실제 현재 browser/WebSpeech path로 동일 held-out audio를 재생/입력하여 결과를 얻을 수 있을 때만 이 이름 사용.

가능한 방법을 조사하되 서비스 약관이나 browser 제약을 우회하지 않는다.

## BASELINE TYPE B — REPRODUCIBLE_PROXY_BASELINE

offline ASR 또는 reproducible recognizer를 이용해 현재:

```text
normalize + SimpleKoreanG2P + alignment
```

평가 로직을 재현하는 경우.

이 결과는 반드시:

```text
PROXY
```

라고 표시한다.

## 금지

human reference transcript를 ASR output 자리에 넣고 "현재 Speech Hero baseline"이라고 부르지 않는다.

그것은 label leakage다.

---

# 26. Dataset task와 Speech Hero task를 맞춘다

학습 모델 비교는 label이 실제로 지원하는 수준에서만 한다.

```text
word-level Match/Mismatch label
→ word pronunciation correctness classifier

phoneme correctness label
→ phoneme correctness classifier

PCC
→ speaker-level / aggregate auxiliary task

TD/SSD
→ group classification auxiliary task
```

서로 다른 task의 accuracy를 직접 비교하지 않는다.

---

# 27. Model experiment strategy

direct word correctness dataset이 실제 확보된 경우:

첫 실험은 무조건 거대한 full fine-tuning만 하지 않는다.

비교:

```text
A. frozen SSL backbone + lightweight head
B. partial fine-tuning
C. 필요할 때만 full fine-tuning
```

backbone 후보:

```text
HuBERT
WavLM
XLS-R / wav2vec2
```

문헌에 나왔다고 한 모델을 무조건 승자로 정하지 않는다.

자원에 맞춰 최대 2~3개만 비교.

---

# 28. Secondary dataset 사용법

HF Pathological-child-voice를 선택했다면:

- PCC / SSD label을 direct word correctness로 바꾸지 않는다.
- domain representation / robustness / auxiliary task에만 사용.
- selected primary task 성능을 실제로 올리는지 ablation으로 확인.

예:

```text
Primary only
vs
Primary + HF auxiliary/domain adaptation
```

를 비교.

도움이 없으면 secondary data를 모델에 넣지 않는다.

---

# 29. AI-Hub 사용법

AI-Hub를 선택했다면 목적은:

```text
child ASR / child speech representation adaptation
```

이다.

현재 브라우저 Web Speech API 자체를 fine-tune할 수 있다고 가정하지 않는다.

AI-Hub를 쓰는 경우 별도의 offline ASR/representation experiment로 취급.

예:

```text
general speech representation
vs
child-domain-adapted representation
```

이 target pronunciation classifier에 실제 도움을 주는지 확인.

도움이 없으면 production에 넣지 않는다.

---

# 30. Data augmentation

가능:

```text
background noise
gain
small time shift
speed perturbation
SpecAugment-like training augmentation
```

단 train split에서만.

validation/test에는 적용 금지.

speaker split 후 augmentation.

---

# 31. Metrics

accuracy 하나로 결정 금지.

direct correct/incorrect task 최소:

```text
Balanced Accuracy
Macro F1
Incorrect-class Recall
Incorrect-class Precision
False Correction Rate
Confusion Matrix
```

가능하면:

```text
AUROC
AUPRC
Calibration / ECE
```

target label이 허용하면 `/ㅅ/`, `/ㅈ/`, `/ㄹ/` 별도 성능.

연령별 성능도 sample 수가 충분할 때만 보고.

표본이 너무 작으면 억지 해석 금지.

---

# 32. "기존보다 좋다" 판단 기준

동일한 speaker-disjoint held-out examples에서 비교한다.

최소 조건:

```text
1. Balanced Accuracy > baseline
2. Macro F1 > baseline
3. Incorrect-pronunciation recall이 baseline보다 의미 있게 나빠지지 않음
4. Correct pronunciation을 틀렸다고 지적하는 False Correction Rate가 baseline보다 나빠지지 않음
5. dataset leakage 없음
```

가능하면 paired bootstrap 또는 적절한 paired test를 사용.

권장:

```text
95% bootstrap confidence interval
```

주요 metric difference가 불확실하면:

```text
RESULT_INCONCLUSIVE
```

라고 한다.

단순 point estimate +0.5% 같은 결과로 "좋아졌다"고 결론내리지 않는다.

---

# 33. Product promotion gate

다음 두 경우를 구분한다.

## CASE 1 — actual CURRENT_RUNTIME_BASELINE와 직접 비교 가능

learned model이 동일 test set에서 위 gate를 통과하면:

```text
SHADOW_CANDIDATE
```

## CASE 2 — PROXY baseline만 가능

성능이 좋아도:

```text
RESEARCH_PROMISING
```

까지만.

실제 runtime에서 기존보다 더 정확하다고 문서에 쓰지 않는다.

실물 mic / browser comparison이 필요하다.

---

# 34. PHASE B 보고서

생성:

```text
research/pronunciation/reports/pronunciation_v1.md
```

반드시 포함:

```text
Selected datasets
Why selected
Rejected datasets and why
Actual access status
License findings
Number of speakers
Number of utterances
Label distribution
Speaker-disjoint split
Baseline definition
Whether baseline is CURRENT_RUNTIME or PROXY
Models
Training setup
Metrics
Confidence intervals
Per-target results where valid
Ablation: primary only vs primary+secondary
Limitations
Decision
```

가짜 숫자 금지.

---

# 35. PHASE B docs 업데이트

실제 조사/실험 결과에 맞춰:

```text
docs/v2/SPEECH_THERAPY_AI_CLINICAL_RATIONALE.md
docs/v2/VALIDATION_REPORT.md
README.md
```

최소 변경.

`SPEECH_THERAPY_AI_CLINICAL_RATIONALE.md`에는 다음을 명확히 구분:

```text
1. 현재 production 발음 판정
2. 데이터셋 선택 이유
3. 논문 근거
4. dataset label의 실제 의미
5. offline experiment 결과
6. 현재 runtime에 적용됐는지 여부
7. clinical validation과 technical evaluation의 차이
```

외부 dataset에서 좋은 결과가 나와도 `CLINICALLY VALIDATED`라고 쓰지 않는다.

---

# 36. PHASE B Git / PR

research-only commits 예:

```text
research: add Korean child pronunciation dataset audit
research: add speaker-disjoint pronunciation baselines
research: compare child speech pronunciation models
docs: document dataset evidence and experiment results
```

별도 PR.

production code 변경이 섞이면 실패.

자동 merge 금지.

---

# 37. PHASE B Gate

최종 결정 중 하나:

```text
DATASET_NOT_AVAILABLE
DATASET_NOT_SUITABLE
LICENSE_UNCLEAR
RESULT_INCONCLUSIVE
NO_BASELINE_IMPROVEMENT
RESEARCH_PROMISING
SHADOW_CANDIDATE
```

`SHADOW_CANDIDATE`가 아니면 PHASE C production integration을 진행하지 않는다.

research PR이 merge되기 전에도 PHASE C를 같은 branch에 섞지 않는다.

---

# PHASE C — Pronunciation Model SHADOW Integration

## 38. 시작 조건

모두 필요:

```text
PR #4 merged
PHASE B research PR merged
PHASE B decision == SHADOW_CANDIDATE
```

아니면 STOP.

새 branch:

```text
feature/pronunciation-shadow-v1
```

## 39. SHADOW의 의미

SHADOW는 model을 실제 audio에 실행하지만:

```text
게임 success/retry 변경 금지
HoyaConversationPolicy 변경 금지
ClinicalObservation.ai_result 변경 금지
SpeechAnalysis.final_result 변경 금지
ProgressMetric 변경 금지
reward 변경 금지
difficulty 변경 금지
```

한다.

기존 rule engine이 source of truth.

학습 모델은 별도 prediction만 저장.

## 40. Runtime model dependency 충돌 방지

현재 `backend/requirements.txt`에 PyTorch/Transformers를 무조건 추가하지 않는다.

권장:

```text
backend/requirements-ml.txt
```

또는 optional extra.

기본:

```text
PRONUNCIATION_MODEL_MODE=off
```

에서 ML dependency가 없어도 기존 backend가 정상 import/start/test되어야 한다.

production module top-level에서 `import torch`를 무조건 실행하지 않는다.

lazy import / provider abstraction.

## 41. Model provider abstraction

예:

```text
PronunciationProvider
├── DisabledPronunciationProvider
└── LearnedPronunciationProvider
```

필요 시:

```text
PronunciationModelPrediction
```

별도 model/table.

기존 `SpeechAnalysis`를 덮어쓰지 않는다.

## 42. raw audio는 기존 JSON endpoint에 억지로 넣지 않는다

현재 global body limit:

```text
65536 bytes
```

현재 `src/api/client.ts`는 JSON 중심이다.

따라서:

```text
activity utterance JSON에 base64 audio 추가
```

금지.

base64는 더 커지고 현재 64KB 제한과 충돌한다.

## 43. 가장 안전한 SHADOW runtime 구조

권장 flow:

```text
브라우저
 ├─ 기존 feature/VAD/ASR
 │        ↓
 │   기존 utterance JSON endpoint
 │        ↓
 │   기존 game result 즉시 확정
 │
 └─ 짧은 utterance audio buffer
          ↓
   별도 shadow pronunciation endpoint
          ↓
   model inference
          ↓
   PronunciationModelPrediction 저장
```

shadow endpoint 실패가 기존 게임 결과를 막으면 안 된다.

## 44. utterance ID 연결

필요하면 기존 activity response에:

```text
utteranceId
```

를 backward-compatible하게 추가.

그 후 별도 shadow request가 해당 utterance를 참조.

서버에서 반드시 확인:

```text
utterance belongs to authenticated child
session belongs to child
session mode == real
guardian consent exists
```

IDOR 금지.

## 45. Raw audio capture

기존 `AudioCapture` feature semantics를 깨지 않는다.

raw utterance buffer가 필요하면 별도 책임의 component를 추가.

예:

```text
UtteranceAudioRecorder
```

또는 동등한 구조.

기존 20ms feature extraction / VAD / SustainTracker 결과를 변경하지 않는다.

## 46. Raw audio endpoint body size

global 64KB 제한을 전체 서비스에서 제거하지 않는다.

별도 pronunciation audio endpoint에만 route-specific cap을 둔다.

cap은 허용 sample rate / channel / encoding / max duration으로 계산·문서화한다.

무제한 upload 금지.

지원 format을 명확히 제한.

## 47. Raw audio privacy

반드시:

```text
DB raw audio 저장 금지
application log raw audio 금지
exception log에 body 금지
LLM으로 raw audio 전송 금지
```

temp file이 필요하면 `try/finally cleanup` 필수.

in-memory 가능하면 선호.

## 48. SQLite / long inference 충돌 방지

ML inference를 실행하는 동안 기존 game DB transaction을 오래 잡고 있지 않는다.

특히 `activity_utterance()` 안에 무거운 모델 inference를 직접 집어넣지 않는다.

shadow endpoint를 분리하는 이유다.

## 49. Model loading

FastAPI startup 시 huge model mandatory load 금지.

```text
lazy load
cached singleton
timeout
health state
```

사용.

model path가 없거나 load 실패:

```text
기존 Speech Hero 정상 실행
shadow prediction unavailable
```

이어야 한다.

## 50. Configuration

예:

```env
PRONUNCIATION_MODEL_MODE=off
PRONUNCIATION_MODEL_PATH=
PRONUNCIATION_MODEL_TIMEOUT_SEC=
```

기본 `off`.

`.env.example`에는 key 이름만.

실제 path/secret/local 값은 Git 제외.

## 51. Shadow prediction schema

최소:

```text
utterance_id
model_name
model_version
dataset_manifest_version
target_phoneme
target_word
predicted_label
raw_score
confidence_bucket
audio_quality
created_at
```

단 `clinical_result`, `final_result` 같은 이름으로 기존 판단과 혼동시키지 않는다.

## 52. deletion / privacy lifecycle

`DELETE /api/children/{child_id}/speech-data` 시 해당 child의 `PronunciationModelPrediction`도 삭제.

FK 순서 테스트.

raw audio는 애초에 남아 있으면 안 된다.

## 53. Hoya 영향 없음

PHASE C SHADOW에서:

```text
Hoya free chat evidence
HoyaConversationPolicy
Hoya LLM prompt
Hoya target word selection
```

변경 금지.

learned pronunciation prediction을 Hoya에게 넘기지 않는다.

## 54. Clinical 영향 없음

PHASE C SHADOW에서:

```text
ClinicalObservation
ProgressMetric
ActivityRecommendation
AIRecommendation
training difficulty
success/retry
```

가 learned prediction 때문에 바뀌면 실패.

## 55. Targeted task 우선

Pronunciation Model V1 shadow 대상 우선순위:

```text
Monster Adventure targeted word rounds
→ structured phrase/word production

NOT:
Hoya free conversation first
```

free conversation에는 exact expected target word가 없으므로 초기 pronunciation correctness model의 source of truth로 사용하지 않는다.

## 56. SHADOW runtime tests

반드시:

```text
1. MODEL_MODE=off → 기존 결과 regression 없음
2. model package 없음 → backend starts
3. model path 없음 → fallback, app 정상
4. inference timeout → game 정상
5. invalid output → game 정상
6. shadow prediction 저장
7. raw audio DB에 없음
8. temp audio cleanup
9. IDOR 차단
10. consent 없음 차단
11. oversized audio 413
12. unsupported audio 4xx
13. ClinicalObservation unchanged
14. SpeechAnalysis.final_result unchanged
15. ProgressMetric unchanged
16. Hoya flow unchanged
17. speech-data deletion removes model predictions
18. default backend requirements만으로 non-ML test 정상
```

## 57. PHASE C verification

기존 전체:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend -q --basetemp backend/test-temp -p no:cacheprovider
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git diff --check
npm.cmd audit
```

ML optional test environment도 별도로 기록.

## 58. 실제 mic validation 전 ASSIST 금지

offline dataset 결과와 shadow만으로:

```text
PRONUNCIATION_MODEL_MODE=assist
```

를 production default로 만들지 않는다.

최소 추가 검증:

```text
실물 microphone
여러 기기
background noise
실제 Korean child speech
치료사 independent labels
false correction review
```

가 필요.

## 59. 문서 상태 표현

다음 표현을 구분한다.

```text
TECHNICAL DATASET EVALUATION:
NOT RUN / EVALUATED

RUNTIME SHADOW:
OFF / IMPLEMENTED / MANUALLY VERIFIED

CLINICAL VALIDATION:
NOT VALIDATED

PRODUCTION READY:
NO
```

외부 dataset 성능을 Speech Hero 임상 성능으로 표현 금지.

---

# 60. 최종 독립 리뷰

SUBAGENT F에게 다음을 묻는다.

## Hoya

- response loss 후 child-heard/server history 일치?
- unresolved 중 새 speech 가능한 경로 남음?
- request fingerprint exact?
- concurrency provider once?
- final recovery TTS 후 END?

## Dataset / experiment

- label leakage?
- speaker leakage?
- baseline에 human transcript leakage?
- 서로 다른 task metric을 비교했는가?
- dataset license를 과장했는가?
- public이 아닌 dataset을 사용했다고 주장했는가?

## Runtime shadow

- global 64KB security limit을 무분별하게 제거했는가?
- 기존 JSON API를 audio base64로 망가뜨렸는가?
- backend default requirements를 torch로 무겁게 만들었는가?
- raw audio가 남는가?
- SQLite transaction 동안 inference하는가?
- final_result / clinical metrics가 변했는가?
- Hoya가 learned pronunciation을 사용하게 됐는가?

하나라도 blocker이면 `CHANGES_REQUIRED`.

---

# 61. 최종 보고 형식

```text
CURRENT GIT STATE

PHASE EXECUTED:
A / B / C

SUBAGENTS USED

==================================================
PHASE A
==================================================

HOYA RECOVERED RESPONSE PLAYBACK:
FIXED / NOT FIXED / NOT APPLICABLE

REQUEST IDENTITY:
FIXED / NOT FIXED / NOT APPLICABLE

REQUEST FINGERPRINT:
IMPLEMENTED / NOT IMPLEMENTED

HOYA TESTS

==================================================
PHASE B
==================================================

DATASET CANDIDATES REVIEWED

DATASET 1:
name
actual access
role
label granularity
license
selected/rejected
reason

DATASET 2:
...

AI-HUB:
SELECTED / AUXILIARY / REJECTED
reason

HF PATHOLOGICAL CHILD:
SELECTED / AUXILIARY / REJECTED
reason

KOREAN CHILDREN SSD WORD DATA:
AVAILABLE / NOT AVAILABLE
selected/rejected

BASELINE TYPE:
CURRENT_RUNTIME_BASELINE / REPRODUCIBLE_PROXY_BASELINE

SPEAKER-DISJOINT:
PASS / FAIL

BASELINE RESULTS
LEARNED MODEL RESULTS
PRIMARY ONLY RESULTS
PRIMARY + SECONDARY RESULTS
BALANCED ACCURACY
MACRO F1
INCORRECT RECALL
FALSE CORRECTION RATE
CONFIDENCE INTERVAL
PER-TARGET RESULTS
(only if valid labels exist)

RESEARCH DECISION:
DATASET_NOT_AVAILABLE /
DATASET_NOT_SUITABLE /
LICENSE_UNCLEAR /
RESULT_INCONCLUSIVE /
NO_BASELINE_IMPROVEMENT /
RESEARCH_PROMISING /
SHADOW_CANDIDATE

==================================================
PHASE C
==================================================

SHADOW IMPLEMENTED:
YES / NO / NOT ELIGIBLE

DEFAULT MODE:
OFF

RAW AUDIO:
EPHEMERAL / STORED / NOT USED

GLOBAL 64KB LIMIT:
UNCHANGED / CHANGED
(if changed, justify; broad removal is blocker)

ML DEPENDENCIES:
OPTIONAL / DEFAULT
(DEFAULT is blocker unless explicitly justified)

CURRENT RULE ENGINE:
UNCHANGED / CHANGED

SPEECH ANALYSIS FINAL RESULT:
UNCHANGED / CHANGED

CLINICAL OBSERVATION:
UNCHANGED / CHANGED

PROGRESS METRICS:
UNCHANGED / CHANGED

HOYA:
UNCHANGED / CHANGED

==================================================
GLOBAL VERIFICATION
==================================================

BACKEND TESTS
FRONTEND TESTS
TYPECHECK
BUILD
NPM AUDIT
GIT DIFF CHECK

OPENAI REAL CALL:
VERIFIED / NOT MANUALLY VERIFIED

PHYSICAL MICROPHONE:
VERIFIED / NOT MANUALLY VERIFIED

ANDROID:
VERIFIED / NOT MANUALLY VERIFIED

TECHNICAL DATASET EVALUATION:
NOT RUN / EVALUATED

CLINICAL VALIDATION:
NOT VALIDATED

PRODUCTION READY:
NO

REMAINING LIMITATIONS
COMMITS
PR URL
HEAD

WORKING TREE:
CLEAN / DIRTY

FINAL VERDICT:
READY_TO_MERGE / CHANGES_REQUIRED
```

---

# 62. 최종 금지사항 요약

절대 하지 않는다.

```text
- PR #4에 ML 연구 코드를 섞기
- dataset이 없는데 학습했다고 쓰기
- PCC를 /ㅅ/ correctness로 변환
- AI-Hub transcript를 pronunciation correctness label로 사용
- human reference transcript를 current ASR baseline output으로 사용
- speaker leakage
- raw dataset commit
- model weight commit
- git add .
- backend/.env commit
- global 64KB limit 무제한 제거
- JSON request에 base64 audio 밀어 넣기
- backend default requirements에 huge ML stack 강제
- FastAPI import 시 huge model 강제 load
- long ML inference 동안 game DB transaction 유지
- raw audio 영구 저장
- SHADOW 결과로 success/retry 변경
- SHADOW 결과로 Hoya policy 변경
- 외부 dataset technical result를 clinical validation이라 부르기
- 자동 merge
```

---

# 63. 최종 목표

최종적으로 원하는 구조:

```text
현재 production
────────────────────────────────────────────
Child Speech
   │
   ├─ Existing Web Speech / Acoustic Rules
   │            ↓
   │       Current Game Result
   │       (source of truth)
   │
   └─ [PHASE C에서만] Learned Pronunciation Model
                ↓
          Shadow Prediction
                ↓
       therapist / technical comparison

Hoya Chat
────────────────────────────────────────────
기존 deterministic speech evidence + policy 유지
learned pronunciation model과 분리
```

데이터셋 모델이 실제로 현재 방식보다 좋아도 처음에는 **기존 판단을 바꾸지 않는 SHADOW**로 연결한다.

그 후 실물 마이크와 치료사 독립 라벨에서 다시 우수성을 확인한 경우에만 향후 별도 PR에서 ASSIST 사용을 검토한다.

---

# 64. 이 프롬프트의 성공 조건

성공은 "코드가 많이 추가됨"이 아니다.

```text
1. Hoya의 남은 correctness issue가 해결됨.
2. 현재 production 기능이 회귀하지 않음.
3. Speech Hero 문제에 맞는 실제 dataset만 선택됨.
4. dataset label 의미를 과장하지 않음.
5. 같은 held-out data에서 기존 baseline과 공정 비교.
6. 새 모델이 실제로 더 좋은지 통계적으로 판단.
7. 나쁘거나 불확실하면 product integration을 하지 않음.
8. 좋으면 별도 PR에서 SHADOW로만 안전하게 연결.
9. raw audio / dependency / DB / 64KB / privacy 충돌을 설계로 해결.
10. clinical validation을 거짓 주장하지 않음.
```

자동 merge하지 마라.
