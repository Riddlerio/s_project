import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, MathUtils, SRGBColorSpace, TextureLoader, Vector3, type Group, type Texture } from 'three'
import type { HoyaAction } from '../../control/speechGameSignal'
import { DuduCharacter } from '../../tiger/DuduCharacter'
import { canUseWebGL, HoyaErrorBoundary, HoyaFallback } from '../../tiger/Hoya3D'
import { STRIPES } from './crossingFlow'

/*
 * '대구대 건너기' 3D 장면. 흰 줄 20개의 횡단보도(초록불)를 두두가 한 줄씩 폴짝 건너 대구대 정문까지 간다.
 * 차는 넣지 않는다(위험 연출 없음). 카메라는 두두를 따라 옆으로 움직인다. 판정은 화면이 아니라 서버 결과를 따른다.
 */
export const STRIPE_PITCH = 1.2
const DUDU_SCALE = 0.42
const FLOOR_Y = -2.03 // DuduCharacter의 발바닥 높이(fit 좌표)
const HOP_MS = 650
const GATE_X = (STRIPES + 1.4) * STRIPE_PITCH

/** 두두가 서는 x: 0은 출발 인도, k는 k번째 흰 줄. */
export const stripeX = (stripe: number) => stripe * STRIPE_PITCH

function signTexture(): Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#0e6255'; ctx.fillRect(0, 0, 512, 128)
  ctx.fillStyle = '#ffffff'; ctx.font = '900 64px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('대구대학교', 256, 68)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Gate() {
  const sign = useMemo(signTexture, [])
  const [emblem, setEmblem] = useState<Texture | null>(null)
  useEffect(() => {
    let alive = true
    new TextureLoader().load('/assets/crossing/daegu_emblem.jpg', texture => { texture.colorSpace = SRGBColorSpace; if (alive) setEmblem(texture) })
    return () => { alive = false; sign?.dispose() }
  }, [sign])
  // 정문은 도착 인도 뒤에 카메라를 보고 서 있다(가로지르는 문은 기둥이 두두를 가려서).
  return <group position={[GATE_X, 0, -1.9]}>
    {[-1.7, 1.7].map(x => <mesh key={x} position={[x, 1.6, 0]}><boxGeometry args={[0.5, 3.2, 0.5]} /><meshStandardMaterial color="#e9ece6" roughness={0.8} /></mesh>)}
    <mesh position={[0, 3.45, 0]}><boxGeometry args={[4.4, 0.95, 0.3]} /><meshStandardMaterial color="#0e6255" /></mesh>
    {sign && <mesh position={[0.25, 3.45, 0.16]}><planeGeometry args={[3.4, 0.8]} /><meshStandardMaterial map={sign} /></mesh>}
    {emblem && <mesh position={[-1.65, 3.45, 0.17]}><circleGeometry args={[0.4, 40]} /><meshStandardMaterial map={emblem} roughness={0.6} /></mesh>}
  </group>
}

function Street() {
  const trees = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: -3 + i * 2.6, z: -4.2 - (i % 3) * 0.7, h: 1.3 + (i % 4) * 0.25 })), [])
  return <group>
    {/* 도로·인도·잔디 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, -0.01, 0]}><planeGeometry args={[60, 30]} /><meshStandardMaterial color="#a9d59b" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[stripeX(STRIPES) / 2 + 0.6, 0, 0]}><planeGeometry args={[stripeX(STRIPES) + 1.2, 3.2]} /><meshStandardMaterial color="#5d6468" roughness={0.95} /></mesh>
    <mesh position={[-1.2, 0.06, 0]}><boxGeometry args={[2.6, 0.12, 3.6]} /><meshStandardMaterial color="#d9d6cf" /></mesh>
    <mesh position={[GATE_X - 0.4, 0.06, 0]}><boxGeometry args={[3.4, 0.12, 3.6]} /><meshStandardMaterial color="#d9d6cf" /></mesh>
    {/* 흰 줄 20개 */}
    {Array.from({ length: STRIPES }, (_, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[stripeX(i + 1), 0.012, 0]}><planeGeometry args={[0.62, 2.8]} /><meshStandardMaterial color="#f7f7f2" roughness={0.7} /></mesh>)}
    {/* 출발 쪽 초록 신호등 */}
    <group position={[-1.8, 0, -1.5]}>
      <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.06, 0.06, 2.2, 10]} /><meshStandardMaterial color="#3d4447" /></mesh>
      <mesh position={[0, 2.35, 0]}><boxGeometry args={[0.36, 0.6, 0.28]} /><meshStandardMaterial color="#2c3133" /></mesh>
      <mesh position={[0, 2.22, 0.15]}><circleGeometry args={[0.11, 20]} /><meshStandardMaterial color="#47e07a" emissive="#2fbf5d" emissiveIntensity={0.9} /></mesh>
    </group>
    {/* 뒤쪽 나무 */}
    {trees.map((tree, i) => <group key={i} position={[tree.x, 0, tree.z]}>
      <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.09, 0.12, 0.7, 8]} /><meshStandardMaterial color="#8a6a4a" /></mesh>
      <mesh position={[0, 0.7 + tree.h / 2, 0]}><coneGeometry args={[0.55, tree.h, 10]} /><meshStandardMaterial color={i % 2 ? '#4f9d5b' : '#5fae63'} /></mesh>
    </group>)}
    <Gate />
  </group>
}

