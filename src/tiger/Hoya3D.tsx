import { Canvas } from '@react-three/fiber'
import { Component, useState, type ReactNode } from 'react'
import type { HoyaAction } from '../control/speechGameSignal'
import { DuduModel } from './DuduModel'

// 두두는 정면·측면·후면 조형 도면을 참고한 절차형 3D 시제품(DuduModel)이다. 최종 모델 파일이 아니다.
// 털 질감·리그·흉장 정확도는 임시이며, 모델 파일(.blend/.glb)을 받으면 내부 모델만 교체한다.

const ACTION_TEXT: Partial<Record<HoyaAction, string>> = {
  LISTENING: '두두가 귀 기울이고 있어요', TALKING: '두두가 말하고 있어요', CHARGE: '두두가 힘을 모으고 있어요',
  BEAM: '두두가 빛을 쏘고 있어요', RELEASE: '두두가 빛을 놓았어요', FLY: '두두가 날고 있어요', LAND: '두두가 내려앉았어요',
  CAST: '두두가 주문을 외우고 있어요', ATTACK: '두두가 몬스터에게 마법을 보냈어요', WALK_TO: '두두가 걸어가고 있어요',
  PICK_UP: '두두가 물건을 집었어요', PUT_IN_BAG: '두두가 가방에 넣었어요', WAVE: '두두가 손을 흔들어요',
  CHEER: '두두가 신나 해요', ENCOURAGE: '두두가 응원하고 있어요', THINKING: '두두가 생각하고 있어요',
}

/** WebGL을 쓸 수 없을 때 보여 주는 간단한 대체 화면. 3D 렌더가 아니다. */
export function HoyaFallback({ action = 'IDLE' }: { action?: HoyaAction }) {
  return <div role="img" aria-label="두두 그림(간단한 대체 화면)" data-hoya-fallback="true"
    style={{ display: 'grid', placeItems: 'center', minHeight: 280, textAlign: 'center' }}>
    <span aria-hidden="true" style={{ fontSize: 120 }}>🐯</span>
    <p>{ACTION_TEXT[action] || '두두가 옆에 있어요'}</p>
    <p className="small">두두가 간단한 모습으로 함께해요. 게임은 그대로 할 수 있어요.</p>
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
  componentDidCatch(error: unknown) { console.warn('3D 두두를 표시하지 못해 대체 화면을 사용합니다', error) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function Hoya3D({ action = 'IDLE', className = '' }: { action?: HoyaAction; className?: string }) {
  const [supported] = useState(() => canUseWebGL())
  const [lost, setLost] = useState(false)
  if (!supported || lost) return <HoyaFallback action={action} />
  return <div className={className} role="img" aria-label={`3D 두두: ${action}`} style={{ width: '100%', height: '100%', minHeight: 280 }}>
    <HoyaErrorBoundary fallback={<HoyaFallback action={action} />}>
      <Canvas camera={{ position: [0.5, 0.32, 7.6], fov: 35 }} dpr={[1, 2]}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, -0.12, 0)
          gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setLost(true) })
        }}>
        <hemisphereLight args={['#ffffff', '#cfe3d6', 1.35]} />
        <directionalLight position={[3, 5, 6]} intensity={1.7} />
        <directionalLight position={[-4, 2, 3]} intensity={0.45} />
        <DuduModel action={action} />
      </Canvas>
    </HoyaErrorBoundary>
  </div>
}
