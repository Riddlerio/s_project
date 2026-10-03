# Speech Hero 디자인 레퍼런스 조사

작성일: 2026-10-04 · 범위: A~E · 저장소 파일은 수정하지 않음

**표기 규칙**
- **출처:** 출처가 실제로 말한 내용. 각 문장 끝의 `[n]`은 맨 아래 참고문헌 번호이고, 모든 번호에 URL이 있다.
- **제안:** 이 보고서 작성자의 의견. 출처가 그렇게 말한 것은 아니다.
- `(요약)`: 원문이 403 등으로 열리지 않아 검색 결과 요약에 기댄 항목. 실제로 적용하기 전에 원문을 다시 확인해야 한다.
- 전제: 모든 제안은 각 게임의 치료 과제와 라운드별 임상 파라미터(목표 지속시간, 단서 정책, 성공 규칙)를 바꾸지 않는다. 바꾸는 것은 연출뿐이다.

---

## A. 4~7세 아동용 게임 설계

### 출처
- **Toca Boca**는 아이를 "작은 어른이 아니라 한 사람"으로 존중하고, 놀이를 핵심 가치로 둔다 [1].
- **Sago Mini**는 "지시도, 따라야 할 규칙도 없는" 열린 놀이를 지향한다. 말이나 내레이션 없이 아이가 혼자서도 자신 있게 탐색할 수 있게 설계한다 [2].
- **Duolingo ABC 플레이테스트** 결과는 세 가지다 [3].
  - "문제 4~5개를 풀고, 재미 요소가 있는 다른 화면으로 넘어가는" 구조에서 미취학 아동의 몰입이 유지됐다.
  - 아이들은 이야기나 맥락이 있는 게임을 더 좋아했다.
  - 작은 손가락은 '탭'이 어렵다. 살짝 끌리기만 해도 입력이 인식되지 않았다.
- **Khan Academy Kids 평가 프로토타입**에서는 두 가지를 발견했다 [4].
  - 아이들이 몬스터를 눌러 소리를 듣느라 과제에 집중하지 못했다. 그래서 효과음은 빼고 캐릭터만 남겼다.
  - 탭은 무작위로 누르는 경향이 있었고, 드래그는 더 신중하게 했다.
- **Pokémon Smile**의 진행 방식은 다음과 같다 [5].
  - 카운트다운이 진행되는 동안 이를 닦으면 보라색 연기가 걷히고 포켓몬이 나타난다. 끝나면 포획, 메달, 꾸미기 아이템을 받는다.
  - 닦는 속도가 느려지면 "Don't slow down" 같은 문구가 뜬다.
  - 얼굴이 인식되지 않으면 화면과 소리가 즉시 **일시정지**된다.
  - 다음 세션까지 8시간 대기가 걸려 있다.
- **Amazon Alexa 아동 스킬 가이드**의 관련 내용은 세 가지다 [6].
  - 아이가 틀려도 응답이나 효과음을 가혹하게 만들지 말고 긍정 강화를 쓴다.
  - 생각할 시간에는 배경음을 깔고, **답할 준비가 되면 차임**으로 알린다.
  - "유효하지 않은 명령"이라고 말하는 대신 "이렇게 말해 볼 수 있어"로 다시 안내한다.
- **Celeste**는 코요테 타임이나 점프 버퍼링처럼 타이밍과 위치의 허용 범위를 넓힌다. 원문 표현은 "모든 것을 플레이어에게 조금 유리하게 얼버무린다"이다 [7].

