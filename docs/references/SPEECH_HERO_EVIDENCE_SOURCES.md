# Speech Hero 연구·임상 근거 출처 정리

기준일: 2026-09-30  
용도: 졸업작품 제안서, 발표자료, 시스템 설계, 치료사 화면 설계 근거 정리

> 이 문서는 Speech Hero를 설계하면서 중요하게 사용한 근거와 참고할 만한 출처를 한곳에 모은 것이다.  
> 논문 결과를 그대로 제품의 효과로 주장하지 않고, **왜 이런 구조로 설계했는지 설명하는 근거**로 사용하는 것을 원칙으로 한다.

---

## 1. 가장 중요한 핵심 출처

### 1-1. ASHA — Speech Sound Disorders: Articulation and Phonology

- 출처: American Speech-Language-Hearing Association (ASHA)
- 링크: https://www.asha.org/practice-portal/clinical-topics/articulation-and-phonology/
- 핵심 내용:
  - 말소리장애 치료는 크게 **목표음 확립(establishment) → 일반화(generalization) → 유지(maintenance)** 과정으로 설명된다.
  - 일반화는 **음절 → 단어 → 구/문장 → 대화**처럼 점차 실제 발화 상황으로 확장할 수 있다.
  - 목표 선택과 치료 방법은 아동의 특성, 오류 양상, 자극 가능성 등에 따라 개별화해야 한다.
- Speech Hero에서 중요한 이유:
  - `소리/음절 → 단어 → 문장 → 대화` 단계 구조의 가장 중요한 임상 근거다.
  - 한 번 정한 난이도를 모든 아동에게 똑같이 적용하기보다, **아동별 목표와 수행에 따라 단계와 단서를 조정**해야 한다는 근거가 된다.
  - AI가 치료법을 마음대로 정하는 구조보다 **언어치료사가 목표를 정하고 시스템이 실행을 보조하는 구조**가 더 적절하다.
- 주의:
  - Speech Hero가 ASHA 치료 프로토콜을 그대로 구현했다고 표현하면 안 된다.
  - “ASHA의 치료 방향과 일치하도록 설계했다” 정도가 안전하다.

---

### 1-2. ASHA — Documentation in Health Care

- 출처: ASHA
- 링크: https://www.asha.org/Practice-Portal/Professional-Issues/Documentation-in-Health-Care/
- 핵심 내용:
  - 임상 기록은 단순 점수가 아니라 **치료 목표, 실제 수행, 치료사가 제공한 단서·도움 수준, 진행 상황, 다음 계획** 등을 포함해야 한다.
  - 치료계획은 평가 후 수립되며 치료 진행에 따라 수정될 수 있다.
  - SOAP 형식이 흔히 사용되지만 ASHA가 하나의 고정 형식만 강제하는 것은 아니다.
  - 치료 기록에는 객관적인 수행 자료와 이전 회기 대비 변화, 치료사가 제공한 skilled intervention이 포함될 수 있다.
- Speech Hero에서 중요한 이유:
  - 치료사 화면을 “AI 점수판”으로 만들면 안 되는 이유다.
  - 치료사는 최소한 다음을 볼 수 있어야 한다.
    - 무엇을 목표로 했는가
    - 무엇을 실제로 했는가
    - 몇 번 시도했는가
    - 어떤 단서를 사용했는가
    - 독립/모방 발화였는가
    - 이전 회기와 비교해 어떻게 달라졌는가
    - 다음 회기에서 무엇을 할 것인가
  - `ClinicalObservation → Therapist Verification → 다음 회기 계획` 구조의 근거로 사용하기 좋다.

---

### 1-3. 충남대학교 언어치료센터 — 실제 서비스 과정

- 출처: 충남대학교 부속기관 언어치료센터
- 링크: https://slpcenter.cnu.ac.kr/speechtherapy/used/service02.do
- 핵심 내용:
  - 공개된 치료·교육 프로그램 흐름은 다음과 같다.
  - **초기상담 및 선별검사 → 진단평가 → 개인·그룹 중재 → 치료진전 평가 및 보고 → 부모교육**
