import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { MathUtils, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import type { HoyaAction } from '../../control/speechGameSignal'
import { DuduCharacter } from '../../tiger/DuduCharacter'
import { canUseWebGL, HoyaErrorBoundary, HoyaFallback } from '../../tiger/Hoya3D'
import { STRIPES } from './crossingFlow'
import { DaeguGate } from './DaeguGate'
import { beatPhase } from './rhythm'

/*
 * '대구대 건너기' 3D 장면. 흰 줄 10개의 횡단보도(초록불)를 두두가 한 줄씩 폴짝 건너 대구대 정문까지 간다.
 * 지나온 줄은 금빛으로 남고, 내려앉을 때 빛 고리와 반짝이가 한 번 퍼진다(화면 연출, 서버 결과를 따름).
 * 차는 넣지 않는다(위험 연출 없음). 카메라는 두두를 따라 옆으로 움직인다. 판정은 화면이 아니라 서버 결과를 따른다.
 */
export const STRIPE_PITCH = 1.2
const DUDU_SCALE = 0.42
const FLOOR_Y = -2.03 // DuduCharacter의 발바닥 높이(fit 좌표)
const HOP_MS = 650
const GATE_X = (STRIPES + 1.4) * STRIPE_PITCH

/** 두두가 서는 x: 0은 출발 인도, k는 k번째 흰 줄. */
export const stripeX = (stripe: number) => stripe * STRIPE_PITCH

/** 동글동글한 나무(겹친 잎 덩어리 셋 + 짧은 줄기). 생성 그림(카드·배경)의 나무 모양과 맞춘다. */
const LEAF = ['#5fb65a', '#6fc766', '#4ea452', '#7ccf6a']
function RoundTree({ x, z, size, tone }: { x: number; z: number; size: number; tone: number }) {
  const leaf = (k: number) => LEAF[(tone + k) % LEAF.length]
  return <group position={[x, 0, z]} scale={size}>
    <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.1, 0.15, 0.84, 10]} /><meshStandardMaterial color="#8a6243" roughness={0.9} /></mesh>
    <mesh position={[0, 1.22, 0]}><sphereGeometry args={[0.6, 22, 16]} /><meshStandardMaterial color={leaf(0)} roughness={0.7} /></mesh>
    <mesh position={[-0.4, 0.98, 0.1]}><sphereGeometry args={[0.42, 18, 14]} /><meshStandardMaterial color={leaf(1)} roughness={0.7} /></mesh>
    <mesh position={[0.38, 1.02, -0.06]}><sphereGeometry args={[0.45, 18, 14]} /><meshStandardMaterial color={leaf(2)} roughness={0.7} /></mesh>
    <mesh position={[0.08, 1.62, 0.12]}><sphereGeometry args={[0.32, 16, 12]} /><meshStandardMaterial color={leaf(3)} roughness={0.7} /></mesh>
  </group>
}

/** 인도 가장자리의 작은 덤불과 꽃(둥근 덩어리). */
function Bush({ x, z, tone }: { x: number; z: number; tone: number }) {
  return <group position={[x, 0, z]}>
    <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.28, 14, 10]} /><meshStandardMaterial color={LEAF[tone % LEAF.length]} roughness={0.8} /></mesh>
    <mesh position={[0.24, 0.16, 0.05]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color={LEAF[(tone + 1) % LEAF.length]} roughness={0.8} /></mesh>
    <mesh position={[0.06, 0.4, 0.12]}><sphereGeometry args={[0.06, 8, 6]} /><meshStandardMaterial color={tone % 2 ? '#ffd166' : '#ff9fb3'} roughness={0.5} /></mesh>
  </group>
}