### 음성 제어 게임 패턴 (출처)
| 게임 | 메커닉 | 교훈 |
|---|---|---|
| Yasuhati / Don't Stop! Eighth Note | 작게 소리 내면 이동하고, 크게 지르면 점프한다 [8] | 플레이어가 소리 지르기에 몰두하게 되고, 어렵다는 평이 많다 [9] |
| One Hand Clapping | 처음에 낮은 음과 높은 음을 불러 음역을 측정한 뒤, 모든 과제를 그 범위 안에서 낸다. 단순한 소리 내기에서 시작해 음높이 조절로 넘어간다 [10] | 개인별 보정과 단계적 도입 |
| Hey You, Pikachu! | 256단어 음성 인식을 쓴다. "예"를 "아니요"로 잘못 알아들어 재료를 먹어 버리기도 한다 [11] | 인식 오류가 그대로 게임 결과를 망친다 (반면교사) |
| Speech Blubs | 또래 아이 영상을 보고 따라 하는 비디오 모델링, 소리를 내면 화면 속 사건이 일어나는 구조, 얼굴 필터 [12] | 모델 제시 → 따라 하기 → 반응 |

### 제안
1. **라운드 = 시도 4~5회 + 짧은 쉬는 장면.** [3]의 결과와 우리의 5라운드 구조가 그대로 맞물린다.
2. **"네 차례" 신호를 세 겹으로 준다.**
   - 두두가 귀를 세우고 마이크 배지를 띄운다.
   - 짧은 차임을 울린다 [6].
   - 화면 가장자리에 빛 테두리를 두르고, 듣는 동안 배경음 볼륨을 낮춘다.
3. **NO_SPEECH와 UNCERTAIN은 '일시정지 + 다시 모델링'으로 처리한다** [5][6]. 실패 연출과 실패 효과음은 쓰지 않는다.
4. **볼륨을 보상에 연결하지 않는다.** Yasuhati식으로 하면 아이가 소리를 지르게 된다. 대신 지속성이나 안정성을 연출에 연결하고, 첫 세션에서 개인별 보정을 한다 [10].
5. **Celeste식 관대함은 화면 연출에만 적용한다.** 예를 들어 목표 지속시간의 90%에 도달하면 화면에서는 성공처럼 부드럽게 마무리한다. 그래도 **저장되는 측정값은 원본 그대로** 두어야 한다. 게임 점수는 임상 데이터가 아니다.
6. **효과음은 발화가 끝난 뒤에만 낸다.** 아이가 말하는 동안에는 화면 움직임을 최소로 줄인다 [4].

---

## B. 게임 필(juice)과 아트 디렉션

### 출처
- **Jan Willem Nijman, "The Art of Screenshake"** (INDIGO Classes 2013): Nuclear Throne에 쓴 손맛 기법 약 30가지를 소개한다 [13]. 이를 따라 해 본 개발자의 결과는 이렇다 [14].
  - 화면 흔들림은 "환상적"이었다.
  - 반동이나 넉백은 정밀한 조작감을 해쳐서 버렸다.
  - 결론: 기법은 골라서 써야 한다.
- **"Juice It or Lose It"** (Jonasson & Purho, GDC Europe 2012): 밋밋한 게임에 트윈, 스케일, 파티클 등을 무대 위에서 바로 더해 보인다 [15].
- **반론 "Don't Juice It or Lose It"** (Folmer Kelly): 과한 이펙트는 오히려 몰입을 떨어뜨린다 [16].
- **A Short Hike**:
  - 픽셀을 미학의 핵심으로 삼았다. 안티에일리어싱을 끄고, 셰이딩을 평평하고 일관되게 맞췄다 [17].
  - 픽셀 수가 적어도 사물이 읽히도록 **부드러운 외곽선**을 넣었다 [17].
  - 팔레트는 캐나다의 가을 숲에서 따왔고, 이전 프로젝트의 에셋을 다시 썼다 [18].
- **Duolingo 캐릭터 애니메이션** [19]:
  - Rive 상태 머신에서 포즈와 입 모양을 별도 레이어로 관리한다.
  - 캐릭터마다 입 모양이 20개 이상이다.
  - 음소 타이밍으로 상태를 전환하고, 눈 깜빡임과 끄덕임 같은 대기 동작과 정답·오답 반응을 넣는다.