- Speech Hero에서 중요한 이유:
  - 실제 기관의 치료 서비스가 “게임 한 번 → 점수” 구조가 아니라는 것을 보여준다.
  - Speech Hero도 전체 진단 시스템을 만들기보다 **전문가가 평가와 목표 설정을 한 이후, 치료 수행·기록·경과 확인을 보조하는 위치**에 두는 것이 자연스럽다.
- 설계에 적용:
  - Speech Hero 시작 지점:
    - 실제 평가/진단 완료
    - 언어치료사가 치료 목표 설정
    - Speech Hero에서 회기 계획 및 수행 지원

---

### 1-4. 대구대학교 언어치료학과 — Case Conference 및 언어임상센터

- 출처: 대구대학교 언어치료학과
- 링크: https://daeguslp.daegu.ac.kr/article/table_44/detail/70674?pageIndex=1
- 핵심 내용:
  - 대구대학교 언어치료학과는 언어임상센터에서 학생 치료사들의 **언어평가·치료 실습 사례**를 다룬다.
  - Case Conference에서 실제 사례 공유, 치료 경험, 접근 방법의 근거 적합성 등을 평가한다.
- Speech Hero에서 중요한 이유:
  - 이 프로젝트가 대구대학교에서 진행되는 만큼 가장 직접적인 지역·학과 연계 근거 중 하나다.
  - 단순히 “게임을 만들었다”보다 **치료 목표 → 활동 → 관찰 → 결과 검토라는 실제 임상 사고 과정**을 반영해야 한다는 근거가 된다.
- 제안서에서 활용:
  - 대구대학교의 언어치료 교육·임상 환경과 AI학과의 기술을 연결하는 프로젝트라는 설명에 사용할 수 있다.

---

## 2. 치료 빈도·반복 연습량과 관련된 근거

### 2-1. Allen, 2013 — Intervention efficacy and intensity for children with speech sound disorder

- 논문:
  - Melissa M. Allen
  - *Intervention efficacy and intensity for children with speech sound disorder*
  - Journal of Speech, Language, and Hearing Research, 2013
- 링크: https://pubmed.ncbi.nlm.nih.gov/23275415/
- DOI: 10.1044/1092-4388(2012/11-0076)
- 대상:
  - 말소리장애가 있는 취학 전 아동 54명
- 핵심:
  - multiple oppositions 중재를 **주 3회 × 8주** 받은 집단과 **주 1회 × 24주** 받은 집단 등을 비교했다.
  - 연구 조건에서는 더 높은 치료 빈도의 집단이 더 큰 음운 향상을 보였다.
- Speech Hero에서 중요한 이유:
  - 말소리 치료에서 **연습 빈도와 치료 강도**가 중요할 수 있다는 근거다.
  - 반복 연습 자체를 없애는 것이 아니라, 반복을 아동이 참여하기 쉬운 대화·게임 안에 넣는 방향의 근거로 활용할 수 있다.
- 주의:
  - “주 3회가 모든 아동에게 무조건 최적이다”라고 말하면 안 된다.
  - 특정 치료법과 연구 조건에서 나온 결과다.

---

### 2-2. McFaul et al., 2022 — 실제 임상 서비스에서 치료 강도를 높인 품질개선 연구

- 논문:
  - *Applying evidence to practice by increasing intensity of intervention for children with severe speech sound disorder: a quality improvement project*
- 링크: https://pmc.ncbi.nlm.nih.gov/articles/PMC9096566/
- 핵심:
  - 실제 지역사회 언어치료 서비스에서 중증 말소리장애 아동의 연습량과 치료 빈도를 높이는 품질개선 프로젝트를 시행했다.
  - 기존에는 회기당 약 30회의 목표 산출이 흔했으나, 프로젝트에서는 더 높은 목표 산출량을 적용했다.
  - 치료 강도를 높이는 것이 실제 서비스에서는 일정, 피로, 결석 등 여러 현실적 요인의 영향을 받는다는 점도 확인했다.
- Speech Hero에서 중요한 이유:
  - `repetition_target`을 단순 숫자가 아니라 **치료사가 조절하는 목표 시도 횟수**로 두는 것이 적절하다.
  - 계획 횟수와 실제 시도 횟수를 분리해야 한다.