function Street({ crossed }: { crossed: number }) {
  const trees = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: -3 + i * 2.6, z: -4.2 - (i % 3) * 0.7, size: 0.95 + (i % 4) * 0.12 })), [])
  // 길 건너편(정문 쪽 아님) 인도 뒤 덤불: 횡단보도 양옆 잔디에 띄엄띄엄
  const bushes = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: -2.6 + i * 1.7, z: (i % 2 ? -2.05 : 2.05) + (i % 3) * 0.12 })), [])
  // 세로로 긴 화면(휴대폰)은 옆 시야가 좁아 신호등이 가장자리에서 잘린다: 조금 안쪽·뒤로 옮긴다.
  const narrow = useThree(state => state.size.width < state.size.height * 0.9)
  return <group>
    {/* 도로·인도·잔디 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, -0.01, 0]}><planeGeometry args={[60, 30]} /><meshStandardMaterial color="#a9d59b" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[stripeX(STRIPES) / 2 + 0.6, 0, 0]}><planeGeometry args={[stripeX(STRIPES) + 1.2, 3.2]} /><meshStandardMaterial color="#5d6468" roughness={0.95} /></mesh>
    <mesh position={[-1.2, 0.06, 0]}><boxGeometry args={[2.6, 0.12, 3.6]} /><meshStandardMaterial color="#d9d6cf" /></mesh>
    <mesh position={[GATE_X - 0.4, 0.06, 0]}><boxGeometry args={[3.4, 0.12, 3.6]} /><meshStandardMaterial color="#d9d6cf" /></mesh>
    {/* 흰 줄 10개. 두두가 지나온 줄은 은은한 금빛(지나온 길) */}
    {Array.from({ length: STRIPES }, (_, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[stripeX(i + 1), 0.012, 0]}><planeGeometry args={[0.62, 2.8]} />
      {i < crossed ? <meshStandardMaterial color="#ffeeb0" emissive="#ffd66b" emissiveIntensity={0.28} roughness={0.6} /> : <meshStandardMaterial color="#f7f7f2" roughness={0.7} />}</mesh>)}
    {/* 출발 쪽 초록 신호등 */}
    <group position={narrow ? [-1.25, 0, -2.6] : [-1.8, 0, -1.5]}>
      <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.06, 0.06, 2.2, 10]} /><meshStandardMaterial color="#3d4447" /></mesh>
      <mesh position={[0, 2.35, 0]}><boxGeometry args={[0.36, 0.6, 0.28]} /><meshStandardMaterial color="#2c3133" /></mesh>
      <mesh position={[0, 2.22, 0.15]}><circleGeometry args={[0.11, 20]} /><meshStandardMaterial color="#47e07a" emissive="#2fbf5d" emissiveIntensity={0.9} /></mesh>
    </group>
    {/* 뒤쪽 나무: 동글동글한 잎(생성 그림과 같은 모양) */}
    {trees.map((tree, i) => <RoundTree key={i} x={tree.x} z={tree.z} size={tree.size} tone={i} />)}
    {/* 길가 덤불과 작은 꽃 */}
    {bushes.map((bush, i) => <Bush key={i} x={bush.x} z={bush.z} tone={i} />)}
    {/* 대구대학교 정문: 문 가운데(보 아래)가 도착 자리 앞에 오게 둔다 */}
    <DaeguGate position={[GATE_X - 0.1, 0, -2.75]} />
  </group>
}

const RIPPLE_MS = 750
const SPARKS = Array.from({ length: 10 }, (_, i) => ({ angle: (i / 10) * Math.PI * 2 + (i % 2) * 0.3, speed: 0.55 + (i % 3) * 0.18, rise: 0.9 + (i % 4) * 0.25 }))

/** 두두가 새 줄에 내려앉는 순간: 줄 위로 퍼지는 빛 고리와 위로 흩어지는 반짝이(한 번, 움직임 줄이기에서는 없음). */
function LandingFx({ stripe, animate }: { stripe: number; animate: boolean }) {
  const ring = useRef<Mesh>(null)
  const sparks = useRef<(Mesh | null)[]>([])
  const landing = useRef<{ at: number; x: number } | null>(null)
  const previous = useRef(stripe)
  useEffect(() => {
    // 앞으로 한 줄 이상 갔을 때만(출발·도착 자리는 흰 줄이 아님). 폴짝 뛰기가 끝날 즈음 시작한다.
    if (animate && stripe > previous.current && stripe <= STRIPES) landing.current = { at: performance.now() + HOP_MS * 0.85, x: stripeX(stripe) }
    previous.current = stripe
  }, [stripe, animate])
  useFrame(() => {
    const fx = landing.current
    const t = fx ? (performance.now() - fx.at) / RIPPLE_MS : -1
    const visible = t >= 0 && t <= 1
    if (ring.current) {
      ring.current.visible = visible
      if (visible && fx) {
        ring.current.position.x = fx.x
        ring.current.scale.setScalar(0.4 + t * 1.6)
        ;(ring.current.material as MeshStandardMaterial).opacity = 0.85 * (1 - t)
      }
    }
    sparks.current.forEach((spark, i) => {
      if (!spark) return
      spark.visible = visible
      if (!visible || !fx) return
      const { angle, speed, rise } = SPARKS[i]
      spark.position.set(fx.x + Math.cos(angle) * speed * t, 0.15 + rise * t - 0.6 * t * t, 0.2 + Math.sin(angle) * speed * t * 0.6)
      spark.scale.setScalar(0.09 * (1 - t * 0.7))
      spark.rotation.y = t * 6
      ;(spark.material as MeshStandardMaterial).opacity = 1 - t
    })
    if (t > 1) landing.current = null
  })
  return <group>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0.2]} visible={false}>
      <ringGeometry args={[0.55, 0.72, 48]} />
      <meshStandardMaterial color="#ffd23f" emissive="#ffc21a" emissiveIntensity={0.8} transparent depthWrite={false} />
    </mesh>
    {SPARKS.map((_, i) => <mesh key={i} ref={element => { sparks.current[i] = element }} visible={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ffd23f' : '#9be15d'} emissive={i % 3 === 1 ? '#ffb300' : '#ffffff'} emissiveIntensity={0.5} transparent depthWrite={false} />
    </mesh>)}
  </group>
}

