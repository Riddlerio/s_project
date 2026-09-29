# 한국어 아동 발음 연구 — 최종 결정

기준: main `ed7e61b`(PR #5 merge 이후) · 2026-09-29. 이전 조사: [pronunciation_v1](pronunciation_v1.md).

## 결정

**FINAL VERDICT: DATASET_NOT_SUITABLE.** 실험은 NOT RUN, Azure는 DEFERRED_COMPLEXITY이자 NOT_CONFIGURED이다.

- 지금 합법적으로 접근할 수 있는 데이터 중에는 Speech Hero의 목표를 학습할 정답이 있는 것이 없다.
- 그 목표는 "한국 아동이 목표 단어 안의 /ㅅ/·/ㅈ/·/ㄹ/을 맞게 산출했는가"이고, 필요한 정답은 발화 단위의 사람 정오 판단 또는 사람이 들은 음성 전사다.
- 그런 라벨이 있는 연구 데이터는 모두 저자 요청을 거쳐야만 얻을 수 있고, 이번 단계에서는 요청하지 않았다.
- 그래서 학습 모델, 외부 발음 API, production 변경을 모두 만들지 않았다. production 코드(`backend/app`, `src`, `backend/requirements.txt`)는 바뀌지 않았다.

아무것도 구현하지 않은 것은 실패가 아니다. 맞지 않는 라벨로 모델을 만들거나, 검증되지 않은 외부 점수를 아동 음성 처리 경로에 붙이는 것보다 안전한 결정이다.

## 1. 최종 데이터셋 검색 범위

이번 세션에서 읽기 전용 subagent가 처음부터 다시 검색했다. MAIN AGENT는 핵심 후보의 Hugging Face API 열 구성과 JMIR 논문의 데이터 가용성 문구를 직접 다시 확인했다.

- **검색한 곳**: Hugging Face 데이터셋 API(korean child/children, kid korean, pathological, articulation, child speech), AI-Hub(아동·소아·발음·조음·구음 관련), TalkBank(PhonBank Clinical 포함)·CHILDES Korean, Kaggle, Zenodo, Figshare, OSF, Harvard Dataverse, OpenSLR, GitHub, KCI·KoreaScience·eksss.org, 최근 논문과 부록.
- **검색어**: Korean child articulation/pronunciation, Korean SSD, speech sound disorder child, mispronunciation child, phonetic transcription children, APAC, K-APP, U-TAP 등의 변형.

## 2~4. 후보, 실제 사용 가능 여부, 판정

| 후보 | 라벨 | 실제 접근 | 라이선스 | 판정 |
|---|---|---|---|---|
| Sung 외 2024 (PSS 16(3):87), 573명·단어 21,915개 | 단어 일치/불일치(사람 전사와 목표 단어 비교) | 공개 자료 없음 | 없음 | NOT_AVAILABLE |
| XLS-R SSD 연구 (Clinical Linguistics & Phonetics 2024), 137명·73개 단어 | 언어재활사가 들은 음성 전사 | "교신저자 요청 시" | 해당 없음 | NOT_AVAILABLE |
| **Kim 외 JMIR 2025** (인천성모병원), 3~7세 30명·APAC 37개+U-TAP 30개 단어 | 단어마다 언어재활사 2명의 독립 전사, 불일치는 3번째 평가자가 결정 | "no prior consent… available from the corresponding author on reasonable request" | 해당 없음 | NOT_AVAILABLE (가장 적합한 라벨 설계) |
| Woodbridge & Suh 2026 (arXiv 2606.10213), 2~5세 녹음 53개 | 자음·모음 이진 정오 | 공개 없음 | 해당 없음 | NOT_AVAILABLE |
| HF `K-Univ/Pathological-child-voice` (385행) | 녹음 1개당 PCC·TD/SSD 집단·과제 유형 | 공개(ungated) | CC BY-NC-ND 4.0, 원 제작자 통지 필요 | AUXILIARY_ONLY / LICENSE_UNCLEAR |
| HF `K-University-AIED/Pathological-child-voice` (같은 한림대 자료의 두 번째 업로드, 303행·약 2.5 GB) | 위와 같은 열(직접 확인) | 공개(ungated) | CC BY-NC-ND 4.0 | AUXILIARY_ONLY / LICENSE_UNCLEAR |
| AI-Hub 한국어 아동 음성(540), 아동 음성(266), 아동 방송 음성(71502), 자유대화 소아(108) | 철자 전사 | 내국인 신청·승인 | AI-Hub 정책(제3자 제공 금지 등) | AUXILIARY_ONLY |
| AI-Hub 구음장애(608) | 대부분 성인 | 내국인·안심존 | AI-Hub 정책 | NOT_SUITABLE |
| AI-Hub 교육용 한국인의 영어 음성(71463) | 발음 오류 태그가 있으나 영어 음성 | 내국인 | AI-Hub 정책 | NOT_SUITABLE |
| 한국 ASD 아동 음성(arXiv 2402.15539) | 화자 단위 3점 평정 | 공개 문구 없음 | 해당 없음 | NOT_AVAILABLE, 과제 불일치 |
| TalkBank PhonBank / CHILDES Korean(Jiwon·Ko·Ryu) | PhonBank에 한국어 없음. CHILDES는 0~3세 자유 상호작용 | 공개 | TalkBank 규칙 | NOT_SUITABLE |
| ChildVox 벤치마크(arXiv 2605.29257) | 영어·중국어 발음 라벨 | 공개 | — | NOT_SUITABLE (방법 참고용) |

`SUITABLE_PRIMARY`와 `SUITABLE_SECONDARY`는 모두 **NONE**이다. "논문에서 사용됨"과 "우리가 지금 사용할 수 있음"을 구분해서 판정했다. PCC·TD/SSD 집단·철자 전사는 발화 정오로 바꾸지 않았다.

## 5~6. 실험

**NOT RUN.** 적합한 정답 데이터가 없어 비교할 test set이 없다. 수치나 가짜 데이터, 임의 라벨을 만들지 않았다. 데이터가 생기면 쓸 방법(REPRODUCIBLE_PROXY_BASELINE, 화자 단위 분할, 동결 SSL 표현과 작은 분류기, false correction rate, 화자 단위 bootstrap)은 [v1 보고서](pronunciation_v1.md)에 정의해 두었다.

## 7. Azure 검토

**AZURE: DEFERRED_COMPLEXITY. 구현하지 않았고, 이 PC에는 설정도 없다(NOT_CONFIGURED).**

공식 문서에서 확인한 사실:
- ko-KR 발음 평가를 지원한다. 참조 문장(ReferenceText) 기반 scripted 평가이고, 단어·음소 점수를 준다.
- ko-KR은 **음소 이름 없이 점수만** 준다("For other locales, you can only get the phoneme score"). 그래서 어느 점수가 /ㅅ/인지 알 수 없다.
- NBest spoken phoneme과 prosody는 en-US 전용이다.
- 모델은 성인 원어민 음성으로 학습됐고, 아동·장애 음성 검증은 없다.
- 과금은 STT와 같은 초 단위이고, F0 무료 티어는 월 5시간이다. 달러 금액은 페이지에서 렌더링되지 않아 확인하지 못했다.
- 짧은 음성 평가에서는 음성을 저장하지 않고 학습에도 쓰지 않는다. koreacentral region을 쓸 수 있다.

제외한 이유(하나만 해당해도 이번 범위에서 제외):
- 비교할 정답 데이터가 없다. 같은 dataset으로 Azure를 평가해 "자체 모델이 필요한가"를 판단하는 것 자체가 불가능하다.
- 제품에 붙이려면 여러 조건이 새로 필요하다.
  - 브라우저 PCM 캡처(AudioWorklet 분기)와 새 음성 upload endpoint
  - 64 KB 본문 제한의 경로별 예외
  - 발화 ID 연결과 새 DB 표
  - 아동 음성의 외부 전송
- 그러려면 보호자 동의 흐름도 새로 만들어야 한다. 개인정보 보호법상 14세 미만은 법정대리인 동의가 필요하고, 외부 처리 위탁·국외 이전은 따로 알리고 동의를 받아야 하며, 건강정보(민감정보) 해당 여부는 법률 검토가 필요하다.
- Azure resource·과금 설정과 key 관리가 필요하다.
- ko-KR 음소 점수를 /ㅅ/·/ㅈ/·/ㄹ/에 대응시키려면 추정을 해야 한다(TARGET_PHONEME_MAPPING_UNCERTAIN). 단어 점수만으로는 목표 음소 질문에 답하지 못한다.
- 결과적으로 구현·테스트 부담이 데이터 실험보다 크다.

다른 방법도 참고로 적어 둔다. 어느 것도 한국 아동·장애 음성 검증 기록은 없다.

| 방법 | 확인된 사실 | 한계 |
|---|---|---|
| Naver CLOVA Speech 발음 평가 | 한국어 지원, 단어별 점수(공식 문서) | 음소 단위 없음 |
| SpeechSuper | 한국어 음소 결과(업체 데모 기준) | 문서로 확인하지 못함 |
| Speechace·Tencent SOE | — | 한국어 미지원 |
| MFA `korean_mfa` 정렬 + GOP | 공개 모델 | 성인 학습 |
| `slplab/wav2vec2-xls-r-300m_phone-mfa_korean` + CTC-GOP | Apache 2.0, 음소 이름을 주고 음성을 서버 밖으로 보내지 않음 | 성인 학습, torch 필요 |

## 8. 현재 Speech Hero의 한계

- 단어 과제는 브라우저 Web Speech 문장을 단순 G2P로 정렬해 판정한다. 아이가 부정확하게 말해도 ASR이 표준 단어("사과")로 고쳐 인식하면 맞게 발음한 것으로 볼 수 있다.
- 지속음 과제는 시간·마찰 규칙이어서 단어 안 음소를 보지 않는다.
- 이 한계를 줄일 후보(음향 기반 음소 점수·분류기, 참조 단어 기반 발음 평가 API)는 모두 한국 아동 정답 데이터로 비교·보정하기 전에는 도입 근거가 없다.

## 9. clinical validation과 technical evaluation의 차이

외부 데이터셋이나 API에서 좋은 수치가 나와도 그것은 기술적 평가다. Speech Hero의 임상 검증이 아니다. 임상적 사용에는 실제 사용 환경의 한국 아동 음성, 언어재활사의 독립 라벨, false correction 검토가 필요하다. 현재 상태는 **CLINICAL VALIDATION: NOT VALIDATED — NO LABELED DATA**, **PRODUCTION READY: NO**다.

## 10. FUTURE WORK

1. **FUTURE_DATASET_ACCESS**: 연구자에게 라벨 데이터 사용을 요청한다. 이번 단계에서는 하지 않았다. 우선순위는 인천성모병원 JMIR 2025(단어별 언어재활사 이중 전사), 한림대 Sung 외 2024·HF 원 자료, CLP 2024 저자 순이다. 요청할 때 확인할 것은 학습·가중치 공개 범위, 화자 ID, 보호자 동의 범위다.
2. 언어재활사와 함께 자체 라벨 데이터를 만든다(보호자 동의·IRB 전제). 발화마다 목표 단어·음소·위치, 들은 전사 또는 정오를 기록하고, 평가자 간 일치도도 남긴다.
3. 같은 화자 단위 test set에서 **현재 방식(proxy)·자체 모델·Azure 등 API**를 비교한다. 이때 Azure는 오프라인 소량 benchmark로만 쓰고, 그 결과로 제품 적용 여부를 판단한다.
4. 충분한 라벨로 우수성이 확인된 경우에만 SHADOW 연결(PHASE C)을 한다. ASSIST는 실물 마이크와 치료사 독립 라벨 검증 뒤에만 검토한다.