- **접근성**: 화면의 25% 이상을 덮는 플래시가 1초에 3번 넘게 나오지 않게 한다 [20].
- **three.js 툰 셰이딩**: `MeshToonMaterial`의 `gradientMap`은 NearestFilter로 설정해야 한다 [21].
- **디자인 토큰 표준**: W3C 커뮤니티 그룹의 DTCG 포맷이 2025.10에 첫 안정판으로 나왔다 [22].

### 제안 (CSS · SVG · three.js)
1. **토큰 한 벌로 모든 화면을 맞춘다.**
   - 팔레트는 7색으로 한다. 두두 흰색, 줄무늬 남색, 대구대 계열 포인트색, 하늘색, 풀색, 크림색, 경고색은 쓰지 않는다.
   - DTCG JSON 하나에서 CSS 변수와 three.js `Color` 상수를 함께 만든다.
2. **3D 툰 셰이딩**: 모든 3D 오브젝트에 3단 `gradientMap`을 적용한다 [21]. 외곽선은 뒤집은 헐(inverted hull) 방식으로 1~2px만 준다. A Short Hike의 가독성 원칙을 따른 것이다.
3. **두두의 성공 리액션**: 스쿼시(1.12, 0.88)를 120ms, 오버슈트 복귀를 180ms로 준다. CSS 이징은 `cubic-bezier(.34,1.56,.64,1)`을 쓴다.
4. **화면 흔들림**은 라운드를 깰 때만 넣는다. 4px 이하, 150ms 이하로 하고, `prefers-reduced-motion`이 켜져 있으면 끈다 [23].
5. **몬스터 타격**에는 히트 스톱 대신 0.15초 슬로모션과 별가루 파티클(SVG)을 쓴다. 빔은 additive blending으로 그린다.
6. **juice 예산을 정한다.** 듣는 동안은 0, 발화 직후에는 중간, 라운드 클리어에는 최대로 한다. 이렇게 하면 [16]이 경고한 과잉과 [4]에서 본 주의 분산을 함께 피할 수 있다.

---

## C. 게임별 장면 아이디어 (과제 불변, 연출만 상승)

**공통 규칙 (제안)**
- 라운드가 올라가도 바뀌는 것은 배경, 시간대, 함께 나오는 캐릭터, 파티클 양뿐이다.
- 목표 지속시간, 음절 수, 단서 단계 같은 임상 파라미터는 치료사가 정한 값을 그대로 쓴다.
- 새로 등장하는 시각 요소는 발화하는 동안 움직이지 않게 한다 [4].

### 1. 빛의 마법 — /s/ 지속 마찰음과 음절 전환
- **참고 (출처)**
  - Pokémon Smile: 행동을 지속하면 연기가 서서히 걷힌다 [5].
  - Mega Man 4: 버튼을 누르고 있으면 샷이 충전되어 더 강해진다 [24](요약).
  - 젤다 몽환의 모래시계: 마이크에 숨을 불어 촛불을 끈다 [25](요약).
- **원리 (제안)**: "소리를 이어 가는 동안 무언가가 계속 차오르거나 걷힌다." /s/를 이어 가면 빛줄기가 논 위를 쓸며 안개를 걷어 낸다. 음절을 전환할 때마다 빔이 '탁' 하고 볏단을 하나씩 묶는다.
- **5라운드**: 아침 논 한 칸 → 참새가 오는 두 칸 → 해 질 녘 반딧불 → 바람에 흔들리는 들판 → 밤의 등불 축제(빔으로 등불 점화).

### 2. 하늘 오르기 — 발성 개시, 지속 발성, 쉼 후 재개
- **참고 (출처)**
  - One Hand Clapping: 소리를 내면 발판이 움직이고, 음역은 개인별로 보정한다 [10].
  - Yasuhati: 볼륨이 곧 조작이다. 반면교사로 삼는다 [8][9].
  - Celeste: 판정의 허용 범위를 넓힌다 [7].
