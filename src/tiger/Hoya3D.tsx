import { Canvas, useFrame } from '@react-three/fiber'
import { Component, useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import type { HoyaAction } from '../control/speechGameSignal'

function Tiger({ action }: { action: HoyaAction }) {
  const group = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    // THINKING은 실패·불안이 아니라 "네 말을 생각하고 있어"다. 고개를 살짝 기울이고 평소보다 천천히 움직인다.
    const thinking = action === 'THINKING'
    group.current.position.y = action === 'FLY' ? 0.35 + Math.sin(t * 4) * 0.15 : thinking ? Math.sin(t * 0.9) * 0.015 : Math.sin(t * 2) * 0.035
    group.current.position.x = action === 'WALK_TO' ? Math.sin(t * 2) * 0.2 : action === 'ATTACK' ? 0.18 + Math.sin(t * 6) * 0.08 : 0
    group.current.rotation.z = thinking ? 0.1 + Math.sin(t * 0.8) * 0.02 : action === 'BEAM' ? -0.12 : action === 'CHEER' || action === 'ENCOURAGE' ? Math.sin(t * 8) * 0.1 : 0
    group.current.rotation.x = thinking ? -0.06 : action === 'PICK_UP' ? 0.32 : action === 'ATTACK' ? -0.2 : 0
    group.current.rotation.y = thinking ? 0.12 : action === 'WALK_TO' ? -0.3 : action === 'LISTENING' ? 0.15 : Math.sin(t * 0.7) * 0.07
    if (rightArm.current) rightArm.current.rotation.z = action === 'WAVE' ? Math.sin(t * 8) * 0.65 : action === 'PICK_UP' ? -0.7 : action === 'PUT_IN_BAG' ? 0.75 : action === 'ATTACK' || action === 'CAST' || action === 'BEAM' ? -0.4 : 0
    if (leftArm.current) leftArm.current.rotation.z = action === 'CHEER' ? -0.4 + Math.sin(t * 8) * 0.15 : 0
  })
  const stripe = '#2b292a'
  // 생각할 때는 시선을 조금 위·옆으로 둔다.
  const gaze: [number, number] = action === 'THINKING' ? [0.05, 0.05] : [0, 0]
  return <group ref={group}>
    <mesh position={[0, -0.45, 0]}><capsuleGeometry args={[0.52, 0.75, 8, 18]} /><meshStandardMaterial color="#f6f3e9" /></mesh>
    <mesh position={[0, 0.54, 0.05]}><sphereGeometry args={[0.72, 24, 16]} /><meshStandardMaterial color="#faf8f1" /></mesh>
    <mesh position={[-0.52, 1.03, 0]}><sphereGeometry args={[0.24, 12, 10]} /><meshStandardMaterial color="#f8f5ea" /></mesh>
    <mesh position={[0.52, 1.03, 0]}><sphereGeometry args={[0.24, 12, 10]} /><meshStandardMaterial color="#f8f5ea" /></mesh>
    <mesh position={[-0.52, 1.04, 0.16]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color="#e8b4b0" /></mesh>
    <mesh position={[0.52, 1.04, 0.16]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color="#e8b4b0" /></mesh>
    <mesh position={[-0.26 + gaze[0], 0.65 + gaze[1], 0.65]}><sphereGeometry args={[0.08, 12, 10]} /><meshStandardMaterial color={stripe} /></mesh>
    <mesh position={[0.26 + gaze[0], 0.65 + gaze[1], 0.65]}><sphereGeometry args={[0.08, 12, 10]} /><meshStandardMaterial color={stripe} /></mesh>
    <mesh position={[0, 0.34, 0.72]}><sphereGeometry args={[0.13, 12, 10]} /><meshStandardMaterial color="#d78c81" /></mesh>
    <mesh position={[0, 0.12, 0.7]} scale={[1, action === 'TALKING' ? 1.8 : action === 'THINKING' ? 0.35 : 0.5, 1]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color="#513944" /></mesh>
    {[-1, 1].map(side => <group key={side} ref={side === -1 ? leftArm : rightArm}>
      <mesh position={[side * 0.68, -0.32, 0]} rotation={[0, 0, side * 0.35]}><capsuleGeometry args={[0.17, 0.42, 6, 12]} /><meshStandardMaterial color="#f8f5eb" /></mesh>
      <mesh position={[side * 0.3, -1.14, 0]}><capsuleGeometry args={[0.18, 0.28, 6, 12]} /><meshStandardMaterial color="#f8f5eb" /></mesh>
      <mesh position={[side * 0.48, 0.91, 0.43]} rotation={[0, 0, side * 0.48]}><boxGeometry args={[0.11, 0.32, 0.05]} /><meshStandardMaterial color={stripe} /></mesh>
      <mesh position={[side * 0.49, 0.28, 0.44]} rotation={[0, 0, side * 0.55]}><boxGeometry args={[0.12, 0.3, 0.04]} /><meshStandardMaterial color={stripe} /></mesh>
    </group>)}
    <mesh position={[0, -0.18, 0.52]} rotation={[0, 0, 0.08]}><torusGeometry args={[0.37, 0.09, 8, 24]} /><meshStandardMaterial color="#52b8b2" /></mesh>
    <mesh position={[0, -0.62, 0.54]}><cylinderGeometry args={[0.13, 0.13, 0.035, 20]} /><meshStandardMaterial color="#f6cb60" metalness={0.4} roughness={0.4} /></mesh>
    <mesh position={[0, -0.62, -0.52]}><coneGeometry args={[0.58, 1.2, 3]} /><meshStandardMaterial color="#55acae" side={2} /></mesh>
    {(['BEAM', 'CHARGE', 'CAST', 'ATTACK'] as HoyaAction[]).includes(action) && <mesh position={[0.85, -0.25, 0.5]}><sphereGeometry args={[action === 'BEAM' || action === 'ATTACK' ? 0.28 : 0.18, 16, 10]} /><meshStandardMaterial color="#83e4f3" emissive="#3ebacf" emissiveIntensity={0.8} /></mesh>}
    {action === 'BEAM' && <mesh position={[1.7, -0.25, 0.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.15, 1.8, 12]} /><meshStandardMaterial color="#83e4f3" emissive="#3ebacf" emissiveIntensity={1.3} /></mesh>}
    {action === 'THINKING' && <mesh position={[0.32, 0.08, 0.72]}><sphereGeometry args={[0.15, 12, 10]} /><meshStandardMaterial color="#f8f5eb" /></mesh>}
    {(action === 'PICK_UP' || action === 'PUT_IN_BAG') && <mesh position={action === 'PICK_UP' ? [0.9, -0.9, 0.5] : [0.2, -0.6, -0.3]}><sphereGeometry args={[0.18, 12, 10]} /><meshStandardMaterial color="#ed565d" /></mesh>}
  </group>
}

const ACTION_TEXT: Partial<Record<HoyaAction, string>> = {
  LISTENING: '호야가 귀 기울이고 있어요', TALKING: '호야가 말하고 있어요', CHARGE: '호야가 힘을 모으고 있어요',
  BEAM: '호야가 빛을 쏘고 있어요', RELEASE: '호야가 빛을 놓았어요', FLY: '호야가 날고 있어요', LAND: '호야가 내려앉았어요',
  CAST: '호야가 주문을 외우고 있어요', ATTACK: '호야가 몬스터에게 마법을 보냈어요', WALK_TO: '호야가 걸어가고 있어요',
  PICK_UP: '호야가 물건을 집었어요', PUT_IN_BAG: '호야가 가방에 넣었어요', WAVE: '호야가 손을 흔들어요',
  CHEER: '호야가 신나 해요', ENCOURAGE: '호야가 응원하고 있어요', THINKING: '호야가 생각하고 있어요',
}

/** WebGL을 쓸 수 없을 때 보여 주는 간단한 대체 화면. 3D 렌더가 아니다. */
export function HoyaFallback({ action = 'IDLE' }: { action?: HoyaAction }) {
  return <div role="img" aria-label="호야 그림(간단한 대체 화면)" data-hoya-fallback="true"
    style={{ display: 'grid', placeItems: 'center', minHeight: 280, textAlign: 'center' }}>
    <span aria-hidden="true" style={{ fontSize: 120 }}>🐯</span>
    <p>{ACTION_TEXT[action] || '호야가 옆에 있어요'}</p>
    <p className="small">호야가 간단한 모습으로 함께해요. 게임은 그대로 할 수 있어요.</p>
  </div>
}

type CanvasDocument = { createElement(tag: 'canvas'): { getContext(kind: string): unknown } }

export function canUseWebGL(doc: CanvasDocument | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) return false
  try {
    const canvas = doc.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Canvas나 3D 장면에서 오류가 나도 아동 화면 전체가 깨지지 않게 대체 화면으로 바꾼다. */
export class HoyaErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.warn('3D 호야를 표시하지 못해 대체 화면을 사용합니다', error) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function Hoya3D({ action = 'IDLE', className = '' }: { action?: HoyaAction; className?: string }) {
  const [supported] = useState(() => canUseWebGL())
  const [lost, setLost] = useState(false)
  if (!supported || lost) return <HoyaFallback action={action} />
  return <div className={className} role="img" aria-label={`3D 호야: ${action}`} style={{ width: '100%', height: '100%', minHeight: 280 }}>
    <HoyaErrorBoundary fallback={<HoyaFallback action={action} />}>
      <Canvas camera={{ position: [0, 0.15, 4.7], fov: 40 }} shadows
        onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setLost(true) })}>
        <ambientLight intensity={1.8} /><directionalLight position={[3, 5, 5]} intensity={2} />
        <Tiger action={action} />
      </Canvas>
    </HoyaErrorBoundary>
  </div>
}