- 권장 데이터 구분:
  - plannedTrials
  - attemptedTrials
  - evaluableTrials
  - success/retry
  - uncertain
  - noSpeech
- 주의:
  - 논문에서 제시된 70회 이상 등의 수치를 Speech Hero 모든 아동의 고정 기준으로 사용하면 안 된다.

---

## 3. 게임·디지털 치료에 대한 근거

### 3-1. Saeedi et al., 2022 — 아동 언어치료 디지털 게임 체계적 문헌고찰

- 논문:
  - *Application of Digital Games for Speech Therapy in Children: A Systematic Review of Features and Challenges*
- 링크: https://pmc.ncbi.nlm.nih.gov/articles/PMC9061057/
- 포함 연구: 27편
- 핵심:
  - 디지털 게임이 치료 중 아동의 **만족도, 동기, 주의집중**을 지원할 가능성이 보고됐다.
  - 동시에 중요한 문제도 확인됐다.
    - 반복 실패로 인한 좌절
    - 낮은 자기효능감
    - 주변 소음
    - 게임 난이도와 아동 수준의 불일치
    - 음성인식 오류
- Speech Hero에서 중요한 이유:
  - “치료를 게임으로 바꾸면 무조건 좋아진다”는 주장이 아니라,
    **반복 훈련의 참여를 지원하는 도구로 게임을 사용한다**는 근거가 된다.
  - 다음 설계의 직접적인 근거다.
    - 난이도 조절
    - UNCERTAIN / NO_SPEECH를 실패로 취급하지 않음
    - 음성인식 오류와 실제 발음 문제를 구분
    - 치료사 검토
- 제안서 표현:
  - “게임 기반 활동이 아동의 동기와 주의집중 유지에 긍정적인 가능성을 보인 것으로 보고되었다.”
  - “집중력이 향상된다”처럼 확정적으로 쓰지 않는다.

---

### 3-2. 2019 대구대학교 특수교육재활과학연구소 — 증강현실 중재 연구

- 논문:
  - 이창윤, 박희준, 김근효, 권순복
  - 「증강현실을 이용한 중재가 조음음운장애 아동의 조음정확도 개선에 미치는 효과」
  - 특수교육재활과학연구 58(1), 171–185, 2019
- 발행기관: 대구대학교 특수교육재활과학연구소
- 링크: https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002449969
- DOI: 10.23944/Jsers.2019.03.58.1.8
- 대상:
  - 4~7세 조음음운장애 아동 10명
- 핵심:
  - 두 집단 모두 조음점 지시법과 짝자극 기법을 사용했고, 한 집단에 증강현실을 추가했다.
  - 중재 후 두 집단 모두 단어·문장 수준 조음정확도가 유의하게 향상됐다.
  - 증강현실 집단의 치료 횟수와 기간이 더 짧은 경향이 있었지만 **통계적으로 유의하지 않았다.**
- Speech Hero에서 중요한 이유:
  - 프로젝트 대상 연령(4~7세)과 직접적으로 가까운 국내 연구다.
  - 대구대학교 연구소에서 발표된 연구라는 점도 프로젝트와 연결성이 높다.
  - 정적인 반복 훈련만이 아니라 동적·상호작용 자극을 치료 활동에 활용할 가능성을 보여준다.
- 주의:
  - 이 연구만으로 “게임이 치료 기간을 단축한다”고 주장하면 안 된다.
  - 표본이 10명이고 AR 집단의 기간·횟수 차이는 통계적으로 유의하지 않았다.

---

### 3-3. Kim et al., 2023 — 국내 아동 대상 홈 기반 Serious Game 임상시험

- 논문:
  - *Effect of Voice and Articulation Parameters of a Home-Based Serious Game for Speech Therapy in Children With Articulation Disorder: Prospective Single-Arm Clinical Trial*
- 링크: https://games.jmir.org/2023/1/e49216
- DOI: 10.2196/49216
- 기관:
  - 전북대학교 의과대학/병원, 전북대학교 언어치료 관련 전공, POSTECH 연구진
- 대상:
  - 4~10세 조음장애 아동 13명