- **원리 (제안)**
  - 소리를 내는 동안 두두의 열기구가 올라간다.
  - **쉬면 구름 쉼터에 내려앉는다.** 떨어지지 않는다.
  - 다시 소리를 내면 다시 떠오른다. 쉼은 실패가 아니라 체크포인트다.
  - 높이는 게임 점수일 뿐이며, 임상 화면에는 보이지 않는다.
- **5라운드**: 들판 → 나무 꼭대기 → 구름 바다 → 무지개 다리 → 별하늘(별자리 완성).

### 3. 몬스터 모험 — 음절 → 단어 → 그림 이름 대기 → 새 장면 → 구
- **참고 (출처)**
  - Bookworm Adventures: 단어가 길수록 공격이 세다 [26](요약).
  - Dave the Diver: 낮에 잠수해서 잡은 물고기가 밤에 초밥 재료가 되는 이중 루프. 캐릭터가 유머를 곁들여 튜토리얼 역할을 한다 [27].
  - Hey You, Pikachu!: 오인식이 결과를 망친 반면교사 [11].
- **원리 (제안)**
  - 발화 단위가 커질수록 주문이 화려해진다. 음절은 불씨 1개, 단어는 빔, 구는 무지개 빔이다.
  - 몬스터는 쓰러뜨리는 대신 **달래서 친구로 만들고 도감 스티커**를 받는다.
  - 치료사가 승인한 마법 빔만 강화 연출을 쓴다.
  - 판정이 UNCERTAIN이면 몬스터가 "응?" 하고 고개를 갸웃한다. 피해 연출은 없다.
- **5라운드**: 얕은 바다의 게 → 갯바위 문어 → 그림 카드 섬 → 산호 동굴(새 장면) → 참치 등장(구) → 참치 획득.

### 4. 두두와 소풍 — 선택, 요청, 구, 문장, 이야기
- **참고 (출처)**
  - Alexa 가이드: 선택지는 짧게, 차임으로 차례 알림, 다시 안내하기 [6].
  - PBS "Elinor Wonders Why" 대화형 영상: 대화 기회를 준 아이들이 즉시 평가에서 더 높은 점수를 받았고, 부모가 자발적으로 도왔다 [28].
  - Duolingo 립싱크 [19].
- **원리 (제안)**
  - 선택: 그림 2~3장 중 하나를 말로 고른다.
  - 요청: 숲속 친구가 "뭐 줄까?" 하고 묻는다.
  - 구와 문장: 말할 때마다 바구니가 채워진다.
  - 이야기: 소풍 사진첩을 넘기며 이야기한다.
  - 두두의 입 모양은 TTS 음소 타이밍에 맞춘다.
- **5라운드**: 돗자리 펴기 → 도시락 나누기 → 친구 초대 → 소나기와 무지개 → 노을 사진첩.

**에피소드 루프 (제안)**: 지도 → 게임 → 재료 → 제작 → 이야기의 흐름은 Dave the Diver의 '채집 → 요리' 루프와 구조가 같다 [27]. 초밥 만들기는 말하기 부담이 없는 쉬는 장면으로 두고, 탭 대신 드래그로 조작하게 한다 [4].

---

## D. 치료사·교사 대시보드

