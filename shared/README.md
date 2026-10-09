# 공통 데이터

프런트엔드와 백엔드가 함께 참조하는 JSON 자료와 검사 사례를 둡니다. `src/shared/`의 프런트 공통 코드와는 별개입니다.

- `design-tokens.json`: `scripts/build-design-tokens.mjs`가 CSS 변수로 변환하는 원본.
- `frontend_csp.json`: 프런트 빌드와 백엔드 정적 서비스가 함께 쓰는 보안 정책.
- `dudu_voice_lines.json`, `dudu_voice_envelopes.json`: 음성 대사 목록과 입 모양 자료.
- `daegu_crossing_rationale.json`: 건너기 게임과 치료사 화면의 설명 자료.
- `audio_quality_cases.json`, `re_onset_mic_cases.json`: 양쪽 테스트에서 쓰는 검사 사례.

여러 코드와 스크립트가 이 경로를 직접 읽습니다. JSON을 바꾸면 생성 파일과 관련 프런트·백엔드 테스트를 함께 확인하세요.
