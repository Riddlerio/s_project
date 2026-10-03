import { Canvas } from '@react-three/fiber'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { HoyaAction } from '../control/speechGameSignal'
import { DuduModel } from './DuduModel'
import { drawEmblem } from './duduEmblem'

/*
 * 개발 서버 전용 검토 화면(/dudu-review.html). 배포 빌드에는 들어가지 않는다.
 * 원래 도안·조형 도면과 같은 각도(정면·45도·측면·후면)로 놓고 비교한다. 최종 모델 검수가 아니다.
 * 예: /dudu-review.html?action=WAVE, 가까이 보기 &close, 흉장만 보기 ?emblem
 */
const ACTIONS: HoyaAction[] = ['IDLE', 'LISTENING', 'TALKING', 'CHARGE', 'BEAM', 'RELEASE', 'FLY', 'LAND', 'CAST', 'ATTACK',
  'WALK_TO', 'PICK_UP', 'PUT_IN_BAG', 'WAVE', 'CHEER', 'ENCOURAGE', 'THINKING']
const VIEWS = [['정면', 0], ['45도', -Math.PI / 4], ['측면', -Math.PI / 2], ['후면', Math.PI]] as const

function Review() {
  const params = new URLSearchParams(location.search)
  const requested = params.get('action') as HoyaAction | null
  const action = requested && ACTIONS.includes(requested) ? requested : 'IDLE'
  const close = params.has('close') // 얼굴·흉장·손을 가까이 본다.
  return <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16, background: '#f5f6f1', minHeight: '100vh' }}>
    <h1 style={{ margin: '0 0 4px', fontSize: 20 }}>두두 절차형 3D 시제품 · {action}</h1>
    <p style={{ margin: '0 0 12px', color: '#5c706a', fontSize: 13 }}>임시 설계 · 최종 모델 아님 · 조형 도면(정면·측면·후면) 대조용</p>
    {params.has('emblem') && <img alt="흉장 근사 재현" src={drawEmblem(512)?.toDataURL()} style={{ width: 360, height: 360, display: 'block', margin: '0 0 12px' }} />}
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {ACTIONS.map(value => <a key={value} href={`?action=${value}`} style={{ fontSize: 12, fontWeight: value === action ? 900 : 400 }}>{value}</a>)}
    </nav>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {VIEWS.map(([label, yaw]) => <figure key={label} style={{ margin: 0, background: '#fff', borderRadius: 14 }}>
        <div style={{ height: 420 }}>
          <Canvas camera={{ position: [0, close ? 0.3 : 0.2, close ? 4.4 : 8.4], fov: 35 }} onCreated={({ camera }) => camera.lookAt(0, close ? 0.05 : -0.15, 0)}>
            <hemisphereLight args={['#ffffff', '#cfe3d6', 1.35]} />
            <directionalLight position={[3, 5, 6]} intensity={1.7} />
            <directionalLight position={[-4, 2, 3]} intensity={0.45} />
            <group rotation={[0, yaw, 0]}><DuduModel action={action} /></group>
          </Canvas>
        </div>
        <figcaption style={{ textAlign: 'center', padding: 6, fontSize: 13 }}>{label}</figcaption>
      </figure>)}
    </div>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Review /></StrictMode>)