### 출처
| 제품 | 보여 주는 것 |
|---|---|
| Constant Therapy | 날짜 범위별 **기준선 대비 최근 수행**(정확도, 반응 지연, 사용한 단서 유형). 문항별 정오답, 문항별 지연, 문항 스크린샷. 클리닉 세션과 가정 세션을 나눈 달력. 일일 세션 노트, 경과 노트, 종결 요약을 EMR에 복사해 붙일 수 있는 형식으로 제공 [29] |
| Articulation Station | **정반응, 근사, 오반응** 3분류. 목표음별 그래프, 세션 상세, 녹음 재생. "세션 중이나 세션 후에 채점" 가능 [30] |
| Speech Blubs Pro | 학생별 진행 리포트를 PDF로 저장, 실시간 모니터링 [31](요약) |
| Khan Academy Kids | 'Assignments' 리포트와 'All Progress' 리포트를 분리. 리포트 화면에서 바로 과제를 배정 [32](요약) |
| Duolingo for Schools | 획득 XP, 학습 시간, 최근 과제처럼 참여 지표 위주 [33](요약) |
| FDA 임상 의사결정 지원(CDS) 지침 기준 4 | 전문가가 추천의 **근거를 독립적으로 검토**할 수 있어야 한다. 입력, 로직, 알려진 것과 모르는 것을 제공해야 하며, 2026 개정판은 정보 과부하를 피하고 결정에 필요한 정보를 먼저 보여 주라고 강조한다 [34](법률사무소 요약) |
| 아동 음성 인식 | 아동 발화는 컴퓨터 인식에 고유한 어려움이 있다 [35] |

### 제안
- **세션 타임라인**
  - 라운드를 가로 띠로 놓고, 시도 하나를 점 하나로 표시한다.
  - 점의 모양으로 provenance(AI 추정, 시스템 측정, 치료사 확인)를 구분한다.
  - 점을 클릭하면 오디오 재생, 파형, AI 관찰 내용, Accept / Modify / Reject 버튼이 나온다 [30].
- **목표별 추이**: 기준선과 최근 값을 비교하고, 그 위에 **단서 단계**를 겹쳐 보여 준다 [29]. 같은 정확도라도 단서가 있었는지에 따라 해석이 달라지기 때문이다.
- **데이터 품질 플래그**
  - 플래그 종류: NO_SPEECH, UNCERTAIN, 잡음이나 클리핑, 마이크 변경, 가정/클리닉 구분 [29].
  - 플래그가 붙은 시도는 성공률 분모에서 빠졌다는 표시를 붙인다.
  - 아동 음성 인식이 어렵다는 점 [35]을 화면 안에 고지한다.
- **"결정이 아닌 결정 지원"**
  - AI 추천 카드마다 근거(입력 오디오, 측정값, 적용 규칙, 한계)를 펼쳐 볼 수 있게 한다 [34].
  - 추천은 치료사가 선택한 뒤에만 반영한다.
  - 게임 점수(빔 파워, 높이)는 이 화면에 표시하지 않는다.
- **기록 출력**: 일일 세션 노트 형식 [29]으로 바우처나 차트에 복사해 붙일 수 있는 텍스트를 만든다.

---

## E. 3D 마스코트 파이프라인 (2D 턴어라운드 → 웹용 glTF)

### 생성기 비교 (출처)
| 도구 | 멀티뷰 입력 | 토폴로지 / 리깅 | 가격 / 라이선스 / 업로드 조건 | 실행 환경 |
|---|---|---|---|---|
| **Meshy** | 메인 1장 + 추가 3장. Meshy 7, Pro 이상에서만 가능. 정면도 시트는 뷰별로 잘라 올리고 배경과 비율을 맞추라고 안내. Smart Topology와 함께 쓸 수 없음 [36] | 리메시 후 리깅을 권장. 휴머노이드와 사족 리깅 지원. **얼굴 리그는 없어** Blender에서 직접 해야 함. FBX 출력 [39] | Free는 월 100크레딧에 CC BY 4.0 공개, Pro는 월 1,000크레딧에 비공개 [38]. **엔터프라이즈가 아닌 고객의 입력과 출력을 학습에 쓸 수 있음.** 만 14세 이상 [37] | 클라우드 |
| **Tripo** | 멀티뷰 기본 지원. 쿼드 메시는 FBX로 강제 출력. smart low-poly는 10크레딧 추가 [40] | 리깅 API는 biped, quadruped 등 7종. glb와 fbx 출력. 먼저 rig-check를 돌려야 함 [41] | 무료는 공개(CC BY), 유료는 비공개이며 학습에 쓰지 않음 [42](요약) | 클라우드 |
| **Rodin (Hyper3D)** | Creator(월 $30, 연 결제 시 월 $24)부터 다중 이미지 지원 [43] | 고폴리 쿼드는 Business(월 $120)부터 [43]. 리깅은 확인하지 못함 | Free는 비공개 에셋 10개, 크레딧당 $1.5 [43] | 클라우드 |
| **Hunyuan3D-2 / 2.1** | 2mv가 멀티뷰 지원, 0.6B mini 모델 있음 [44] | — | **라이선스 적용 지역에서 EU, 영국, 한국이 제외됨** [44][45] | 2.0: 형상 6GB, 형상+텍스처 16GB [44]. 2.1: 합계 29GB [45]. 2GP 포크는 6GB 프로필 제공 [46] |
| **TRELLIS / TRELLIS.2** | 학습 없이 쓰는 다중 이미지 조건 입력 [47] | GLB 출력 [47] | 대부분 MIT [47]. TRELLIS.2가 쓰는 nvdiffrast는 **비상업 라이선스** [48][49] | 16GB 필요, Linux에서만 테스트됨 [47]. TRELLIS.2는 24GB [48] |

