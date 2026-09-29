# 한국어 아동 발음 데이터셋 조사와 오프라인 비교 계획 — v1

기준: `feature/pronunciation-research-v1` (main `8e52669`, PR #4 merge 이후) · 2026-09-29
명세: `SPEECH_HERO_FINAL_RELIABILITY_DATASET_PRONUNCIATION_PROMPT.md` PHASE B

> 후속: 2026-09-29 재검색·Azure 검토를 포함한 최종 결정은 [pronunciation_final](pronunciation_final.md)에 있다(결론 동일: DATASET_NOT_SUITABLE).

## 결정

**DATASET_NOT_SUITABLE — 실험 NOT RUN.**

Speech Hero의 질문은 "한국 아동이 목표 단어(목표 음소 /ㅅ/·/ㅈ/·/ㄹ/)를 맞게 산출했는가"이다. 이 질문에 맞는 라벨(발화 1개마다 사람이 들은 전사 또는 정오)이 있는 한국 아동 데이터는 연구로만 존재하고 공개되지 않았다(NOT_AVAILABLE). 지금 받을 수 있는 한국 아동 데이터는 녹음 전체의 자음정확도(PCC)·TD/SSD 집단, 또는 철자 전사만 있어 발화 단위 발음 정오 판별의 정답으로 쓸 수 없다(AUXILIARY_ONLY). 명세의 label safety 규칙에 따라 PCC·집단·ASR 전사를 발화 정오로 바꾸지 않았고, 가짜 데이터나 임의 라벨도 만들지 않았다. 따라서 학습 모델도, baseline 수치도 없다. production 코드와 동작은 바꾸지 않았다.

## 조사 방법

- 읽기 전용 subagent 세 개가 병렬로 조사했다: 데이터셋 탐색, 라이선스·접근, 현재 baseline 분석. 공식 페이지·dataset card·논문·Hugging Face API 메타데이터만 읽었고 데이터는 내려받지 않았다.
- MAIN AGENT가 핵심 근거인 Hugging Face 데이터의 열 구성을 API로 다시 확인했다(오디오 다운로드 없음).
- 논문에 보고된 결과와 지금 실제로 내려받을 수 있는 데이터를 구분해 적었다.

## 후보 데이터셋

| 후보 | 대상·규모 | 화자 ID | 목표 단어 | 발화 단위 정오·음성 전사 | 실제 접근 | 라이선스·조건 | 판정 |
|---|---|---|---|---|---|---|---|
| A. AI-Hub 한국어 아동 음성 (dataSetSn=540) | 아동 낭독 음성 5,000시간, WAV 16/48 kHz | 있음(성별·나이·지역 등 JSON) | 읽은 문장 | 없음. 철자 전사(`LableText`)와 읽기·전사 오류 표시뿐 | 로그인·신청 승인, **내국인만** | AI-Hub 이용정책: 제3자 제공 금지, 상업 이용 별도 협의, 출처 표시. 학습 가중치 배포 규정 불명확 | AUXILIARY_ONLY |
| B. Hugging Face `K-Univ/Pathological-child-voice` | 2~9세 385행(녹음), 300분 이상, 16 kHz, TD/SSD | 있음(`LAB ID`) | 행마다 없음. 과제 유형(APAC_word, KAPP_word 등)만 | 없음. 녹음 1개당 자음정확도(PCC) 1개·집단 1개 | 공개(gated=false, 약 3.9 GB parquet) | CC BY-NC-ND 4.0. 업로더는 원 제작자가 아니라고 밝힘. 사용 전 원 제작자에게 목적 통지 요구 | AUXILIARY_ONLY, LICENSE_UNCLEAR |
| C. Korean Children SSD word-level (Sung 외 2024, PSS 16(3):87) | 2~9세 573명, 단어 발화 21,915개(37개 APAC 단어) | 있음 | 있음 | **있음**: 사람 전사와 목표 단어 일치/불일치 | 공개 자료·배포 조건 없음 | IRB·보호자 동의 언급, 배포 조건 없음 | NOT_AVAILABLE |
| D. Korean SSD XLS-R (Clinical Linguistics & Phonetics 2024) | SSD 아동 137명, 73개 단어 | 있음 | 있음 | **있음**: 언어재활사가 들은 음성 전사 | "참여자 동의가 없어 공개하지 않음, 교신저자에게 요청 가능" | 해당 없음 | NOT_AVAILABLE |
| E. Woodbridge & Suh 2026 (arXiv 2606.10213) | 2~5세 녹음 53개, 35개 단어 | 있음 | 있음 | 자음·모음 이진 정오(평가자 3명) | 데이터·코드 공개 없음 | 해당 없음 | NOT_AVAILABLE |
| F1. AI-Hub 구음장애 음성인식 (608) | 대부분 성인(10세 미만 약 0.36%) | 있음 | 단어·문장 | 없음 | 내국인·안심존 | AI-Hub 정책 | NOT_SUITABLE |
| F2. AI-Hub 자유대화(소아, 108) | 3~10세 약 3,000시간 | 있음 | 없음(자유 발화) | 없음(철자 전사) | 내국인 신청 | AI-Hub 정책 | AUXILIARY_ONLY |

Hugging Face·Zenodo·OpenSLR에서 발화 단위 발음 정오가 있는 공개 한국 아동 코퍼스는 더 찾지 못했다.

### 선택하지 않은 이유

- **B(HF)**: 실제 공개 오디오이고 연령대도 Speech Hero(4~7세)와 겹친다. 하지만 라벨이 녹음 전체의 PCC와 TD/SSD 집단뿐이다. "PCC가 낮으니 이 발화의 /ㅅ/은 틀렸다", "SSD 집단이니 이 발화는 틀렸다"는 명세가 금지한 라벨 확대다. 단어별 분할 정보도 없어 목표 단어 단위 과제를 만들 수 없다. 라이선스는 비상업·변경 금지(ND)이고, 원 권리자에게 목적을 알려야 하며, 업로더의 재배포 권한이 확인되지 않는다. 분할·재라벨·학습 가중치 공개는 ND와 충돌할 수 있다.
- **A·F2(AI-Hub)**: 아동 ASR·표현 적응용 보조 자료다. 철자 전사는 발음 정오 정답이 아니다. 내국인 신청 승인이 필요하고 제3자 제공이 금지돼 있다. 5,000시간을 받아도 발음 정오 모델의 정답은 생기지 않는다.
- **C·D·E**: 라벨 설계는 Speech Hero에 가장 가깝다(특히 C의 단어 일치/불일치, D의 들은 전사). 그러나 데이터가 공개되지 않았다. 논문의 수치를 우리 실험 결과처럼 쓰지 않는다.

## 관련 논문 결과 — 방법 근거로만 사용

아래 수치는 각 논문의 자체 데이터·분할에서 보고된 값이다. Speech Hero에서 재현한 결과가 아니며, 과제가 서로 달라 직접 비교하지 않는다.

- C(Sung 외 2024): 화자 분리 5-fold 교차검증에서 단어 발화 정오 분류 정확도 81.6%. 같은 논의에서 ASR 전사 방식은 60.2%. 일반 ASR 문장만 보는 방식보다 아동 음성에 맞춘 음향 분류가 목표 단어 정오 판별에 유리할 수 있다는 근거다.
- D(XLS-R): 아동이 실제로 산출한 발음을 인식하도록 미세조정했을 때 PER 약 10%, 일반 Whisper는 약 50%. 일반 ASR이 표준 단어로 고쳐 버리는 문제의 근거다.
- E(2026 preprint): 자기지도 음성 표현으로 자음 정오 balanced accuracy 약 0.72, 모음 약 0.85.

## Baseline 정의 — 데이터가 생길 때를 위한 기록

- **CURRENT_RUNTIME_BASELINE은 재현할 수 없다.** 현재 단어 판정은 브라우저 Web Speech의 최상위 인식 문장 → `normalize` → `SimpleKoreanG2P` → 정렬 → 목표 위치 음소 일치 여부와 점수 기준(정확도 우선 85점)이다(`backend/app/speech/pipeline.py`). Web Speech는 브라우저·클라우드 서비스라 파일 입력을 받지 않는다. 모델 버전이 공개되지 않고 결과가 고정되지 않으며, 아동 음성을 대량으로 보내는 것은 약관·개인정보 문제가 있다.
- **REPRODUCIBLE_PROXY_BASELINE**(데이터가 생기면 쓸 정의): 버전을 고정한 공개 ASR(예: Whisper small/medium, `language=ko`, temperature 0, 목표 단어를 prompt로 주지 않음. 또는 한국어 wav2vec2 CTC)의 최상위 문장을 바뀌지 않은 `analyze()`에 넣는다(치료사 규칙 없음). 목표 음소·위치는 데이터 메타데이터로 정하고, 기준 점수는 test를 보기 전에 85로 고정한다(75·70은 참고용). 결과는 반드시 "proxy"로 표시하고 "현재 Speech Hero보다 좋다"고 쓰지 않는다.
- 음질 게이트는 시작 전 1초 무음으로 잡음 기준을 잡는다. 오프라인 clip에는 이 구간이 없으므로 게이트 없이 비교하고, 필요하면 게이트 적용본을 따로 보고한다.
- 누수 금지: 사람이 쓴 참조 전사를 ASR 출력 자리에 넣지 않는다. test로 기준 점수·모델·설정을 고르지 않는다. 같은 아동을 train/validation/test에 섞지 않는다. no_speech·uncertain을 빼지 않는다.
- Magic Beam의 지속·마찰 규칙은 단어 안 음소 정체성을 보지 않으므로 단어 정오 baseline이 아니다.

## 실험 계획 — 적합 데이터 확보 시에만

C 또는 D 수준의 라벨(발화 단위 정오 또는 들은 전사, 화자 ID, 목표 단어)이 합법적으로 확보되면 다음 순서로 한다. 지금은 실행하지 않았다.

1. 화자 단위 분할(train/validation/test, 연령·집단·라벨 분포 고려). 같은 화자가 두 split에 있으면 실패로 처리하는 검사 포함.
2. 같은 test set에서 proxy baseline과 학습 모델을 비교한다. 학습 모델은 동결된 HuBERT·WavLM·XLS-R 표현과 가벼운 분류기부터 시작한다.
3. 지표: balanced accuracy, macro F1, 틀린 발음 recall·precision, false correction rate(맞게 말한 것을 틀렸다고 하는 비율), 혼동행렬, 가능하면 AUROC·AUPRC·ECE. 화자 단위 bootstrap 95% 신뢰구간.
4. validation으로만 선택하고 test는 마지막에 한 번만 평가한다.

이 PC의 계산 자원(RTX 5060 Laptop 8 GB, 디스크 여유 약 760 GB)으로 동결 표현 실험은 충분하다. 계산 자원은 막는 요인이 아니다.

## 데이터를 확보하려면(사용자가 직접)

- C·B: 한림대 하승희 교수(`shha@hallym.ac.kr`, HF card의 연락처)에게 연구 목적·범위를 알리고, 단어 단위 분할·사람 전사·일치 라벨의 제공 가능 여부와 학습·가중치 공개 허용 범위를 묻는다. C와 B의 출처가 같을 가능성은 추정일 뿐이며 확인되지 않았다.
- D: 논문 교신저자에게 요청한다. 동의 범위 때문에 오디오 제공은 어려울 수 있다.
- AI-Hub: 본인이 로그인해 연구 목적으로 신청한다(내국인). 발음 정오 정답은 없으므로 보조 용도다.

비밀번호·토큰을 공유하지 않는다. 받은 데이터는 Git 밖(`research/data/` 등)에 두고 커밋하지 않는다.

## 상태

- TECHNICAL DATASET EVALUATION: NOT RUN
- RUNTIME SHADOW: OFF (PHASE C 대상 아님)
- CLINICAL VALIDATION: NOT VALIDATED — NO LABELED DATA
- PRODUCTION READY: NO

## 출처

- AI-Hub 540 https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=540 · 이용정책 https://aihub.or.kr/intrcn/guid/usagepolicy.do?currMenu=151&topMenu=105 · 108 https://www.aihub.or.kr/aihubdata/data/view.do?dataSetSn=108 · 608 https://www.aihub.or.kr/aihubdata/data/view.do?dataSetSn=608
- HF card https://huggingface.co/datasets/K-Univ/Pathological-child-voice · API https://huggingface.co/api/datasets/K-Univ/Pathological-child-voice
- C https://doi.org/10.13064/KSSS.2024.16.3.087 (https://www.eksss.org/archive/view_article?pid=pss-16-3-87)
- D https://doi.org/10.1080/02699206.2024.2387609 (preprint https://arxiv.org/abs/2403.08187)
- E https://arxiv.org/abs/2606.10213
