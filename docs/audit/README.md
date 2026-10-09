# 감사·계약 문서

제품의 구현 상태를 점검하고, 변경 시 지켜야 할 계약과 임시 기준값을 기록한 폴더입니다.

- [FROZEN_CORE_CONTRACT.md](FROZEN_CORE_CONTRACT.md): 인증·데이터·API 등 변경 경계와 회귀 검사. CI에서도 경로를 참조합니다.
- [HEURISTIC_REGISTER.md](HEURISTIC_REGISTER.md): 음성·게임·추천의 임시 기준값과 조정 근거.
- [PRODUCT_REALITY_MATRIX.md](PRODUCT_REALITY_MATRIX.md): 2026-09-30 구현 현실 감사와 이후 갱신 기록.
- [LEGACY_AND_PLACEHOLDER_REGISTER.md](LEGACY_AND_PLACEHOLDER_REGISTER.md): 당시 중복·미사용·임시 구현 목록과 처리 이력.

감사 문서의 초기 상태는 작성 당시의 기록입니다. 현재 동작은 코드·테스트와 각 문서의 갱신 절을 함께 확인하세요.
계약과 기준값의 변경 근거가 남아 있어 문서를 보존합니다.