### 우리 환경에서의 판단 (제안)
- **로컬 생성은 하지 않는다.**
  - RTX 3070 Ti 8GB로는 TRELLIS의 공식 요구사항(16GB)에 못 미친다.
  - Hunyuan은 한국이 라이선스 지역에서 빠져 있어 성능과 상관없이 쓸 수 없다.
  - 디스크 여유도 거의 없다.
- **클라우드 유료 플랜의 비공개 모드를 쓴다.** 무료 플랜에서는 결과물이 공개된다.
- **업로드 전 권리 확인**: 두두는 대구대학교 공식 캐릭터다. 입력을 학습에 쓸 수 있는 약관 [37]이 있으므로, 올리기 전에 **대학 권리자의 서면 허락**을 받아야 한다.

### Blender 정리 단계
1. **리메시와 감축** (제안): 대칭을 맞추고 모바일 웹 기준 1~2만 삼각형까지 줄인다.
2. **UV와 베이크** (제안): 고폴리의 노멀과 색을 저폴리에 베이크한다. 줄무늬는 텍스처에 그리고, 팔레트는 토큰 색을 그대로 쓴다.
3. **털 표현**
   - 출처: 셸 기법은 메시 여러 겹을 쌓고 픽셀을 버리는 방식이라 정점 증가는 적지만 픽셀 비용이 든다 [50].
   - 제안: 모바일에서는 털결을 손으로 그린 텍스처에 실루엣 가장자리의 털 뭉치 지오메트리를 더하는 정도로 충분하다. 셸 기법은 클로즈업 장면에서만 쓴다.
4. **리깅**
   - 출처: Mixamo는 이족 휴머노이드 전용이다. 꼬리처럼 큰 부속물이 있으면 제약이 있다 [51](요약).
   - 출처: AccuRIG은 무료지만 Windows에서만 돌고, 이족 전용이며, ActorCore 계정이 필요하다 [52].
   - 출처: Rigify에는 Human, Cat, Wolf 등 메타리그가 있다 [53](요약).
   - 제안: Meshy나 Tripo로 자동 리깅한 뒤, Blender에서 꼬리 체인과 귀 본을 추가한다.
5. **셰이프 키**
   - 출처: Duolingo는 입 모양을 20개 이상 쓴다 [19].
   - 제안: 우리는 깜빡임 1개와 입 모양 6개(닫힘, 아, 이, 우, 오, 'ㅅ'에서 이가 보이는 모양)로 시작한다. 상대 셰이프 키는 glTF의 morph target으로 내보내진다 [54](요약).
