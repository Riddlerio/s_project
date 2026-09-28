# npm 보안 감사: 공모전 MVP

2026-09-28에 `npm.cmd audit --json`, `npm.cmd audit`, `npm.cmd audit --omit=dev --json`, `npm.cmd ls`, `npm.cmd explain`으로 확인했다. 설치 버전은 lockfile과 `node_modules`를 대조했다. 전체 결과는 **7건: critical 1, high 1, moderate 5**이다. 배포 의존성만 검사하면 **moderate 2건**이다. npm은 취약 패키지 단위로 세므로 하나의 패키지에 여러 권고가 연결될 수 있다.

분류 기준: A는 지금 안전한 patch/minor로 막아야 하는 실제 사용자 위험, B는 제한된 조건에서 영향이 있거나 낮은 회귀 위험의 수정 권장, C는 현재 시연 조건에서 노출이 낮고 해결에 major 변경이 필요한 항목이다. 이번 결과에서 **A 0건, B 0건, C 7건**으로 판단했다. 이 결정은 로컬 시연 범위에 한정되며 인터넷에 개발 서버나 Vitest UI를 공개하는 경우에는 다시 평가해야 한다.

| 패키지 / 설치 버전 | audit 심각도·범위 | 직접성·의존성 경로 | 실행 위치와 현재 영향 | 분류 |
| --- | --- | --- | --- | --- |
| `vitest@2.1.9` | critical, `<3.2.6` 등 | 직접 dev; 루트 → vitest | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp): Windows에서 Vitest UI/Browser Mode 또는 네트워크에 공개된 API가 파일 읽기·실행 통로가 될 수 있다. 프로젝트는 `vitest run`만 실행하며 UI/Browser Mode를 설정하지 않는다. 정적 번들에 포함되지 않는다. 아래 mocker·Vite·vite-node 문제도 이 패키지에 전파된다. | C |
| `vite@5.4.21` | high, `<=6.4.2` | 직접 dev; 루트 → vite. plugin-react 및 Vitest에서도 같은 Vite를 참조 | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff): Windows 개발 서버를 네트워크에 공개하고 허용된 디렉터리에 민감한 파일이 있을 때 `server.fs.deny` 우회로 파일이 노출될 수 있다. [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)는 최적화된 의존성 `.map` 파일 경로 문제, [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)는 Windows 편집기 실행 경로를 통한 NTLMv2 해시 노출이다. 로컬 개발 서버에 한정된다. | C |
| `esbuild@0.21.5` | moderate, `<=0.24.2` | 간접 dev; 루트 → vite → esbuild | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99): esbuild 개발 서버의 CORS 설정으로 악성 웹사이트가 서버 응답을 읽을 수 있다. 이 앱은 esbuild 서버를 직접 시작하지 않고 Vite가 빌드·변환에 사용한다. 브라우저 배포 번들에는 포함되지 않는다. | C |
| `@vitest/mocker@2.1.9` | moderate, `>=2.1.0 <4.1.11` | 간접 dev; 루트 → vitest → @vitest/mocker | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9): 개발 서버의 redirect mock이 공격자 제어 경로를 처리하면 임의 파일 읽기가 가능하다. 테스트 UI나 관련 개발 서버 노출이 조건이며 정적 번들에는 없다. Vite 취약 경로도 전파된다. | C |
| `vite-node@2.1.9` | moderate, `<=2.2.0-beta.2` | 간접 dev; 루트 → vitest → vite-node → vite | 별도 직접 권고가 아니라 취약 Vite 의존성 때문에 전파된 항목이다. 테스트 실행에만 쓰고 배포 번들에는 없다. | C |
| `react-router@6.30.6` | moderate, `>=6.0.0 <7.18.0` 등 | 간접 runtime; 루트 → react-router-dom → react-router | [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)는 공격자가 제어한 경로를 `Link`/`navigate`에 넣을 때 외부 사이트로 이동할 수 있다. 이 앱의 이동 대상은 상수 또는 서버가 생성한 UUID를 붙인 경로이며, 현재 외부 입력이 이동 대상으로 흐르지 않는다. [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg)는 수동 SSR hydration에서 공격자 제어 오류 객체가 필요한데 앱은 정적 `BrowserRouter`를 쓴다. 첫 문제는 브라우저 번들에 존재하지만 현재 코드에서 exploit 경로는 확인되지 않았고, 둘째 문제의 SSR 조건은 없다. | C |
| `react-router-dom@6.30.6` | moderate, `6.0.0-alpha.0 - 7.17.0` | 직접 runtime; 루트 → react-router-dom → react-router | 별도 권고가 아니라 위 `react-router`의 전파 항목이다. 브라우저 번들에는 포함되나 현재 이동 경로 제약과 SSR 미사용으로 현실적 노출은 낮다. | C |

## 결정과 시연 조건

- npm이 제시한 수정은 Vite 8.3.1, Vitest 5.0.2, React Router DOM 7.18.4로 모두 major 변경이다. Vite 5·Vitest 2·React Router 6에서 해결하는 patch/minor는 현재 감사 결과에 없다. `npm audit fix --force` 및 major 변경은 수행하지 않았다. 이 릴리스에서 의존성 파일과 lockfile은 유지한다.
- Vite 개발 서버는 `127.0.0.1`로 명시해 로컬에서만 듣도록 했다. 시연 시 `--host`, Vitest UI/Browser Mode, 외부 인터넷 공개를 사용하지 않는다. 이 제한은 취약 버전 자체의 수정을 대신하지 않으며, 시연 조건이 바뀌면 업그레이드가 필요하다.
- `react-router-dom`은 브라우저 런타임 의존성이다. 외부 입력을 라우팅 대상으로 새로 넣는다면 7.18 이상으로 올리거나 입력을 검증해야 한다. 현재 백엔드는 세션 ID를 UUID로 만들고, 클라이언트는 그 ID에 고정된 `/play/session/` 접두사를 붙인다.
- `react`, `react-dom`, `recharts`에는 이번 audit 권고가 없다. `@vitejs/plugin-react`는 Vite를 peer dependency로 참조하지만 독립적인 취약 경로는 없다. Vite·Vitest·TypeScript·plugin-react는 빌드·개발 도구다. 정적 `dist`에는 React Router와 Recharts가 들어가지만 Vite·Vitest·esbuild·mocker·vite-node 서버 코드는 없다.
- `recharts@2.15.4`는 npm에 “1.x and 2.x branches are no longer active”라는 deprecated 경고가 등록되어 있다. [공식 3.0 마이그레이션 가이드](https://github.com/recharts/recharts/wiki/3.0-migration-guide)는 API·내부 동작 변화를 설명한다. 현재 `SessionTrendChart`는 `ResponsiveContainer`, `LineChart`, `Tooltip`, `Legend`, `ReferenceLine` 등을 사용하며 차트 동작을 확인하는 전용 테스트가 없다. 감사 취약점은 없으므로 공모전 MVP에서는 2.x를 유지하고, 화면 검증을 포함한 별도 업그레이드로 진행한다.

이 판정은 실제 exploit 조건, 정적 번들 포함 여부, 로컬·제한 사용자 시연, major 변경의 회귀 위험을 함께 고려한 것이다. 최종 판단은 회귀 검증 결과와 실제 마이크 수동 시험 결과를 함께 확인해 갱신한다.
