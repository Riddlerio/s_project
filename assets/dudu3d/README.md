# 두두 3D 제작 자료

기존 결정(2026-10-04): 두두 최종 모델은 **Meshy Pro 웹에서 비공개 생성 → Blender 정리·리그 → GLB**로 만든다. 대구대학교 사용 허락은 사용자가 확인했다. 전체 계획은 [로드맵 4절](../../docs/ROADMAP.md)에 있다.

추가 결정(2026-10-04): **먼저 무료로 미리보기를 확인한 뒤 유료 사용 여부를 결정한다.** 구독·결제·크레딧 추가 구매는 승인하지 않았다. 현재 게임의 코드 기반 두두 모델은 계속 사용하며, 무료 체험 결과를 최종 모델로 연결하지 않는다.

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

## 다운로드 이후 (Codex / Blender)

Blender에서 대칭·감축·UV·줄무늬 텍스처·흉장 교체를 한다. 리그에 꼬리·귀·망토 본과 표정(깜박임, 입 모양 6개)을 추가하고 17개 동작 클립을 제작한다. 최종 GLB의 삼각형 수·텍스처·파일 크기와 실제 휴대폰 성능을 검수한 뒤 `public/assets/dudu/`로 배치한다. GLTFLoader 및 압축 디코더 도입은 별도 사용자 승인 후 진행한다.

**공간 확인:** 2026-10-04 확인 시 C 드라이브 여유 공간은 약 **0.68GB**다. 웹 미리보기는 Blender 설치 없이 가능하지만, 로컬 Blender 제작 전에 기존 프로젝트 전제인 **최소 5GB**를 확보한다. 파일·캐시 삭제나 다른 드라이브 이동은 대상 확인과 사용자 승인 없이 하지 않는다.

**실행 기록:** 입력 이미지 존재와 다운로드 폴더의 Git 제외 설정은 확인했다. Meshy 웹 화면과 입력 폴더를 열었지만 **로그인·생성·결제·업로드·다운로드는 아직 수행하지 않았다.** 실제 실행 결과만 이후에 기록한다.