6. **웹 내보내기**
   - 출처: gltf-transform의 `optimize`로 한 번에 최적화한다. meshopt는 지오메트리와 **애니메이션**을 함께 압축하고, Draco는 지오메트리만 압축한다. KTX2는 `etc1s`와 `uastc` 중에서 고른다 [55].
   - 출처: PNG는 다운로드 용량이 작아도 GPU 메모리를 많이 쓴다. 4096² 텍스처에 밉맵을 더하면 약 90MB다. ETC1S는 색 텍스처에, UASTC는 노멀맵에 맞다 [56].
   - 예시 명령:
     ```
     gltf-transform optimize dudu.glb dudu.opt.glb --compress meshopt --texture-compress webp
     ```
     최종본에서는 텍스처를 KTX2(etc1s/uastc)로 바꾸고, 로더에 `setMeshoptDecoder`와 KTX2Loader를 연결한다 [57](요약).
7. **three.js 블렌딩**
   - 출처: `crossFadeTo`로 동작을 교차 전환하고, `AdditiveAnimationBlendMode`로 동작을 겹치고, `LoopOnce`와 `clampWhenFinished`로 일회성 반응을 처리한다 [58].
   - 제안: idle 동작 위에 '듣기'(귀 쫑긋)를 additive로 겹친다. 성공·격려 반응은 `LoopOnce`로 재생한 뒤 idle로 0.25초 교차 전환한다.

---

## 우리 프로젝트에 바로 적용할 것 Top 10
1. **"네 차례" 신호를 하나로 통일한다**: 두두의 귀 쫑긋 + 차임 + 화면 가장자리 빛 + 배경음 낮추기. 4개 게임에 똑같이 쓴다 [6].
2. **NO_SPEECH와 UNCERTAIN은 일시정지 후 다시 모델링한다.** 실패 연출은 없다 [5][6].
3. **볼륨을 보상에 쓰지 않는다.** 지속성과 안정성을 연출에 연결하고, 첫 세션에 개인별 보정을 한다 [8][10].
4. **라운드는 시도 4~5회와 쉬는 장면으로 구성한다** [3]. 초밥 제작이 그 쉬는 장면이다.
5. **juice 예산을 정한다**: 듣는 동안 0, 발화 직후 중간, 라운드 클리어에 최대 [4][16]. `prefers-reduced-motion`을 반영하고 플래시는 1초 3회 미만으로 한다 [20][23].
6. **DTCG 토큰 → CSS 변수 + three.js 상수**를 만들고, `MeshToonMaterial` 3단 그라디언트와 얇은 외곽선으로 스타일을 통일한다 [21][22].
7. **치료사 화면에 시도별 오디오 + 근사 분류 + Accept/Modify/Reject 타임라인**을 둔다 [29][30][34].
8. **목표별 추이에 단서 단계를 겹치고**, 데이터 품질 플래그와 분모 제외 표시를 붙인다 [29][35].
9. **3D 생성은 클라우드 유료 플랜의 비공개 모드로만** 한다. Hunyuan은 쓰지 않는다(한국 제외). 업로드 전에 대구대의 서면 허락을 받는다 [37][44].
10. **GLB 파이프라인**: 리메시 → 자동 리깅 → Blender에서 꼬리·귀 본과 셰이프 키 7개 추가 → meshopt + KTX2 → additive 듣기 레이어 [39][55][56][58].

---