- 방법:
  - 4주간 가정에서 하루 30분 이상, 주 5회 이상, 총 20회 훈련
  - Smart Speech 프로그램에서 구강운동, 호흡, 음성 훈련 등을 개인 상태에 따라 구성
- 결과:
  - U-TAP 단어·문장 등 여러 조음 지표에서 유의한 변화가 보고됐다.
- Speech Hero에서 중요한 이유:
  - 국내에서도 **아동이 디지털 인터페이스를 이용해 반복적인 말소리 훈련을 수행하는 구조**가 실제 임상연구로 시도되었다는 근거다.
  - 개인 수행에 따라 훈련 종류와 난이도를 다르게 구성한 점도 참고할 만하다.
- 주의:
  - 대조군이 없는 13명 단일군 연구이므로 Speech Hero의 효과를 직접 증명하는 자료는 아니다.

---

## 4. 치료사는 여러 명의 아동을 관리한다는 근거

### 4-1. 국내 임상현장 말소리장애 조사, 2015

- 논문:
  - *A Survey of Speech Sound Disorders in Clinical Settings*
- 링크: https://e-csd.org/journal/view.php?number=636
- 조사 대상:
  - 언어치료 관련 전공 졸업자 중 응답자 457명
- 핵심:
  - 응답자들이 일주일 동안 평가 또는 치료한 의사소통장애 사례는 총 7,093명
  - 치료사 1인당 평균 약 15.5명을 한 주 동안 평가 또는 치료
  - 전체 사례 중 44.1%가 말소리장애가 있는 것으로 분류됨
  - 말소리장애 아동은 4~5세가 가장 많았다.
- Speech Hero에서 중요한 이유:
  - 치료사 시스템이 “한 명의 아동 전용 화면”으로 설계되면 실제 업무와 맞지 않는다.
  - **담당 아동 목록 → 아동 선택 → 현재 목표/최근 회기/검토 필요/다음 회기** 구조가 필요한 근거다.

---

### 4-2. ASHA — Caseload and Workload

- 출처: ASHA
- 링크: https://www.asha.org/practice-portal/professional-issues/caseload-and-workload/
- 핵심:
  - caseload는 담당 대상자의 수이고, workload는 직접 치료뿐 아니라 기록·계획·협업 등 전체 업무를 의미한다.
  - ASHA 2022 학교 조사에서 전일제 학교 기반 SLP의 월간 caseload 중앙값은 48명이었다.
  - ASHA는 특정 숫자를 보편적인 적정 caseload로 권고하지 않는다.
- Speech Hero에서 중요한 이유:
  - 치료사 홈은 단순히 “아동 이름 목록”만 보여주는 것이 아니라,
    여러 아동 중 **누구를 먼저 검토해야 하는지, 다음 계획이 있는지, 미검토 기록이 있는지**를 빠르게 파악할 수 있어야 한다.
- 주의:
  - 미국 학교 기반 자료이므로 한국 사설센터·병원의 평균 담당 아동 수처럼 인용하면 안 된다.

---

## 5. AI 발음 분석과 데이터셋 한계에 대한 근거

### 5-1. Sung et al., 2024 — 한국 아동 말소리장애 자동 탐지 연구

- 논문:
  - *Automatic detection of speech sound disorder in children using automatic speech recognition and audio classification*
- 링크: https://www.eksss.org/archive/view_article?pid=pss-16-3-87
- DOI: 10.13064/KSSS.2024.16.3.087
- 데이터:
  - 2~9세 아동 573명
  - APAC의 37개 목표 단어
  - 총 21,915개의 단어 단위 발화
  - 사람 전사와 목표 단어 일치 여부로 Match/Mismatch 라벨 구성
- 핵심:
  - 한국 아동 음성을 대상으로 AI 기반 말소리 분석 가능성을 연구했다.
  - 일반적인 ASR만 사용하는 방법보다 아동 음성에 맞춘 음향 분류가 더 적절할 가능성을 보여준다.
- Speech Hero에서 중요한 이유:
  - 현재 Web Speech ASR 결과만으로 “정확한 발음”을 확정해서는 안 된다는 근거다.
  - 장기적으로 실제 아동 음성과 전문가 라벨이 있는 데이터가 필요하다.