/** 도착 줄: 마지막 흰 줄을 지나 정문 앞 인도. */
export const ARRIVAL_STRIPE = STRIPES + 1.3

function Walker({ stripe, action, animate, bob, arrived }: { stripe: number; action: HoyaAction; animate: boolean; bob: boolean; arrived: boolean }) {
  const group = useRef<Group>(null)
  const from = useRef(stripe)
  const started = useRef(0)
  const camera = useThree(state => state.camera)
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
    g.position.y = (hopping ? Math.sin(Math.PI * t) * 0.55 : 0) + (bob && animate && !hopping ? Math.abs(Math.sin(clock.elapsedTime * Math.PI * 1.5)) * 0.04 : 0)
    g.rotation.z = hopping ? -0.18 * Math.sin(Math.PI * t) : 0
    // 카메라는 두두를 부드럽게 따라간다.
    const target = g.position.x
    // 두두를 화면 가운데에 두어 머리 위 말하기 동그라미와 맞춘다. 도착하면 뒤로 물러나 정문까지 보여 준다.
    camera.position.x = MathUtils.damp(camera.position.x, target, 3, 1 / 60)
    camera.position.y = MathUtils.damp(camera.position.y, arrived ? 2.5 : 1.9, 2, 1 / 60)
    camera.position.z = MathUtils.damp(camera.position.z, arrived ? 8.2 : 4.8, 2, 1 / 60)
    look.set(camera.position.x, arrived ? 1.7 : 0.95, arrived ? -0.8 : 0)
    camera.lookAt(look)
  })
  return <group ref={group} position={[stripeX(stripe), 0, 0.2]} rotation={[0, 0.5, 0]}>
    <group scale={DUDU_SCALE} position={[0, -FLOOR_Y * DUDU_SCALE, 0]}><DuduCharacter action={action} animate={animate} /></group>
  </group>
}

export function CrossingScene({ stripe, action, animate, bob = true, arrived = false }: { stripe: number; action: HoyaAction; animate: boolean; bob?: boolean; arrived?: boolean }) {
  const [supported] = useState(() => canUseWebGL())
  const [lost, setLost] = useState(false)
  if (!supported || lost) return <HoyaFallback action={action} />
  return <div role="img" aria-label={`대구대 건너기: 두두가 ${stripe}번째 줄에 있어요`} style={{ position: 'absolute', inset: 0 }}>
    <HoyaErrorBoundary fallback={<HoyaFallback action={action} />}>
      <Canvas camera={{ position: [0, 1.9, 4.8], fov: 40 }} dpr={[1, 2]}
        onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setLost(true) })}>
        <color attach="background" args={['#cfeaf4']} />
        <hemisphereLight args={['#ffffff', '#cfe3d6', 1.3]} />
        <directionalLight position={[4, 7, 6]} intensity={1.6} />
        <directionalLight position={[-5, 3, 4]} intensity={0.4} />
        <Street />
        <Walker stripe={stripe} action={action} animate={animate} bob={bob} arrived={arrived} />
      </Canvas>
    </HoyaErrorBoundary>
  </div>
}