## 참고문헌
1. https://www.tocaboca.com/about
2. https://sagomini.com/article/sago-mini-letter-to-parents/
3. https://www.thegiantroom.com/blog/05/31/2023/report-duolingoabc-playtesting-session
4. https://blog.khanacademy.org/prototyping-playful-and-nimble-pre-k-assessments/
5. https://blog.animationstudies.org/this-is-the-way-we-brush-our-teeth-how-pokemon-smile-helps-children-learn-practical-skills/
6. https://developer.amazon.com/en-US/blogs/alexa/post/38e7a87d-2ba2-465a-b038-65ac9576027d/10-more-tips-for-building-stellar-alexa-skills-for-kid
7. https://www.maddymakesgames.com/articles/celeste_and_forgiveness/index.html
8. https://pitchpilotgame.com/blog/voice-controlled-mobile-games/
9. https://www.vice.com/en/article/hilarious-frustrating-voice-controlled-iphone-game/
10. https://www.gamespew.com/2021/12/one-hand-clapping-impressions/
11. https://en.wikipedia.org/wiki/Hey_You,_Pikachu! · https://tvtropes.org/pmwiki/pmwiki.php/YMMV/HeyYouPikachu
12. https://speechblubs.com/ · https://speechblubs.com/blog/helping-your-toddler-speak-through-imitation-therapy
13. https://archive.org/details/the-art-of-screenshake
14. https://www.bluetengu.com/2014/12/12/art-of-screenshake-experiments/
15. https://www.gdcvault.com/play/1016487/juice-it-or-lose
16. https://www.gamedeveloper.com/design/video-indies-resist-the-urge-to-juice-it-or-lose-it-
17. https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/
18. https://www.gamedeveloper.com/design/finding-smart-shortcuts-in-a-short-hike-postmortem-unlocking-the-vault-4
19. https://blog.duolingo.com/world-character-visemes
20. https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/
21. https://threejs.org/docs/pages/MeshToonMaterial.html
22. https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
23. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
24. https://en.wikipedia.org/wiki/Mega_Man_4
25. https://www.zeldadungeon.net/phantom-hourglass-walkthrough/temple-of-fire/
26. https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/BookwormAdventures
27. https://www.invenglobal.com/articles/18786/gdc24-blending-humor-and-gameplay-insights-from-dave-the-divers-session
28. https://par.nsf.gov/biblio/10346104
29. https://constanttherapyhealth.com/brainwire/constant-therapy-clinician-web-dashboard-guide/
30. https://www.littlebeespeech.com/articulation-station-hive
31. https://apps.apple.com/us/app/speech-blubs-pro-made-for-slps/id1669028733
32. https://khankids.zendesk.com/hc/en-us/articles/360041862972-All-about-Teacher-Tools-in-Khan-Academy-Kids
33. https://duolingoschools.zendesk.com/hc/en-us/articles/6830454446093-What-is-Duolingo-for-Schools
34. https://www.cov.com/en/news-and-insights/insights/2026/01/5-key-takeaways-from-fdas-revised-clinical-decision-support-cds-software-guidance
35. https://www.isca-archive.org/slate_2007/russell07_slate.pdf (Russell, "Challenges for computer recognition of children's speech", SLaTE 2007)
36. https://help.meshy.ai/en/articles/12634481-how-to-use-multi-view
37. https://www.meshy.ai/terms-of-use
38. https://www.meshy.ai/pricing
39. https://docs.meshy.ai/en/webapp/guides/3d-model/rigging
40. https://developers.tripo3d.ai/en/models/v3-1
41. https://developers.tripo3d.ai/en/docs/animations-rig
42. https://www.tripo3d.ai/help/privacy-policy/how-to-understand-data-privacy-and-ai-training-at-tripo
43. https://hyper3d.ai/pricing
44. https://github.com/Tencent-Hunyuan/Hunyuan3D-2 · https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/LICENSE
45. https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1 · https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE
46. https://github.com/deepbeepmeep/Hunyuan3D-2GP
47. https://github.com/microsoft/TRELLIS
48. https://github.com/microsoft/TRELLIS.2
49. https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt
50. https://queenofsquiggles.github.io/tech/shell-fur-breakdown/
51. https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
52. https://www.cgchannel.com/2025/07/rig-and-animate-3d-characters-for-free-with-accurig-2-0/
53. https://docs.blender.org/manual/en/2.81/addons/rigging/rigify.html
54. https://github.com/funwithtriangles/blender-to-threejs-export-guide
55. https://gltf-transform.dev/cli
56. https://www.donmccurdy.com/2024/02/11/web-texture-formats/
57. https://threejs.org/docs/pages/GLTFLoader.html · https://threejs.org/docs/pages/KTX2Loader.html
58. https://threejs.org/docs/pages/AnimationAction.html