- 현재 프로젝트 상태:
  - 해당 논문의 원 데이터는 공개 학습 데이터로 확인되지 않아 Speech Hero가 직접 학습·검증한 결과는 아니다.

---

### 5-2. Korean SSD XLS-R 연구, 2024

- 논문:
  - *Automatic speech recognition (ASR) for the diagnosis of pronunciation of speech sound disorders in Korean children*
- 링크: https://www.tandfonline.com/doi/full/10.1080/02699206.2024.2387609
- DOI: 10.1080/02699206.2024.2387609
- 대상 데이터:
  - 말소리장애 아동 137명
  - 임상 진단에 사용되는 한국어 73개 단어
  - 언어재활사가 실제 들은 발음을 전사
- 핵심:
  - XLS-R 모델을 아동이 실제 산출한 발음을 인식하도록 미세조정했다.
  - 논문에서는 일반 Whisper보다 아동의 비표준 발음을 인식하는 데 더 좋은 결과를 보고했다.
- Speech Hero에서 중요한 이유:
  - 일반 ASR은 아동이 틀리게 발음한 말을 표준 단어로 “고쳐서” 인식할 수 있기 때문에,
    ASR 문장만으로 임상적인 발음 정오를 확정하는 것은 위험하다.
- 중요 제한:
  - 연구 데이터는 참여자의 사전 동의 문제 때문에 공개되어 있지 않으며, 교신저자 요청이 필요하다고 명시돼 있다.

---

### 5-3. Hugging Face — K-Univ/Pathological-child-voice

- 데이터셋:
  - `K-Univ/Pathological-child-voice`
- 링크: https://huggingface.co/datasets/K-Univ/Pathological-child-voice
- 내용:
  - 2~9세 아동 음성
  - 385개 행
  - APAC/K-APP 기반 낱말·문장
  - 자음정확도(PCC), 연령, TD/SSD 집단 등 메타데이터
- Speech Hero에서 중요한 이유:
  - 공개 한국 아동 음성이라는 점은 가치가 있다.
  - 하지만 각 발화의 `/ㅅ/`, `/ㅈ/`, `/ㄹ/`이 맞았는지에 대한 **발화 단위 정오 라벨이 없다.**
- 따라서:
  - “SSD 집단이니까 이 발화는 틀림”
  - “PCC가 낮으니까 이 /ㅅ/은 틀림”
  - 같은 식으로 임의 라벨을 만들면 안 된다.
- 라이선스:
  - CC BY-NC-ND 4.0
  - 비영리·변경 금지 조건 등도 별도 검토 필요

---

### 5-4. AI-Hub 한국어 아동 음성

- 데이터:
  - AI-Hub 한국어 아동 음성
- 링크: https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=540
- AI-Hub 이용정책:
  - https://aihub.or.kr/intrcn/guid/usagepolicy.do?currMenu=151&topMenu=105
- 핵심:
  - 대규모 한국 아동 음성과 철자 전사 자료로 ASR·아동 음성 적응에는 도움이 될 수 있다.
- Speech Hero에서 중요한 이유:
  - 철자 전사는 “해당 음소를 맞게 발음했는가”라는 임상 정답 라벨과 다르다.
  - 따라서 발음정확도 모델의 ground truth로 바로 사용할 수 없다.

---

### 5-5. Microsoft Azure Pronunciation Assessment

- 지원 언어:
  - https://learn.microsoft.com/ko-kr/azure/ai-services/speech-service/language-support
- 발음 평가 기능:
  - https://learn.microsoft.com/ko-kr/azure/ai-services/speech-service/how-to-pronunciation-assessment
- 핵심:
  - `ko-KR` 발음 평가 자체는 지원된다.
  - Microsoft 문서상 음소 이름 제공은 `en-US`, 일부 SAPI는 `zh-CN` 등에 한정되며 다른 locale에서는 음소 점수만 받을 수 있다고 설명한다.
- Speech Hero에서 중요한 이유:
  - Azure 점수 하나를 `/ㅅ/`, `/ㅈ/`, `/ㄹ/` 임상 정답으로 바로 대응시키기 어렵다.
  - 한국 아동 말소리장애 집단에서 Speech Hero 목적에 맞게 검증된 ground truth가 없는 상황에서는 “외부 API 점수 = 정답”으로 사용하면 안 된다.
