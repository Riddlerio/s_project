# 앞으로 할 일

> **기준 시각:** 2026-10-06 아침 · main `3f6c0da`(PR #20까지 병합)
> 이 파일 하나로 다른 기기에서도 이어서 할 수 있게 정리했다.
> - 지난 일과 결정: [WORK_HISTORY.md](WORK_HISTORY.md)
> - Codex에게 번호로 시키는 일: [CODEX_TASKS.md](CODEX_TASKS.md)

---

## 0. 한눈에 보기

데모는 **10/9**다. 남은 일은 약 **11~15시간** 분량이다. Codex와 Claude가 나눠서 **동시에** 진행한다.

| 단계 | 할 일 | 담당 | 상태 | 예상 시간 | 시작 조건 |
|:-:|---|---|:-:|:-:|---|
| 1 | 1번 마무리 + 1·2번 PR 열기 (CODEX_TASKS **4번**) | Codex | ✅ | 30분 | PR #22 병합 |
| 2 | 치료사 분석 그래프용 집계 API (CODEX_TASKS **5번**) | Codex | ✅ | 1.5~2시간 | PR #24 병합 |
| 3 | 자연스러운 대화 대본 + 새 두두 음성 | Claude + 사용자(VOLI 로그인) | ✅ | 2~3시간 | PR #23 병합 확인 |
| 4 | 치료사 근거 패널 + 분석 그래프 화면 + 전문 정보 | Claude | ✅ | 2~3시간 | PR #25 병합 확인 |
| 5 | 치료사 화면 시연 동선 점검 (CODEX_TASKS **3번**) | Codex | ⬜ | 1시간 | 4단계 병합 뒤 |
| 6 | 통합 점검(휴대폰 폭 전체 흐름)·문서 | Claude | ⬜ | 1~2시간 | 5단계 뒤 |
| 7 | 아이폰 리허설과 수정 | 사용자 + Claude | ⬜ | 2~3시간 | "리허설 할게" |
| 8 | 데모 당일 준비: 핫스팟 연결·백업 영상·체크리스트·시연 버전 태그 | 사용자 + Claude | ⬜ | 1~2시간 | 7단계 뒤 |

✅ 끝 · ⏳ 진행 중 · ⬜ 아직

> **데모 뒤로 미룬 일**(로컬 음성 대화 모델·LoRA, 아이 목소리 재측정, 집·지도·보상 재디자인, 치료사 화면 접근성, 운영 준비, 계획→게임, 정리)은 데모와 겹치지 않게 **실험실**에서 한다. 폴더는 `dudu_lab`, 브랜치는 `lab/after-demo`, 계획은 [LAB_PLAN.md](https://github.com/Riddlerio/s_project/blob/lab/after-demo/docs/LAB_PLAN.md)다. 데모가 끝날 때까지 main에 합치지 않는다.

### 0-1. 담당별로 보기

**🤖 Codex가 할 일** — 사용자가 "`docs/CODEX_TASKS.md` N번 이행하고 알려줘"라고 시킨다.

| 차례 | 번호 | 할 일 | 언제 |
|:-:|:-:|---|---|
| 1 | **4번** ✅ | 1번 마무리(박자 설정 '최근 저장' 시각, 동결 계약 기록) + 1·2번 PR 열기 | PR #22 병합 |
| 2 | **5번** ✅ | 치료사 분석 그래프용 집계 API(읽기 전용)와 화면용 타입 | PR #24 병합 |
| 3 | **3번** | 치료사 화면 시연 동선 점검과 작은 수정 | Claude 4단계(PR #25)가 main에 들어간 뒤(다음 차례) |

- 이미 끝낸 것: 1번(시각 오류), 2번(빈 대화). `codex/therapist-fixes` `0c14ae3`에 있고 CI도 통과했다. 4번에서 PR로 연다.
- 지킬 것은 [CODEX_TASKS.md](CODEX_TASKS.md)의 공통 규칙이다: 최신 main에서 시작, `e3c25be`는 손대지 않음, 병합은 merge commit, Claude 담당 파일은 피함.

**🧑‍💻 Claude가 할 일**

| 차례 | 할 일 | 언제 |
|:-:|---|---|
| 1 | 자연스러운 대화 대본 + 새 두두 음성(3단계) ✅ | 10/6 끝. 브랜치 `claude/natural-dialogue`, PR #23 병합 확인 |
| 2 | 치료사 근거 패널 + 분석 그래프 화면 + 전문 정보(4단계) ✅ | 10/6 끝. 브랜치 `claude/therapist-analytics`, PR #25 병합 확인 |
| 3 | 통합 점검·문서(6단계) | Codex 3번 뒤 |
| 4 | 리허설 결과 수정(7단계) | 리허설 때 |
| 5 | 데모 당일 준비 돕기: 체크리스트, 시연 버전 태그(8단계) | 리허설 뒤 |

**🙋 사용자가 할 일**
- Codex에게 번호로 지시하기: 4번 → 5번 → 3번
- PR 병합 확인하기(또는 Claude에게 "PR #N 병합해 줘")
- ~~3단계 녹음 때 VOLI 로그인~~ (10/6 끝)
- 7단계 아이폰 리허설("리허설 할게")
- 8단계 준비: 시연 장소 네트워크 확인과 핫스팟 연습, 백업 영상 녹화
- 포스터·발표 자료 갱신(그 전에 앱 이름 결정), 언어치료 전공자에게 문구 검토 부탁
- 5장의 결정하기

### 0-2. 날짜별 계획(제안)

| 날짜 | Codex | Claude | 사용자 |
|---|---|---|---|
| 10/6 | 4번 → 5번 | 3단계(대화 대본·녹음) | VOLI 로그인, PR 병합 확인 |
| 10/7 | 3번(4단계 뒤) | 4단계(분석 화면) → 6단계 | — |
| 10/8 | 리허설에서 나온 치료사 화면 수정 | 리허설 수정, 시연 버전 태그 | 아이폰 리허설, 핫스팟 연습, 백업 영상 녹화 |
| 10/9 | — | 당일 체크리스트 돕기 | 체크리스트 확인 뒤 시연 |

Claude가 3단계(대화)를 먼저 하는 이유는, 대화가 부자연스럽다는 것이 시험에서 가장 눈에 띈 문제였기 때문이다. 그동안 Codex는 4단계에 쓸 API를 만든다.

---

## 1. 지금 상태

### 브랜치

| 브랜치 | 내용 | 비고 |
|---|---|---|
| `main` | PR #18까지 병합 | 직접 push 금지 |
| `claude/dudu-followup` | Claude 작업 브랜치 | 이 문서도 여기서 올림 |
| `claude/therapist-analytics` | 4단계(근거 패널·빠른 설정·건너기 분석 화면), PR #25 | main `e4ecc12`(PR #24까지)에서 시작 |
| `claude/natural-dialogue` | 3단계(자연스러운 대화 대본·새 두두 음성 7문장), PR #23 | `claude/dudu-followup` `6d9b30a`(PR #21)에서 시작 |
| `codex/therapist-fixes` | Codex 1·2번(`0c14ae3`) | `e3c25be` 기준. CI 통과, **PR 전**. main과 겹치는 파일 없음 |
| `lab/after-demo` | 실험실(데모 뒤로 미룬 일, 폴더 `dudu_lab`) | **데모가 끝날 때까지 main에 합치지 않음** |

### 꼭 지킬 것
- **`e3c25be`는 고치거나 rebase하지 않는다.** Codex 작업이 이 커밋에서 시작했다.
- **main 병합은 merge commit으로 한다.** squash는 쓰지 않는다.
- 병합은 PR과 CI 통과 뒤에만 한다. PR 제목에 "(CI 통과, 실제 기기 미확인)"을 붙인다.
- `backend/.env`, DB 파일, 인증서, 키는 커밋하지 않는다.

### 원래 PC에만 있는 것

다른 기기에서는 새로 만들어야 한다.
- 리허설 DB, 휴대폰용 인증서
- Meshy·VOLI 로그인 창(자동화용 Edge)
- 원래 폴더(`orca/s_project`)의 미커밋 파일
- 옛 Codex 폴더(`codex_therapist_data`). 지금 Codex는 `codex_fixes` 폴더를 쓴다.

---

## 2. 다른 기기에서 시작하기 (Windows · PowerShell)

### 2-1. 준비물
- Git
- Node.js 22, Python 3.14(CI와 같은 버전)
- Edge 또는 Chrome
- 휴대폰으로 시험하려면 OpenSSL. Git for Windows에 들어 있다.

### 2-2. 받기와 설치
```powershell
git clone https://github.com/Riddlerio/s_project.git
cd s_project
git checkout main
npm ci
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
```

### 2-3. 시연 서버 켜기 (PC 화면으로 보기)
```powershell
# ① 시연 DB 만들기(처음 한 번). 저장소 밖 경로를 쓴다.
New-Item -ItemType Directory -Force C:\speechhero | Out-Null
$env:SEED_DEMO_DATA = "true"
backend\.venv\Scripts\python.exe backend\scripts\demo_rehearsal.py provision --database C:\speechhero\rehearsal.db

# ② 백엔드(PowerShell 창 1)
cd backend
$env:SEED_DEMO_DATA = "true"; $env:COOKIE_SECURE = "false"; $env:DATABASE_URL = "sqlite:///C:/speechhero/rehearsal.db"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# ③ 화면(PowerShell 창 2, 저장소 루트)
npm run dev
```
- 브라우저에서 `http://127.0.0.1:5173/play`를 연다.
- **계정**(리허설 DB 전용): 아동 `DEMO-CROSSING`, 치료사 `demo-showcase`. 비밀번호는 둘 다 `speechhero`다.
- **리허설 사이 초기화:** 서버를 끄고 아래를 실행한다. 오늘 기록만 지운다.
  `backend\.venv\Scripts\python.exe backend\scripts\demo_rehearsal.py reset-today --include-mic --database C:\speechhero\rehearsal.db`

### 2-4. 휴대폰(아이폰)으로 시험하기
휴대폰은 `https` 주소에서만 마이크가 켜진다. PC와 휴대폰을 **같은 와이파이**에 연결한다.
```powershell
# ① 자체 서명 인증서(30일). 저장소에 넣지 않는다.
New-Item -ItemType Directory -Force C:\speechhero\cert | Out-Null
& "C:\Program Files\Git\usr\bin\openssl.exe" req -x509 -newkey rsa:2048 -nodes -keyout C:\speechhero\cert\key.pem -out C:\speechhero\cert\cert.pem -days 30 -subj "/CN=speechhero-local"

# ② 2-3의 백엔드를 켠 채로, 저장소 루트에서
node scripts\serve-phone.mjs C:\speechhero\cert

# ③ PC의 IP 확인(IPv4 주소)
ipconfig
```
- 휴대폰에서 `https://<PC의 IP>:5183/play`를 연다.
- 경고가 뜨면 Safari는 `이 웹사이트 방문`, Chrome은 `고급 → 계속`을 누른다.
- Windows 방화벽 창이 뜨면 **개인 네트워크만** 허용한다.
- 시험이 끝나면 서버를 끈다.

### 2-5. 검사 명령 (PR 전에 모두 통과)
```powershell
npm run typecheck; npm test; npm run build
cd backend; New-Item -ItemType Directory -Force test-temp | Out-Null
.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp test-temp/ci
cd ..; git diff --check
```

**마지막 확인값(2026-10-06):** 프런트 319개, 백엔드 541개(4단계 브랜치 `claude/therapist-analytics`, main `e4ecc12` 기준)

---

## 3. 할 일 자세히

### 1단계. Codex 4번 — 1번 마무리 + 1·2번 PR 열기 ✅ (Codex, PR #22)

**이미 한 것(Codex, `codex/therapist-fixes` `0c14ae3`)**
- **시각:** 치료사 화면이 서버 시각을 UTC로 읽어 서울 시각으로 보인다(`src/therapist/formatTime.ts`). 회기 메모의 날짜도 서울 날짜로 만든다.
- **빈 대화:** 대화 없이 끝난 기록(완료 턴 0개, 진행 중 아님)을 치료사 목록에서만 숨긴다. DB는 그대로다. 숨긴 개수는 `hiddenEmptyN`으로 알린다.
- **검사:** 로컬 프런트 290개, 백엔드 485개 통과. CI 통과.

**할 것** — Codex에게 "`docs/CODEX_TASKS.md` 4번 이행하고 알려줘"
1. 최신 main을 이 브랜치에 merge한다(rebase 아님). 겹치는 파일이 없어 충돌은 없을 것이다.
2. 박자 설정 패널의 '최근 저장' 시각도 `formatTime`으로 보인다. 지금은 기기 시간대를 따른다.
3. 동결 계약에 11절(시각 표시·빈 대화)을 기록한다.
4. 상태 표 1·2·4번을 갱신하고, PR을 열고, CI를 확인한다.
5. 사용자가 확인한 뒤 **merge commit**으로 병합한다. Claude에게 맡겨도 된다.
   - CI 잡이 15분 뒤 '취소'로 끝나면 실패가 아니다. 러너를 기다리다 시간이 지난 것이다.
   - 취소된 잡만 다시 돌린다: `gh run rerun <실행 번호> --failed`

참고: CODEX_TASKS 1번의 완료 기준 '서버 응답에 `+00:00`'은 화면 쪽 변환으로 대신 해결됐다. 그대로 둬도 된다.

### 2단계. Codex 5번 — 치료사 분석 그래프용 집계 API ✅ (Codex, PR #24)

Codex에게 "`docs/CODEX_TASKS.md` 5번 이행하고 알려줘"라고 시킨다.

**경로:** `GET /api/therapist/children/{id}/crossing-analytics` (읽기 전용)

**주는 자료**
- 회기별 정반응률(치료사가 확인한 기록만)
- 음절·낱말별 결과
- 자동 추정 이유(바람 소리 없음·짧음·모음 없음)
- 그 회기의 시작 박자
- 숙달 여부(80%, 연속 3회기)

응답 형식과 완료 기준은 CODEX_TASKS 5번에 있다. 3단계(Claude)와 동시에 하고, 4단계 화면이 이 API를 쓴다.

### 3단계. 자연스러운 대화 대본 + 새 두두 음성 ✅ (Claude, 10/6, PR #23)

**한 것(브랜치 `claude/natural-dialogue`)**
- **녹음:** 계획의 7문장(아래 접힌 표)을 VOLI '하람'(VOLI 3, 음정 0, 속도 90%)으로 만들었다. 88자를 써서 **남은 글자는 13자**다.
  - 파일 `q_lesson`·`q_player`·`q_color`·`q_seesaw`·`q_fruit`·`q_play`·`q_sound`(16kHz 모노, 앞뒤 무음 정리). 입 모양 값도 다시 만들었다.
  - 자세한 과정: [음성 기록](handoff/DUDU_VOICE_VOLI_2026-10-05.md) 3-2절
- **대본(`demo_provider.py`):**
  - 첫 인사 끝에 "오늘 뭐 하고 놀았어?"를 붙였다.
  - 아이 말의 주제에 반응한 뒤 그 주제에서 /ㅅ/ 낱말이 나오기 쉬운 질문을 한다. 최근 3번 안에 한 질문은 다시 하지 않고, 같은 주제 반응도 연달아 하지 않는다.
  - 이번 말과 바로 앞 말에 /ㅅ/가 없을 때만 4턴째부터 돕는다. 같은 낱말로 고르기 → 빈칸 → 먼저 들려주기(치료사 허용 시) 순서다.
  - 첫 3턴에는 서버가 ALLOWED_CUE를 줄 때 먼저 들려주기만 한 번 한다.
  - 예: "놀이터에서 놀았어" → "놀이터에서 놀았구나! 시소도 탔어?", "사과" → "맞아, 사과! 제일 좋아하는 과일은 뭐야?"
- **확인:**
  - 테스트: 첫 3턴에 고르기·빈칸 없음(서버 API로 6가지 대화), 돕는 순서, 질문 반복 없음, 모든 문장의 음성 파일(최근 대화 갈래까지 205가지 답).
  - 실제 화면(390px, DEMO 대화): 첫 인사 4문장과 새 질문이 모두 녹음 파일로 재생됐다. 4턴째에 그림 고르기가 나왔고 가로 넘침은 없었다.
- **바뀌지 않은 것:** 제공자 이름(DEMO)·응답 형식, 게임 전환 규칙(10번·120초 / 300초), 무발화 3번·불확실 2번의 그림 고르기(정책 SIMPLIFY라 첫 3턴에도 나올 수 있음)
- **아직 안 한 것:** 새 녹음을 사람 귀로 듣기, 실제 마이크·아이폰 대화. 7단계 리허설 때 한다.

<details><summary>처음 계획(10/6 아침)</summary>


**왜:** 아이폰 시험에서 대화가 부자연스러웠다. 지금 대본은 /ㅅ/ 낱말을 매번 고르기·빈칸 질문으로 직접 묻는다("사과가 좋아, 수박이 좋아?").

**바꿀 흐름**
1. 두두 인사 → "오늘 뭐 하고 놀았어?" (녹음 있음)
2. 아이가 말한 주제를 받아 준다. 예: "놀이터에서 놀았구나!" (녹음 있음)
3. 그 주제에서 /ㅅ/ 낱말이 나오기 쉬운 질문을 한다. 예: "시소도 탔어?", "제일 좋아하는 과일은 뭐야?" (**녹음 없음 → 새로 만듦**)
4. 목표 낱말이 두 번 연달아 안 나오면 그때 돕는다: 고르기·빈칸·먼저 들려주기 (녹음 있음)
5. 약 10번·5분 뒤 게임 안내 (그대로)

**새로 녹음할 문장**(이미 `demo_provider.py`의 주제 질문에 있다)

| 문장 | 글자 수(공백 포함) |
|---|:-:|
| 오늘 선생님이랑 어떤 수업 했어? | 18 |
| 같이 뛴 선수가 있었어? | 13 |
| 무슨 색으로 했어? | 10 |
| 시소도 탔어? | 7 |
| 제일 좋아하는 과일은 뭐야? | 15 |
| 같이 무슨 놀이 했어? | 12 |
| 그때 무슨 소리가 났어? | 13 |
| **합계** | **88** (VOLI 남은 101자 안) |

**필요한 것**
- 사용자가 VOLI에 로그인한다. 목소리는 '하람'이다.
- 받은 파일을 다음에 넣는다: `public/assets/voice/dudu/`, `shared/dudu_voice_lines.json`, 입 모양 자료(`node scripts/build-voice-envelopes.mjs`)

**지킬 것**
- DEMO 대본은 휴리스틱이다. `HEURISTIC_REGISTER.md` 9절을 갱신한다.
- 제공자 이름과 응답 형식은 그대로 둔다(동결 계약).
- TARGET_OBSERVED는 '목표 낱말이 든 시도'일 뿐 발음 정확도가 아니다.

**완료 기준**
- 첫 3턴에 고르기·빈칸 질문이 나오지 않는다.
- 모든 문장이 녹음 파일로 재생된다(`backend/tests/test_dudu_voice_lines.py` 통과).
- 게임 전환 규칙(10번·120초 / 300초)은 그대로다.

</details>

### 4단계. 치료사 근거 패널 + 분석 그래프 + 전문 정보 ✅ (Claude, 10/6, PR #25)

**한 것(브랜치 `claude/therapist-analytics`)**
- **'치료 목표' 탭**
  - 설계 근거 패널: 왜 /ㅅ/, 누구를 위한 연습(주의할 대상 포함), 5라운드 구성(목표 단계에 맞춘 낱말), 조절 값, 박자를 쓰는 이유, 자동 판정이 가르는 것·못 가르는 것, 한계
  - 박자 설정의 대상별 빠른 설정 5개: 근거 문서 2절 권장값. 누르면 값만 채우고, 저장은 치료사가 '설정 저장'으로 한다
- **'경과 · 기록' 탭 맨 위 '대구대 건너기 분석'(Codex 5번 API, 새 라이브러리 없이 SVG):**
  - 요약 카드: 실제 회기 수, 최근 확인 비율, 숙달 표시(서버 값), 최근 시작 박자
  - 확인 비율 추이와 숙달선 80%, 숙달 판단 범위(최근 실제 3회기)를 표시한다. DEMO·샘플 회기는 자리만 보이고 비율을 그리지 않는다
  - 단계 × 위치 표: 어두만 집계하고 어중·어말은 '다루지 않음'으로 적는다(API 설계)
  - 오류 유형 막대(자동 추정·의심)와 고른 회기의 치료사 확인 수
  - 시작 박자 그래프: 끝 박자는 저장하지 않는 설계라 시작 박자만 보인다
  - 회기별 수치 표
- **전문 정보**
  - /ㅅ/ 발달 시기(출처 링크)
  - 흔한 오류와 자동 추정의 대응
  - 단서: 앱의 단서 종류와 게임의 단서 줄이기
  - 다음 회기 제안: 버튼으로 서버 계산을 불러온다
  - 가정 연습 안내·회기 기록(SOAP) 초안: 고쳐서 복사한다(LLM 미사용)
- **확인**
  - 프런트 테스트 319개(새 20개)
  - 1280px·390px × (실제 서버 자료·시연 상태·예시 자료) × 두 탭 = 14화면에서 axe-core 4.14(WCAG 2.2 A/AA + best-practice) 위반 0, 가로 넘침 0. 접힌 내용을 펼친 상태도 확인했다
  - 이때 원래 있던 작업 공간 탭 글자색의 대비 부족(약 3.9:1)을 토큰 `--muted`(약 4.9:1)로 고쳤다
- **계획과 다르게 한 것**
  - 분석은 새 탭 대신 '경과 · 기록' 탭 맨 위에 넣었다. 작업 공간 4영역 구조(테스트로 고정)를 지키기 위해서다
  - '단서 순서(들려주기 → 보기 → 만지기 → 혼자)'는 저장소에 출처가 없어 순위로 보이지 않는다. 앱의 단서 종류와 게임의 실제 단서 줄이기(1라운드 시범 → 2라운드 시범 없음 → 4라운드 그림)로 보인다. 언어치료 전공자 검토가 필요하다
- **시연에서 알 것:** 시연 아동(DEMO-CROSSING)은 샘플 자료라 확인 비율·숙달 계산에서 빠진다. 그래서 비율 선은 비어 있고, 자동 추정 막대·박자·전문 정보만 보인다(규칙대로)
- **아직 안 한 것:** 실제 치료사 사용성, 실제 기기(아이폰·태블릿) 확인

<details><summary>처음 계획(10/6 아침)</summary>


**사용자 요청(10/6):** "언어치료사가 데이터를 분석할 때 효율적으로 볼 수 있게 그래프나 그림으로, 전문 지식과 센터 현실에 필요한 것을 깔끔하게."

**화면 구성(초안)**
1. **근거 패널:** 왜 /ㅅ/와 이 낱말인지, 어떤 아동이 대상인지, 무슨 치료인지 보여 준다(`shared/daegu_crossing_rationale.json`). 같은 데이터의 '조절 값'(시작 박자·빨라지기)은 빠른 설정 버튼으로 둔다.
2. **추이 그래프:** 회기별 정반응률(치료사가 확인한 기록만)과 숙달선(예: 80%, 연속 3회기)
3. **수준 × 위치 표:** 음절·낱말 × 어두·어중·어말 정확도. 다음 단계로 올릴지 판단할 때 쓴다.
4. **오류 유형 막대:** 바람 소리 없음(파열음화 의심), 짧음(파찰음화 의심), 모음 없음. 자동 추정이라 '의심'으로 표시하고, 치료사가 확인한 수를 같이 보인다.
5. **박자 변화:** 회기 안에서 시작 BPM → 끝 BPM
6. **전문 정보:** /ㅅ/ 발달 시기, 흔한 오류 유형, 단서 순서(들려주기 → 보기 → 만지기 → 혼자), 다음 회기 제안(서버 계산), 가정 연습 문구, 회기 기록(SOAP) 초안 복사

**만드는 방법**
- 새 라이브러리 없이 SVG로 그린다.
- 새 파일 위주로 만든다(`src/therapist/analytics/…`).
- 자료는 2단계(Codex 5번)의 `crossing-analytics` API를 쓴다.

**지킬 것**
- 회기 간 변화는 치료 효과의 증명이 아니다(화면 문구에도 쓴다).
- DEMO 자료는 임상 비교에서 뺀다.

**완료 기준:** 1280px·390px에서 넘침이 없고, axe 위반이 0이며, 테스트가 통과한다.

</details>

### 5단계. Codex 3번 — 치료사 화면 시연 동선 점검 ⬜ (Codex)
[CODEX_TASKS.md](CODEX_TASKS.md) 3번 그대로다. 4단계가 main에 들어간 뒤 Codex에게 "3번 이행하고 알려줘"라고 한다.

### 6단계. 통합 점검·문서 ⬜ (Claude)
- 휴대폰 폭으로 전체 흐름을 자동 점검한다: 로그인 → 대화 → 건너기 10줄 → 마무리 → 치료사 기록
- 공용 문서(README·ROADMAP·DEMO_RUNSHEET)를 갱신하고 리허설 DB를 새로 만든다.

### 7단계. 아이폰 리허설 ⬜ (사용자 + Claude, "리허설 할게"라고 하면 시작)
- [DEMO_RUNSHEET](handoff/DEMO_RUNSHEET_2026-10-05.md) 5절의 확인 목록을 따른다.
- **이번에 꼭 볼 것**
  - '사과'·'차과'·'다과'를 5번씩 말한다. 바른 소리는 통과하고 틀린 소리는 걸러지는지 본다(10/6 기준을 60ms로 낮춤).
  - 틀렸을 때 입 모양 도움말이 잘 보이는지 본다.
  - 배경이 확대되거나 끊기지 않는지 본다.
- 결과에 따라 기준을 조금 맞추고 마지막 PR을 올린다.

### 8단계. 데모 당일 준비 ⬜ (사용자 + Claude)

**꼭 필요(당일 실패 막기)**
1. **시연 장소 네트워크:** 공용 와이파이는 기기끼리 연결을 막아 두는 경우가 많다. 그러면 아이폰이 노트북 서버에 접속하지 못한다.
   - 노트북이나 휴대폰 핫스팟으로 연결하는 연습을 미리 한다.
   - 대화 말 인식(브라우저 음성 인식)에 인터넷이 필요할 수 있으니, 핫스팟도 인터넷이 되는지 확인한다.
2. **백업 영상:** 리허설 때 전체 흐름을 아이폰 화면 녹화로 남긴다. 현장에서 마이크·네트워크가 안 되면 영상으로 대신한다.
3. **당일 체크리스트:** 시연 진행표 1절에 아래를 더해 확인한다.
   - 기기 충전, 방해 금지 모드
   - 볼륨, 마이크 권한
   - 리허설 DB 초기화(`reset-today --include-mic`)
   - 탭 미리 열어 두기
   - 핫스팟 연결, 'DEMO로 시작' 예비 방법
4. **시연 버전 고정:** 리허설 수정이 끝난 main에 태그를 붙이고, 당일에는 그 버전으로 실행한다.
   ```powershell
   git tag -a demo-2026-10-09 -m "10/9 시연 버전"; git push origin demo-2026-10-09
   git checkout demo-2026-10-09    # 시연 PC에서
   ```

**하는 게 좋음(발표 품질)**
5. **포스터·발표 자료 갱신:** `docs/poster/`의 검토본은 10/3 버전이다. 리듬게임, 3D 두두, 치료사 분석 화면, 임상 근거를 넣는다. 그 전에 앱 이름('Speech Hero' 중복)을 정한다.
6. **언어치료 전공자 검토:** 두두 대사, 틀렸을 때 도움말, 치료사 화면 문구를 검토받는다.
7. **발표 대본:** 시연 진행표의 '발표자가 말할 것'을 최종 흐름에 맞게 고친다. 6단계에서 함께 한다.

**알고 있을 것**
- VOLI 남은 글자는 13자다(3단계 뒤 확인). 새 녹음이 더 필요하면 유료 충전이 필요하다(사용자 결정).
- 원래 PC에만 있는 Meshy 원본(`assets/dudu3d/meshy_output`, git 제외)과 VOLI 원본 음성은 앱 실행에는 필요 없다. 다시 만들 때만 필요하니 필요하면 따로 백업한다.

---

## 4. 로컬 음성 대화 모델 조사 요약 (2026-10-06)

> 실험은 데모와 겹치지 않게 실험실에서 한다([LAB_PLAN.md](https://github.com/Riddlerio/s_project/blob/lab/after-demo/docs/LAB_PLAN.md) ①·②).

조사 기준 PC는 RTX 3070 Ti 8GB, RAM 32GB다.

**결론**
- **한 번에 처리하는 모델:** 한국어로 듣고 바로 말하는 공개 모델은 Qwen3-Omni(30B)뿐이다. 이 PC에서는 돌릴 수 없고, 목소리도 어른 목소리다. 카카오 Kanana-o는 API로만 공개돼 있다.
- **현실적인 구성:** 듣기(Whisper) → 생각(EXAONE 3.5 7.8B / Kanana 1.5 8B, Ollama) → 말하기(MeloTTS). 셋 다 8GB에 들어간다.
- **한계:** 모델을 붙여도 바로 매끈해지지는 않는다.
  - 병목은 아이 말 인식, 응답 지연(약 1.5~3초로 추정, 실측 아님), 두두 목소리 일관성이다.
  - LLM 답은 매번 새 문장이라 녹음 음성을 쓸 수 없다.
- **10/9 데모:** 로컬 모델을 본편에 넣는 것은 추천하지 않는다. 3단계 대본 개선이 효과가 크다.

| 역할 | 1순위 | 대안 | 주의 |
|---|---|---|---|
| 생각(LLM) | EXAONE 3.5 7.8B (Ollama 공식, 4.8GB) | Kanana 1.5 8B (Apache 2.0), Qwen3 8B | EXAONE은 비상업 라이선스로 알려짐(원문 확인 필요) |
| 듣기(ASR) | Whisper large-v3-turbo | SenseVoice | 아동 말 오류가 많다. 한국어 4~7세 공개 수치는 미확인 |
| 말하기(TTS) | MeloTTS (MIT, CPU 실시간) | Supertonic(OpenRAIL-M, 2026-07 저장소 보관), CosyVoice 3 0.5B(Apache) | 두두(VOLI '하람')와 다른 목소리 |

**LoRA 미세조정**
- **이 PC에서:** 가능하다. Unsloth 기준 4비트 학습 최소 메모리는 8B 6GB, 3B 3.5GB다.
- **익히는 것:** 짧게 말하기, 질문 하나, 아이 눈높이, 주제를 따라가며 목표 낱말이 나오게 하기.
- **못 하는 것:** 임상 판단, 안전 보장, 발음 판정. 그래서 서버 정책과 검증기는 그대로 둔다.
- **필요한 데이터:** 언어치료사가 쓰거나 검수한 대화. 목표 소리별로 수백~수천 턴이 필요하다.
- **주의:** VOLI 무료 약관에는 생성 음성으로 다른 모델을 학습해도 된다는 근거가 없다. 무단 복제·저장 방식도 금지한다(9.5절). 두두 목소리를 복제 학습하지 않는다.

**인용수**(Semantic Scholar, 2026-10-06 조회)

| 논문 | 연도 | 인용 |
|---|:-:|:-:|
| LoRA | 2021 | 23,827 |
| Whisper | 2022 | 8,808 |
| Qwen3 | 2025 | 8,695 |
| QLoRA | 2023 | 5,841 |
| Gemma 3 | 2025 | 1,955 |
| VITS(MeloTTS의 바탕) | 2021 | 1,434 |
| Qwen2.5-Omni | 2025 | 861 |
| Moshi(영어 전용) | 2024 | 802 |
| Qwen3-Omni | 2025 | 547 |
| CosyVoice 2 / 3 | 2024 / 2025 | 478 / 251 |
| Qwen3.5-Omni | 2026 | 158 |
| EXAONE 3.5 / 4.0 | 2024 / 2025 | 64 / 30 |
| Kid-Whisper(아동 음성 인식) | 2023 | 58 |
| Kanana | 2025 | 25 |
| SLP와 맞춘 멀티모달 LLM | 2025 | 0 |
| TalBot(미취학 언어중재 로봇) | 2025 | 1 |

언어치료 전용 한국어 모델은 찾지 못했다. 관련 연구는 아직 초기(인용 0~1)라 **치료사가 확인하는 구조**가 맞다.

**출처**
- 모델: [Qwen3-Omni 모델 카드](https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct), [Kanana-o API 문서](https://huggingface.co/kakaocorp/Kanana-1.5-o-9.8B-instruct-2602-API_Doc), [Kanana 1.5 8B](https://huggingface.co/kakaocorp/kanana-1.5-8b-instruct-2505), [Ollama EXAONE 3.5](https://ollama.com/library/exaone3.5)
- 음성 합성: [한국어 로컬 TTS 목록](https://github.com/HeeJayC/Awesome-Korean-TTS-Local-), [Supertonic](https://github.com/supertone-inc/supertonic)
- 학습·약관: [Unsloth 요구 사항](https://unsloth.ai/docs/get-started/fine-tuning-for-beginners/unsloth-requirements.md), [VOLI 약관](https://voli.ai/en/terms/service)
- 연구: [Kid-Whisper](https://ojs.aaai.org/index.php/AIES/article/download/31618/33785/35682), [SLP 정렬 멀티모달 LLM](https://arxiv.org/html/2506.05879v1), [TalBot](https://arxiv.org/pdf/2509.22287)

---

## 5. 사용자가 정할 것

- [ ] Claude의 3단계(대화)와 4단계(치료사 분석) 순서. 지금은 대화 먼저로 잡았다.
- [ ] 앱 이름 'Speech Hero' 중복 확인: 미국 실어증 앱과 이름이 같다. 포스터 전에 정한다([DECISIONS_PENDING](DECISIONS_PENDING.md)).
- [ ] 원래 폴더 안 옛 복제본 `s_project/`를 지울지. Orca 앱 기록이 이 폴더를 가리킨다.
- [ ] 옛 Codex 폴더 `codex_therapist_data`를 지울지. 작업은 이미 main에 들어갔다.
- [ ] 데모 뒤 실험실에서 할 실험 순서(LAB_PLAN ①~⑧)

---

## 6. 같이 보는 문서

| 문서 | 내용 |
|---|---|
| [WORK_HISTORY.md](WORK_HISTORY.md) | 9/27~10/6에 한 일과 중요한 결정 |
| [CODEX_TASKS.md](CODEX_TASKS.md) | Codex에게 번호로 시키는 일과 공통 규칙 |
| [DEMO_RUNSHEET](handoff/DEMO_RUNSHEET_2026-10-05.md) | 시연 순서, 계정, 리허설 확인 목록 |
| [MIC_MEASUREMENT](handoff/MIC_MEASUREMENT_2026-10-05.md) | 판정 기준과 근거(6절에 10/6 조정) |
| [건너기 설계 근거](clinical/DAEGU_CROSSING_RATIONALE_2026-10-05.md) | 왜 /ㅅ/, 누구를 위한 치료인지 |
| [동결 계약](audit/FROZEN_CORE_CONTRACT.md) | 바꾸기 전에 승인이 필요한 곳 |

---

## 7. 명령어 모음 (복사해서 쓰기)

### Codex에게 (순서대로)

**① 4번 — 지금**
```
docs/CODEX_TASKS.md 4번 이행하고 알려줘.
- 작업 위치는 기존 작업 폴더 codex_fixes, 브랜치 codex/therapist-fixes야. 새 브랜치는 만들지 마.
- 시작 전에 main의 CODEX_TASKS.md 상태 표를 다시 확인해.
- 최신 main은 merge로만 가져와(git fetch origin; git merge origin/main). rebase는 하지 말고, e3c25be는 그대로 둬.
- 할 일: 박자 설정 패널 '최근 저장' 시각에 formatTime 적용, FROZEN_CORE_CONTRACT.md 11절 기록, 상태 표 1·2·4번 갱신, 전체 검사, push, main으로 PR 열기.
- 병합은 하지 마. PR 번호, CI 결과, 검사 개수를 공통 규칙 8번 형식으로 보고해.
```

**② 5번 — 4번 PR을 연 뒤(병합 전이어도 됨)**
```
docs/CODEX_TASKS.md 5번 이행하고 알려줘.
- 최신 main에서 새 작업 폴더와 새 브랜치 codex/crossing-analytics를 만들어. 4번이 아직 병합 전이면 PR 설명에 그렇게 적어.
- GET /api/therapist/children/{child_id}/crossing-analytics(읽기 전용, owned_child 검사)와 src/api/therapist.ts의 타입·함수를 만들어.
- 새 표나 열은 만들지 마. DEMO는 비율에서 빼고, 확인 기록이 없으면 confirmedRate는 null로 둬. 숙달 기준(80%·연속 3회기)은 HEURISTIC_REGISTER에 등록해.
- src/therapist/analytics/**와 Claude 담당 파일은 건드리지 마.
- 전체 검사, push, PR 열기까지 하고, 병합하지 말고 보고해.
```

**③ 3번 — Claude 4단계(치료사 분석 화면)가 main에 병합된 뒤**
```
docs/CODEX_TASKS.md 3번 이행하고 알려줘.
- 최신 main에서 새 브랜치 codex/therapist-walkthrough를 만들어.
- 시연 DB를 새로 만든 뒤 demo-showcase로 로그인해서, 1280px와 390px 폭으로 치료사 화면 동선을 점검해.
- src/therapist/**의 작은 수정만 하고, 큰 변경은 보고만 해.
- 브라우저로 확인하지 못했으면 '브라우저 확인 미실행'으로 적어.
- PR을 열고, 병합하지 말고 보고해.
```

### Claude에게 (이 대화 또는 다른 기기의 새 대화)

| 언제 | 보낼 말 |
|---|---|
| 지금(3단계) | `docs/NEXT_STEPS.md를 읽고 3단계(자연스러운 대화 대본 + 새 두두 음성)를 진행해 줘. VOLI 로그인이 필요하면 로그인 창을 띄워 줘.` |
| Codex 5번 PR 병합 뒤(4단계) | `Codex 5번 PR이 병합됐어. docs/NEXT_STEPS.md 4단계(치료사 근거 패널 + 분석 그래프 화면 + 전문 정보)를 진행해 줘.` |
| Codex 3번 뒤(6단계) | `docs/NEXT_STEPS.md 6단계(통합 점검·문서)를 진행해 줘.` |
| 아이폰 준비됐을 때(7단계) | `리허설 할게` |
| 리허설 뒤(8단계) | `docs/NEXT_STEPS.md 8단계(데모 당일 준비)를 도와줘.` |
| PR 병합을 맡길 때 | `PR #번호 CI 확인하고 merge commit으로 병합해 줘.` |
| 실험실 작업(데모 뒤) | `lab/after-demo 브랜치의 docs/LAB_PLAN.md ①번 실험을 dudu_lab 폴더에서 진행해 줘.` |

### 직접 PR을 병합할 때 (PowerShell)
```powershell
gh pr checks <PR번호>                    # CI 결과 확인
gh pr merge <PR번호> --merge             # merge commit으로 병합(squash 금지)
gh run rerun <실행번호> --failed          # 15분 뒤 '취소'로 끝난 잡만 다시 실행
```