/** 박 격자(어떤 마디의 시작 시각과 빠르기). 두두가 이 박에 맞춰 몸을 흔든다(rhythm.ts). */
export interface BeatGrid { anchor: number; bpm: number }

/** 도착 줄: 마지막 흰 줄을 지나 정문 앞 인도. */
export const ARRIVAL_STRIPE = STRIPES + 1.3

function Walker({ stripe, action, animate, bob, arrived, beat }: { stripe: number; action: HoyaAction; animate: boolean; bob: boolean; arrived: boolean; beat?: MutableRefObject<BeatGrid | null> }) {
  const group = useRef<Group>(null)
  const from = useRef(stripe)
  const started = useRef(0)
  const camera = useThree(state => state.camera)
  // 세로로 긴 화면(휴대폰)에서는 정문 전체가 들어오게 도착 카메라를 더 뒤로 뺀다.
  const narrow = useThree(state => state.size.width < state.size.height * 0.9)
  const look = useMemo(() => new Vector3(), [])
  useEffect(() => { from.current = group.current ? group.current.position.x / STRIPE_PITCH : stripe; started.current = performance.now() }, [stripe])
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    // 줄 이동: 움직임 줄이기에서는 바로 옮긴다.
    const t = animate ? Math.min(1, (performance.now() - started.current) / HOP_MS) : 1
    const eased = t * t * (3 - 2 * t)
    g.position.x = stripeX(MathUtils.lerp(from.current, stripe, eased))
    const hopping = t < 1 && stripe !== from.current
    // 박 타기: 박 격자가 있으면 박마다 발이 땅에 닿게(박 사이에 살짝 뜀) 흔든다. 없으면 일정하게 흔든다.
    const grid = beat?.current
    const sway = grid ? Math.sin(Math.PI * beatPhase(grid.anchor, grid.bpm, performance.now())) * 0.06 : Math.abs(Math.sin(clock.elapsedTime * Math.PI * 1.5)) * 0.04
    g.position.y = (hopping ? Math.sin(Math.PI * t) * 0.55 : 0) + (bob && animate && !hopping ? sway : 0)
    g.rotation.z = hopping ? -0.18 * Math.sin(Math.PI * t) : 0
    // 카메라는 두두를 부드럽게 따라간다.
    const target = g.position.x
    // 두두를 화면 가운데에 두어 머리 위 말하기 동그라미와 맞춘다. 도착하면 뒤로 물러나 정문까지 보여 준다.
    camera.position.x = MathUtils.damp(camera.position.x, target, 3, 1 / 60)
    camera.position.y = MathUtils.damp(camera.position.y, arrived ? 2.7 : 1.9, 2, 1 / 60)
    camera.position.z = MathUtils.damp(camera.position.z, arrived ? (narrow ? 15.5 : 9.4) : 4.8, 2, 1 / 60)
    look.set(camera.position.x - (arrived ? 0.35 : 0), arrived ? 2.05 : 0.95, arrived ? -1.0 : 0)
    camera.lookAt(look)
  })
  return <group ref={group} position={[stripeX(stripe), 0, 0.2]} rotation={[0, 0.5, 0]}>
    <group scale={DUDU_SCALE} position={[0, -FLOOR_Y * DUDU_SCALE, 0]}><DuduCharacter action={action} animate={animate} /></group>
  </group>
}

export function CrossingScene({ stripe, action, animate, bob = true, arrived = false, beat }: { stripe: number; action: HoyaAction; animate: boolean; bob?: boolean; arrived?: boolean; beat?: MutableRefObject<BeatGrid | null> }) {
  const [supported] = useState(() => canUseWebGL())
  const [lost, setLost] = useState(false)
  if (!supported || lost) return <HoyaFallback action={action} />
  return <div role="img" aria-label={`대구대 건너기: 두두가 ${stripe}번째 줄에 있어요`} style={{ position: 'absolute', inset: 0 }}>
    <HoyaErrorBoundary fallback={<HoyaFallback action={action} />}>
      <Canvas camera={{ position: [0, 1.9, 4.8], fov: 40 }} dpr={[1, 2]}
        onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setLost(true) })}>
        {/* 하늘은 무대(.crossing-stage)의 그라데이션이 보이게 비워 둔다(화면 배경 그림과 같은 하늘색). */}
        <hemisphereLight args={['#ffffff', '#cfe3d6', 1.3]} />
        <directionalLight position={[4, 7, 6]} intensity={1.6} />
        <directionalLight position={[-5, 3, 4]} intensity={0.4} />
        <Street crossed={Math.min(STRIPES, Math.floor(stripe))} />
        <LandingFx stripe={stripe} animate={animate} />
        <Walker stripe={stripe} action={action} animate={animate} bob={bob} arrived={arrived} beat={beat} />
      </Canvas>
    </HoyaErrorBoundary>
  </div>
}
