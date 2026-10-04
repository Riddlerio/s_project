# 두두 3D 제작 자료

기존 결정(2026-10-04): 두두 최종 모델은 **Meshy Pro 웹에서 비공개 생성 → Blender 정리·리그 → GLB**로 만든다. 대구대학교 사용 허락은 사용자가 확인했다. 전체 계획은 [로드맵 4절](../../docs/ROADMAP.md)에 있다.

**최신 결정(2026-10-04): 사용자가 Meshy Pro로 업그레이드했다.** 두두 최종 모델은 Pro 계정의 **비공개(Private) 라이선스**로 아래 "유료·비공개 제작 승인 후" 절차를 따른다. 무료 체험(일반 호랑이 텍스트, 텍스처 1회 10크레딧)은 끝났고 그 결과는 앱에 쓰지 않는다.

이전 결정(2026-10-04): **먼저 무료로 미리보기를 확인한 뒤 유료 사용 여부를 결정한다.** 구독·결제·크레딧 추가 구매는 승인하지 않았다. 현재 게임의 코드 기반 두두 모델은 계속 사용하며, 무료 체험 결과를 최종 모델로 연결하지 않는다.

## 비용과 공개 범위

- Free는 월 100크레딧이며 카드 등록 없이 체험할 수 있다. 다만 **Multi-view는 Pro 이상**, **Meshy 6·7 생성 모델 다운로드는 유료 구독**이 필요하다. 무료 미리보기와 앱에 넣을 GLB 확보는 다른 단계다. 크레딧 팩만 구매해도 다운로드가 열리는 것은 아니다. [플랜 비교](https://help.meshy.ai/en/articles/12062933-which-meshy-plan-is-right-for-you-free-vs-pro-vs-premium-vs-ultra), [다운로드 제한](https://help.meshy.ai/en/articles/10421033-why-can-t-i-download-my-model)
- 공식 플랜 비교의 Pro 월 정가는 US$20이다. 할인·세금·환율·구독 주기는 실제 결제 화면에서 다시 확인한다. 작업별 크레딧도 실행 버튼에 표시된 값을 확인하고, 무료 잔액을 넘거나 결제창이 나오면 중단한다. [공식 가격](https://www.meshy.ai/pricing)
- 무료 결과는 CC BY 4.0이며, 기존의 비공개 제작 원칙과 같지 않다. **첫 체험에는 대학 두두 원본 이미지·흉장을 업로드하지 않고 일반 호랑이 텍스트만 사용한다.** 무료 플랜에 두두 원본을 올리려면 공개 범위와 업로드 허락을 별도로 확인한다. [플랜 비교](https://help.meshy.ai/en/articles/12062933-which-meshy-plan-is-right-for-you-free-vs-pro-vs-premium-vs-ultra)
- 유료 Private도 학습 사용을 완전히 배제한다는 뜻은 아니다. 공식 FAQ는 비 Enterprise 데이터의 향후 익명화 학습 사용 가능성을 안내한다. 대학 자료를 올리기 전에 기존 사용 허락 범위와 맞는지 확인한다. [개인정보·학습 FAQ](https://help.meshy.ai/en/articles/15724182-is-meshy-safe-and-private-data-and-training-faq)

## 지금 실행할 무료 체험

1. [공식 작업 화면](https://www.meshy.ai/workspace)에 **사용자가 직접 로그인**한다. 비밀번호·인증 코드·쿠키·API 키를 공유하지 않는다. 계정이 Free이고 무료 크레딧이 남았는지 확인한다. 업그레이드·카드 등록은 하지 않는다.
2. `Model → Text to 3D`를 선택한다. 모델은 Meshy 7이 무료 잔액으로 실행 가능한지 확인하고, 불가능하면 유료 전환하지 말고 화면을 공유한다. 이 체험에서는 Image to 3D와 Multi-view를 사용하지 않는다.
3. 다음 일반 호랑이 프롬프트를 입력한다. Pose 설정이 제공되면 A-pose를 선택한다. 텍스트만으로 지정한 자세는 정확히 재현되지 않을 수 있다.

   ```text
   A friendly cartoon bipedal orange tiger with black stripes, an oversized round head, a simple blue scarf, and a smooth toy-like surface. A-pose with arms separated from the torso and feet separated. One character only, no text, logos, or insignia.
   ```

4. `Generate`의 크레딧 비용을 확인하고 **한 번만** 생성한다. 잔액 부족·결제 요구가 나오면 중단한다. 생성 대기 중 중복 실행하지 않는다. 처음 결과가 흰색인 것은 정상이며, 색을 입히는 Texture는 별도 단계다.
5. 모델을 360도 회전해 정면·측면·후면을 확인한다. 머리 비율, 손발 누락·추가, 팔·다리의 몸통 융합, 몸통 뒤쪽의 이상한 돌출을 확인한다. Free에서 재시도가 무료라고 가정하지 않는다.
6. 형태가 괜찮을 때만 Texture의 추가 비용을 확인해 무료 잔액 안에서 색을 적용한다. 정면·측면·후면 화면을 사용자와 함께 검토한다. 이 일반 호랑이 결과는 도구의 품질 시험이며 **두두 원화 재현 성능을 검증한 것은 아니다.**
7. 여기서 무료 체험을 끝낸다. 다운로드 결제창을 우회하지 않고, 공개 게시·유료 전환·앱 연결은 하지 않는다. 결과를 보고 기존 코드 모델 유지 또는 별도 승인 후 유료 제작을 결정한다.

메뉴와 생성 순서는 [Text to 3D 공식 안내](https://help.meshy.ai/en/articles/9996858-how-to-use-meshy-text-to-3d)를 따른다. 계정 화면의 실제 옵션·잔액을 우선 확인한다.

## 최종 제작용 입력 이미지 (`meshy_input/`)

아래 이미지는 **유료·비공개 제작 승인 후** 사용한다. 현재 무료 체험에는 업로드하지 않는다.

| 파일 | 내용 | 쓰는 곳 |
|---|---|---|
| `view_front.png` | 조형 도면 정면(팔 내림 자세), 1024px 흰 배경 | 메인 이미지 |
| `view_side.png` | 같은 도면의 측면. 두두가 **이미지 왼쪽을 바라봄** | 추가 이미지(측면) |
| `view_back.png` | 같은 도면의 후면 | 추가 이미지(후면) |
| `alt_front_plush_target.png` | 털·천 질감 목표 이미지(손을 허리에 얹은 자세) | 별도 질감 참고·비교용 |

도면 원본은 444×450px를 확대했으므로 세부 선이 흐릴 수 있다. 자세가 다른 대체 정면을 기존 측면·후면과 무조건 섞지 않는다.

## 유료·비공개 제작 승인 후

1. Pro 이상 계정에서 생성 라이선스를 **Private**로 확인한다. 계정 상태나 공개 범위를 확인할 수 없으면 대학 원본 업로드를 중단한다.
2. `Model → Image to 3D`, **Meshy 7 + Multi-view + Standard**를 선택한다. Multi-view와 Smart Topology는 동시에 사용할 수 없다. 메인은 정면, 추가 이미지는 측면과 후면이다. 측면은 화면에서 왼쪽을 바라본다는 사실만으로 캐릭터의 해부학적 Left/Right를 단정하지 말고 슬롯 미리보기와 결과 방향을 확인한다. [Multi-view 도움말](https://help.meshy.ai/en/articles/12634481-how-to-use-multi-view)
3. 세 이미지 모두 내장 Remove Background를 적용하고, 같은 크기·위치·여백인지 확인한다. A-pose를 선택해 팔·다리를 몸통과 분리한다. Image Enhancement는 저해상도 보완용으로 검토하되 흉장·줄무늬를 정확히 복원한다고 가정하지 않는다. [Image to 3D 안내](https://help.meshy.ai/en/articles/9996860-how-to-use-meshy-image-to-3d)
4. 후보 하나부터 생성해 360도 검토한다. 둥글고 큰 머리, 짧은 주둥이, 줄무늬, 뒤에서 종 모양으로 퍼지는 망토를 확인한다. 추가 후보·재시도는 잔액과 비용을 확인한 뒤 실행한다.
5. **형태 확인 → Remesh → Texture(PBR) → Animate/Auto Rigging** 순서로 진행한다. 리깅용 Quad를 선택할 수 있지만 3만 쿼드를 모바일 최종 예산으로 삼지 않는다. 1쿼드는 보통 2삼각형으로 바뀌므로, 프로젝트의 최종 1~2만 삼각형 목표는 Blender에서 실제 삼각형 수로 확인한다. 세부 형태 손실과 기기 성능에 따라 조정한다. [Remesh 안내](https://docs.meshy.ai/en/webapp/guides/3d-model/remesh), [Quad 다운로드 주의](https://help.meshy.ai/en/articles/9992029-how-to-download-a-quad-mesh-model)
6. 두 발로 서는 두두는 Humanoid 리그를 우선 검토한다. 손발 융합이나 망토 왜곡이 있으면 자동 리그 성공으로 기록하지 않고 Blender에서 수정한다. GLB와 리그 포함 FBX를 내려받고, ZIP이 있으면 텍스처와 원본 압축 파일도 보관한다. [리깅·내보내기 안내](https://help.meshy.ai/en/articles/16231707-how-to-create-3d-animation-with-auto-rigging)
7. 승인 후 다운로드를 `assets/dudu3d/meshy_output/`에 넣는다. 예: `dudu_meshy_v1.glb`, `dudu_meshy_v1.fbx`. 이 폴더는 Git에서 제외되어 있다. 생성 날짜·사용 모델·라이선스·크레딧 사용량도 기록한다.

## 2026-10-04 실제 제작 기록 (Claude)

사용자가 Pro로 업그레이드하고 별도 Edge 창에 직접 로그인했다. Claude가 그 창에서 아래를 실행했다. 결제·구독 변경은 하지 않았다. 크레딧 잔액은 시작 1,100, 끝 1,195였다(중간에 계정 쪽 보충이 있었음).

1. **라이선스를 비공개(Private)로 바꾼 것을 화면에서 확인한 뒤** 두두 이미지를 올렸다.
2. Image to 3D, Meshy 7.1, 멀티뷰(메인=정면, 왼쪽=측면, 뒤=후면, 오른쪽 비움), 울트라 2K, A-포즈, 이미지 향상. 후보 1개 생성(25크레딧). 원화의 둥근 머리·종 모양 망토·짧은 다리를 잘 따랐다.
3. Remesh: 고정 10K, 사각형 면(0크레딧) → 10,007면.
4. Texture(각 10크레딧) 3회 비교: A 멀티뷰(뒷머리에 얼굴 같은 자국), **B 정면만(채택: 얼굴·흉장이 가장 깨끗함)**, C 정면+후면(망토에 흰 얼룩). B의 한계: 망토 겉이 원화의 청록이 아니라 연두, 뒷머리 줄무늬가 원화의 좌우 짝 줄이 아니라 세로 한 줄.
5. Rigging: 이족 동물, 키 1.3m, 관절 마커는 자동 위치에서 무릎만 조금 내림.
6. 동작(프리셋 추가는 크레딧 변화 없음): 걷기, 객체 수집, 행복한 흔들림 서 있기, 듣기 제스처, 동기 응원, 양주먹 펀치, 정규 점프, 왼손을 힙에 얹고 이야기하기, 한 손 흔들기, 행복한 점프, Mage Spell Cast 3. `Idle_14`는 카메라 반대쪽으로 돌아서서 뺐다.
7. 다운로드: GLB, Mixamo 뼈대, 모든 동작 단일 파일(13.5MB) → `meshy_output/v2/`(Git 제외).
8. 웹용 변환: `tools/build_dudu.mjs`(텍스처 1024 WebP, 키프레임 정리, 정리, 양자화) → **`public/assets/dudu/dudu.glb` 2.62MB**, 20,012삼각형, 뼈 28개, 동작 11개. 다시 만들 때는 임시 폴더에서 `npm install @gltf-transform/cli@4` 후 `node build_dudu.mjs <입력> <출력> Running`처럼 실행한다.

앱 연결: `src/tiger/DuduCharacter.tsx`가 GLB를 읽고, 동작 이름 대응은 `src/tiger/duduClips.ts`에 있다. 불러오는 중이거나 실패하면 절차형 모델을 보여 준다. 사람의 최종 원화 충실도 승인과 저사양 휴대폰 성능 측정은 아직 하지 않았다.

## 2026-10-04 Blender 텍스처 보정 (Claude)

Blender 4.5.14 LTS 휴대용판을 `C:\Users\kor02\Tools\blender-4.5.14-windows-x64`에 설치했다(체크섬 확인, 관리자 권한 없음). 형태·뼈대·동작은 바꾸지 않고 기본색 텍스처만 고쳤다.

- `tools/repaint_texture.py`(Blender에서 실행): UV 삼각형을 래스터화해 텍셀마다 3D 위치·법선·머리 뼈 가중치를 구한다. 몸통 축에서 바깥을 향하면 망토 겉, 안을 향하면 안감으로 나눈다. 겉은 청록 `(50,117,100)`, 안은 연두 `(121,181,72)`로 칠하고 원래 밝기 비율로 주름 명암을 남긴다(원화에서 잰 색). 가슴 흉장의 초록은 제외한다.
- 뒷머리는 원화 후면처럼 가운데가 빈 좌우 짝 가로줄 네 쌍으로 다시 그리고, 옆머리 쪽으로 갈수록 기존 텍스처와 섞는다. 귀 뒷면은 어두운 회색 `(54,54,54)`.
- `tools/inject_basecolor.mjs`로 원본 GLB의 기본색 이미지만 바꾼 뒤 `tools/build_dudu.mjs`로 웹용 GLB를 만든다(2.63MB).
- 다시 실행: `blender -b --factory-startup --python tools/repaint_texture.py -- <원본.glb> work/repaint` → `node inject_basecolor.mjs <원본.glb> work/repaint/basecolor.png <중간.glb>` → `node build_dudu.mjs <중간.glb> <출력.glb> Running`. 확인용 영역 그림은 `work/repaint/mask.png`, 구조 요약은 `tools/analyze_texture.py`.

텍스처의 22%(망토·뒷머리·귀)만 바뀌고 나머지 텍셀은 원본과 같음을 비교로 확인했다. 결과: [4방향](../../docs/handoff/dudu_2026-10-03/screenshots/claude_meshy_dudu_repainted_4views.png).

## 2026-10-04 스카프 색 보정 (Claude)

원화(공식 2D·조형 도면)에서 스카프는 망토 겉과 같은 청록이다(2D 원화에서 잰 값: 스카프 `5,127,106`, 망토 겉 `0,133,105`). Meshy 텍스처의 스카프는 짙은 초록으로 남아 있었다.

- 원인: 앞 매듭이 가슴 흉장 제외 구역 안에 있고, 스카프 텍셀은 채도가 낮아 기존 망토 판정(채도 0.12 초과)에 걸리지 않았다. 자동 리그가 스카프 앞쪽에 머리 뼈 가중치(0.66~0.81)를 주어 머리 가중치로 거를 수도 없었다.
- `tools/repaint_texture.py`에 스카프 단계를 더했다. 느슨한 초록 기준(채도 0.035 초과) + 높이 0.54 이상(흉장 초록은 0.52 이하) + 목 축에서 0.222 이내(앞 매듭 95백분위 + 0.015) + 이미 망토로 칠하지 않은 텍셀. 망토 겉 색 `(50,117,100)`에 자기 밝기 비율(0.55~1.3)을 곱해 매듭·주름·외곽선 명암을 남긴다. 2048 텍스처에서 31,924텍셀.
- 다시 만들기: 위 Blender 보정과 같은 세 단계(`repaint_texture.py` → `inject_basecolor.mjs` → `build_dudu.mjs ... Running`). 입력은 `meshy_output/v2/Meshy_AI_Emerald_Tiger_Mascot_All_Animations.glb`(13,453,200바이트, SHA-256 `cea385768bb37837…`).
- 결과 `public/assets/dudu/dudu.glb` 2,636,740바이트(SHA-256 `c728af5bca84c45c…`). 이전 웹 GLB와 기본색 텍스처를 비교하면 크게 바뀐 텍셀(차이 30 초과)은 1.31%이고 스카프 자리에만 있다. 망토·뒷머리 보정은 그대로다. 나머지 5.6%의 작은 차이는 WebP 재압축 오차다.

## 2026-10-04 코드로 더한 꼬리·표정·동작 보정 (Claude)

모델 파일의 형태·뼈대·동작 파일은 바꾸지 않고 `src/tiger`에서 더했다. 자세한 내용과 전후 화면은 [인계 기록](../../docs/handoff/CLAUDE_DUDU_3D_POLISH_2026-10-04.md).

- 꼬리(`src/tiger/duduTail.ts`): 모델에 꼬리가 없다. 줄무늬 관을 엉덩이 뼈에 붙였다. 망토 아래쪽이 허벅지 뼈를 따라 몸에 붙어 있어 등 가운데가 아니라 왼쪽 엉덩이 옆에서 망토 앞 가장자리 밖으로 나와 위로 말린다.
- 표정(`src/tiger/duduFace.ts`): 눈·입은 텍스처에 그려져 있고 셰이프 키가 없다. 얼굴 곡면을 따르는 덧그림(감은 눈 ‿, 웃는 눈 ∩, 벌린 입·혀)을 머리 뼈에 붙였다. 위치는 원본 GLB 얼굴 텍셀을 Blender에서 3D로 펼쳐 잰 값(눈 중심 Blender `(-0.112,-0.300,0.977)`·`(0.110,-0.300,0.978)` m, 크기 0.045×0.072 m, 입선 가운데 아래 끝 `(-0.002,-0.313,0.831)` m)을 앱 좌표로 옮겼다.
- 동작(`src/tiger/duduMotion.ts`): 사람 비율 프리셋이 두두 몸에 맞지 않는 부분을 불러온 뒤 보정한다. 엉덩이 수평 이동 0.3 이하(펀치 0.88→0.3 등), 물건 줍기를 대기 자세와 45%로 섞기, 발이 쉬는 자세보다 내려가면 모델을 올리기.

## 화면 검토 도구 (`tools/review/`)

앱 의존성이 아니다. `build_dudu.mjs`처럼 임시 폴더에서 `npm install playwright-core sharp` 후 스크립트를 그 폴더로 복사해 실행한다. Edge가 설치되어 있어야 한다. 서버 주소는 `BASE`(기본 `http://127.0.0.1:5173`).

| 스크립트 | 하는 일 |
|---|---|
| `capture_review.mjs` | `/dudu-review.html`을 동작별로 촬영. `&close`·`&face`·`&lower`·`&still`·`&expr=closed\|happy\|talk` |
| `check_still.mjs` | 빛의 마법 검토 화면에서 두두 영역의 픽셀 변화로 정지 규칙 확인(듣기 자세 0이어야 함) |
| `check_scenes.mjs` | 홈·빛의 마법(검토 화면·실제 활동)을 1280·390 폭으로 촬영하고 가로 넘침 확인. DEMO 서버 필요 |

다른 포트의 개발 서버를 쓸 때는 백엔드의 `CORS_ORIGINS`에 그 주소를 넣어야 DEMO 로그인이 된다(설정 파일은 바꾸지 않고 환경 변수로).

## 남은 다듬기 (Blender 또는 재텍스처)

~~망토 겉 청록·안 연두 구분, 뒷머리 좌우 짝 줄무늬~~(2026-10-04 완료), ~~스카프 색~~(2026-10-04 완료), ~~꼬리·눈 깜박임·입 모양~~(2026-10-04 코드 덧붙임으로 대신함). 남은 것:

- 흉장 공식 형태 교체(텍스처의 흉장은 Meshy가 그린 근사).
- 스카프 매듭 형태: 원화는 매듭 아래로 두 끝이 늘어진다. 지금은 모델 형상의 네 잎 매듭을 그대로 쓰고 색만 바꿨다. 형상 수정은 Blender에서 메시·가중치를 고쳐 다시 내보내야 해서 이번에 하지 않았다.
- 입 모양 여러 개(닫힘·아·이·우·오·ㅅ, 로드맵 4절)는 아직 없다. 지금은 열림 정도 하나로 여닫는다. 발음 모양을 보여 주는 용도로 쓰면 안 된다.
- 꼬리를 모델 파일에 넣으려면 Blender에서 꼬리 메시·뼈를 만들고 11개 동작과 함께 다시 내보낸 뒤 동작 보존을 검사해야 한다.