- 현재 판단:
  - 비교 가능한 라벨 데이터 확보 후 별도 shadow evaluation을 하는 것이 더 적절하다.

---

## 6. 결과 지표를 하나의 점수로 만들지 않아야 하는 이유

### Outcome measures for children with speech sound disorder: an umbrella review

- 링크: https://pmc.ncbi.nlm.nih.gov/articles/PMC11086453/
- 핵심:
  - 말소리장애 연구에는 다양한 중재와 다양한 결과 측정법이 사용된다.
- Speech Hero에서 중요한 이유:
  - 하나의 `AI pronunciation score`만으로 모든 치료 결과를 표현하기보다 다음을 나누는 방향이 더 적절하다.
    - 단계
    - 목표 음소/위치
    - 독립/모방
    - cue 사용
    - 시도 수
    - 재시도
    - 평가 가능/불확실/무발화
    - 치료사 확인 결과

---

## 7. 위 근거를 바탕으로 현재 제품에 적용할 핵심 원칙

### 7-1. 치료사가 중심이다

```text
실제 평가/진단
    ↓
언어치료사가 목표 설정
    ↓
이전 회기 근거 확인
    ↓
다음 회기 계획
    ↓
치료사 승인
    ↓
Speech Hero 실행
    ↓
관찰 자료
    ↓
치료사 확인/수정/거절
    ↓
다음 계획
```

AI는 치료사를 대체하지 않는다.

---

### 7-2. 장기 목표와 오늘의 회기는 분리한다

- `TrainingGoal`
  - 현재 아동의 장기/중기 치료 목표
- `TherapistSessionPlan`
  - 다음 한 회기에 무엇을 할 것인지
- `TrainingPlan`
  - 실제 게임 엔진이 실행할 수 있도록 변환된 execution plan
- 향후 `TherapyRun`
  - Hoya와 여러 게임을 하나의 실제 회기로 묶는 실행 단위

이 구분을 하면 DB와 UI가 중구난방으로 변하는 것을 막을 수 있다.

---

### 7-3. 치료사는 프롬프트 엔지니어가 아니어야 한다

치료사가 매번 긴 자연어 프롬프트를 작성하는 대신 다음을 구조화해서 입력한다.

- 목표 음소
- 단어 내 위치
- 현재 단계
- 목표 단계
- 목표 시도 횟수
- 세션 시간
- 우선 단어
- 제외 단어
- 허용 단서
- 활동 순서

자유 텍스트는 보조적인 `치료사 메모` 정도로 사용한다.

---

### 7-4. 아동 데이터는 매일 초기화하지 않는다

아동별로 장기적으로 유지해야 하는 것:

- 목표와 version history
- 회기 기록
- 치료사 검증 결과
- 단계별 경과
- 도움을 받은 cue
- 어려웠던 항목
- 다음 회기 계획

반대로 모든 대화 원문을 영구 AI memory로 사용하는 것은 피한다.

---

### 7-5. 게임 자체를 AI가 매번 새로 만들지 않는다

게임 엔진은 고정한다.

세션마다 바뀌는 것:

- 목표 음소
- 단어
- 단계
- 난이도
- 반복 횟수
- cue
- 활동 순서
- 대화 주제

즉 AI의 역할은 `게임 코드 생성`이 아니라 **치료사가 승인한 계획을 자연스러운 Hoya 대화와 기존 게임으로 연결하는 오케스트레이션**에 가깝다.

---

### 7-6. 불확실한 음성을 실패로 처리하지 않는다

디지털 게임 연구에서 음성인식 오류와 주변 소음이 실제 문제로 지적된다.

따라서:

- `SUCCESS`
- `RETRY`
- `UNCERTAIN`
- `NO_SPEECH`

를 구분하고,

`UNCERTAIN`, `NO_SPEECH`는 성공률의 실패 분모에 넣지 않는 현재 Speech Hero 방향을 유지하는 것이 좋다.

---

### 7-7. Hoya 자유대화에서 목표음이 보였다고 발음 성공은 아니다

