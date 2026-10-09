# 저장소 도구

프런트 빌드 자료 생성과 로컬 점검에 쓰는 Node.js 스크립트입니다. 아래 명령은 저장소 루트에서 실행합니다.

- `build-design-tokens.mjs`: `shared/design-tokens.json`에서 `src/styles/tokens.css` 생성.
- `build-voice-envelopes.mjs`: 공개 음성 파일에서 `shared/dudu_voice_envelopes.json` 생성.
- `check-dist.mjs`: 빌드 결과물에 금지 문자열과 비밀값이 없는지 검사.
- `serve-phone.mjs`: 휴대폰 점검용 로컬 HTTPS 서버 실행.

생성된 파일만 직접 고치면 다음 생성 때 덮어써집니다. `check-dist.mjs`는 `npm run build`에도 포함됩니다.
