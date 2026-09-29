# Pronunciation research (PHASE B)

production과 분리된 한국어 아동 발음 모델 연구 공간이다. 여기의 내용은 FastAPI 백엔드·아동 화면·임상 통계에 연결되지 않는다.

- 최종 결정: [pronunciation_final](reports/pronunciation_final.md) — **DATASET_NOT_SUITABLE, 실험 NOT RUN, Azure DEFERRED_COMPLEXITY(구현하지 않음).** 첫 조사: [pronunciation_v1](reports/pronunciation_v1.md).
- 요약: Speech Hero의 목표(발화 단위 목표 단어·음소 정오)에 맞는 라벨이 있는 한국 아동 데이터는 공개되지 않았다.
- 원칙: 원본 데이터·캐시·모델 가중치는 Git에 넣지 않는다(`research/data/`, `research/cache/`, `research/checkpoints/`, `research/outputs/`는 `.gitignore`). 연구용 의존성(torch 등)은 `backend/requirements.txt`에 넣지 않는다. PCC·TD/SSD 집단·ASR 전사를 발화 정오로 바꾸지 않는다. 화자 단위로 분할한다.
- 다음 단계: 적합한 데이터(발화 단위 사람 전사 또는 정오, 화자 ID, 목표 단어)를 합법적으로 확보한 뒤에만 보고서의 실험 계획을 실행한다.