```text
TARGET_OBSERVED
≠
CORRECT_PRONUNCIATION
```

ASR에서 “사과”라고 인식됐다는 사실은 해당 아동이 임상적으로 정확한 /ㅅ/을 산출했다는 의미가 아니다.

자유대화는:

- 목표 표현 관찰
- 자연스러운 재유도
- 대화 일반화 기회

용도로 사용하고,

임상 성공률에 넣으려면 치료사 검토나 별도의 검증된 발음 평가가 필요하다.

---

## 8. 제안서에 바로 사용할 수 있는 짧은 근거 문장

### ASHA

> 미국언어청각협회(ASHA)는 말소리 치료에서 목표음을 확립한 뒤 음절, 단어, 문장, 대화처럼 점차 실제 사용 상황으로 일반화하고, 아동의 수행에 따라 목표와 방법을 조정하는 과정을 중요하게 다룬다.

출처:  
https://www.asha.org/practice-portal/clinical-topics/articulation-and-phonology/

---

### 대구대학교 연구

> 2019년 대구대학교 특수교육재활과학연구소 연구에서는 4~7세 조음음운장애 아동을 대상으로 한 중재 후 단어와 문장 수준의 조음정확도 향상이 나타났으며, 증강현실과 같은 동적 자극을 활용한 치료 활동의 가능성도 제시하였다.

출처:  
https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002449969

주의: AR 집단의 치료 횟수·기간 단축 경향은 통계적으로 유의하지 않았으므로 “치료기간을 단축했다”고 쓰지 않는다.

---

### 치료 빈도

> 말소리장애가 있는 취학 전 아동 54명을 대상으로 한 연구에서는 동일한 중재를 더 높은 빈도로 제공한 집단에서 더 큰 음운 향상이 나타나 치료 강도와 반복 연습의 중요성을 보여주었다.

출처:  
https://pubmed.ncbi.nlm.nih.gov/23275415/

---

### 디지털 게임

> 아동 언어치료용 디지털 게임 27편을 분석한 체계적 문헌고찰에서는 게임 기반 활동이 치료 중 아동의 동기와 주의집중을 지원할 가능성이 보고되었으며, 반복 실패에 따른 좌절, 주변 소음, 난이도 불일치, 음성인식 오류 등의 문제도 함께 제시되었다.

출처:  
https://pmc.ncbi.nlm.nih.gov/articles/PMC9061057/

---

### 실제 치료사 업무 흐름

> 실제 언어치료센터에서는 초기상담과 진단평가 후 중재를 실시하고 치료진전을 평가·보고하는 흐름으로 운영되므로, Speech Hero도 진단을 대체하기보다 치료 목표가 정해진 이후의 수행과 기록을 보조하는 구조로 설계한다.

출처:  
https://slpcenter.cnu.ac.kr/speechtherapy/used/service02.do

---

### 대구대학교 언어치료학과와 프로젝트 연결

> 대구대학교 언어치료학과에서는 언어임상센터와 Case Conference를 통해 실제 언어평가·치료 실습 사례와 접근 방법의 근거 적합성을 다루고 있어, Speech Hero 역시 게임 기능 자체보다 치료 목표와 수행 근거가 연결되는 구조를 중심으로 설계할 필요가 있다.

출처:  
https://daeguslp.daegu.ac.kr/article/table_44/detail/70674?pageIndex=1

---

## 9. 제안서에서 강하게 주장하면 안 되는 내용

현재 자료만으로 아래처럼 쓰지 않는다.

- “Speech Hero가 언어치료 효과를 향상시킨다.”
- “Speech Hero가 치료시간을 단축한다.”
- “게임을 사용하면 집중력이 향상된다.”
- “AI가 아동의 발음을 정확하게 판정한다.”
- “30회/70회가 모든 아동에게 최적의 반복 횟수다.”
- “ASR에서 단어가 맞게 인식되면 발음도 정확하다.”
- “Hoya 대화 결과가 곧 임상 평가 결과다.”

더 적절한 표현:

- “반복 훈련 참여를 지원하도록 설계하였다.”
- “게임 기반 활동은 동기와 주의집중 유지에 긍정적인 가능성이 보고되었다.”
- “AI 결과는 치료사의 판단을 보조하기 위한 관찰 근거로 사용한다.”
- “최종 임상 판단은 언어치료사가 담당한다.”
- “목표 시도 횟수와 난이도는 치료사가 아동의 수행에 따라 조정한다.”
- “현재 발음 분석은 임상적으로 검증된 진단 모델이 아니다.”

---

## 10. 참고 출처 빠른 목록

1. ASHA — Speech Sound Disorders: Articulation and Phonology  
   https://www.asha.org/practice-portal/clinical-topics/articulation-and-phonology/

2. ASHA — Documentation in Health Care  
   https://www.asha.org/Practice-Portal/Professional-Issues/Documentation-in-Health-Care/

3. ASHA — Caseload and Workload  
   https://www.asha.org/practice-portal/professional-issues/caseload-and-workload/

4. 충남대학교 언어치료센터 — 서비스 내용  
   https://slpcenter.cnu.ac.kr/speechtherapy/used/service02.do

5. 대구대학교 언어치료학과 — 제17회 Case Conference  
   https://daeguslp.daegu.ac.kr/article/table_44/detail/70674?pageIndex=1

6. Allen (2013) — Intervention efficacy and intensity for children with speech sound disorder  
   https://pubmed.ncbi.nlm.nih.gov/23275415/

7. McFaul et al. (2022) — Increasing intervention intensity in clinical practice  
   https://pmc.ncbi.nlm.nih.gov/articles/PMC9096566/

8. Saeedi et al. (2022) — Digital Games for Speech Therapy Systematic Review  
   https://pmc.ncbi.nlm.nih.gov/articles/PMC9061057/

9. 이창윤 외 (2019) — 증강현실 조음음운장애 중재  
   https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002449969

10. Kim et al. (2023) — Home-Based Serious Game Clinical Trial  
    https://games.jmir.org/2023/1/e49216

11. A Survey of Speech Sound Disorders in Clinical Settings  
    https://e-csd.org/journal/view.php?number=636

12. Sung et al. (2024) — Korean Child SSD Automatic Detection  
    https://www.eksss.org/archive/view_article?pid=pss-16-3-87

13. Korean Child SSD ASR / XLS-R  
    https://www.tandfonline.com/doi/full/10.1080/02699206.2024.2387609

14. Hugging Face — K-Univ/Pathological-child-voice  
    https://huggingface.co/datasets/K-Univ/Pathological-child-voice

15. AI-Hub — 한국어 아동 음성  
    https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=540

16. Microsoft Azure — Speech language support  
    https://learn.microsoft.com/ko-kr/azure/ai-services/speech-service/language-support

17. Microsoft Azure — Pronunciation Assessment  
    https://learn.microsoft.com/ko-kr/azure/ai-services/speech-service/how-to-pronunciation-assessment

18. Outcome measures for children with speech sound disorder: umbrella review  
    https://pmc.ncbi.nlm.nih.gov/articles/PMC11086453/

---

## 11. 프로젝트에서 가장 우선적으로 들고 갈 근거 6개

발표나 제안서에서 자료가 너무 많으면 아래 6개만 우선 사용해도 충분하다.

1. **ASHA Speech Sound Disorders**
   - 치료 단계와 일반화 구조의 핵심 근거

2. **ASHA Documentation**
   - 치료사 화면과 회기 기록 구조의 핵심 근거

3. **대구대학교 2019 AR 연구**
   - 4~7세 + 대구대학교 + 동적 치료 활동이라는 프로젝트 직접 연관성

4. **Allen 2013 RCT**
   - 치료 빈도와 반복 연습 중요성

5. **2022 Digital Game Systematic Review**
   - 게임을 사용하는 이유와 동시에 주의할 문제

6. **충남대학교 언어치료센터 실제 서비스 흐름**
   - 실제 치료가 평가 → 중재 → 진전 평가로 이어진다는 현장 구조 근거

여기에 발표 질의응답 대비용으로  
**Sung 2024 / XLS-R 2024**를 준비하면 “왜 AI가 자동으로 발음 정답을 판정하지 않느냐?”라는 질문에도 설명하기 좋다.
