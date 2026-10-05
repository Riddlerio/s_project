import { Canvas } from '@react-three/fiber'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { HoyaAction } from '../control/speechGameSignal'
import { DuduModel } from './DuduModel'
import { DuduCharacter } from './DuduCharacter'
import type { FaceState } from './duduFace'
import { drawEmblem } from './duduEmblem'

/*
 * 개발 서버 전용 검토 화면(/dudu-review.html). 배포 빌드에는 들어가지 않는다.
 * 원래 도안·조형 도면과 같은 각도(정면·45도·측면·후면)로 놓고 비교한다. 화면이 뜨는 것은 원화 충실도 승인이 아니다.
 * 예: /dudu-review.html?action=WAVE
 *   &close 얼굴·흉장·손, &face 얼굴만, &lower 꼬리·다리, &still 정지(듣기·일시정지·움직임 줄이기와 같은 규칙),
 *   &expr=closed|happy|talk 표정 고정, &procedural 절차형 모델만, ?emblem 흉장 근사 재현
 */
const ACTIONS: HoyaAction[] = ['IDLE', 'LISTENING', 'TALKING', 'CHARGE', 'BEAM', 'RELEASE', 'FLY', 'LAND', 'CAST', 'ATTACK',
  'WALK_TO', 'PICK_UP', 'PUT_IN_BAG', 'WAVE', 'CHEER', 'ENCOURAGE', 'THINKING']
const VIEWS = [['정면', 0], ['45도', -Math.PI / 4], ['측면', -Math.PI / 2], ['후면', Math.PI]] as const
const EXPRESSIONS: Record<string, FaceState> = { closed: { eyes: 'closed', mouth: 0 }, happy: { eyes: 'happy', mouth: 0.8 }, talk: { eyes: 'open', mouth: 1 } }
// 카메라 [위치 y, 거리 z, 바라보는 y]
const FRAMES = { full: [0.2, 8.4, -0.15], close: [0.3, 4.4, 0.05], face: [0.35, 2.6, 0.3], lower: [-0.9, 4.2, -1.25] } as const

function Review() {
  const params = new URLSearchParams(location.search)
  const requested = params.get('action') as HoyaAction | null
  const action = requested && ACTIONS.includes(requested) ? requested : 'IDLE'
  const frame = params.has('face') ? 'face' : params.has('lower') ? 'lower' : params.has('close') ? 'close' : 'full'
  const [camY, camZ, lookY] = FRAMES[frame]
  const procedural = params.has('procedural')
  const animate = !params.has('still')
  const expression = EXPRESSIONS[params.get('expr') ?? '']
  const keep = ['close', 'face', 'lower', 'still', 'procedural'].filter(key => params.has(key)).map(key => `&${key}`).join('') + (params.get('expr') ? `&expr=${params.get('expr')}` : '')
  return <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16, background: '#f5f6f1', minHeight: '100vh' }}>
    <h1 style={{ margin: '0 0 4px', fontSize: 20 }}>두두 3D 검토 · {action}{animate ? '' : ' · 정지'}</h1>
    <p style={{ margin: '0 0 12px', color: '#5c706a', fontSize: 13 }}>{procedural ? '절차형 대체 모델' : 'Meshy 모델(GLB) + 코드 꼬리·표정'} · 조형 도면(정면·측면·후면) 대조용 · 원화 충실도 승인은 사람이 따로 한다</p>
    {params.has('emblem') && <img alt="흉장 근사 재현" src={drawEmblem(512)?.toDataURL()} style={{ width: 360, height: 360, display: 'block', margin: '0 0 12px' }} />}
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {ACTIONS.map(value => <a key={value} href={`?action=${value}${keep}`} style={{ fontSize: 12, fontWeight: value === action ? 900 : 400 }}>{value}</a>)}
    </nav>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {VIEWS.map(([label, yaw]) => <figure key={label} style={{ margin: 0, background: '#fff', borderRadius: 14 }}>
        <div style={{ height: 420 }}>
          <Canvas camera={{ position: [0, camY, camZ], fov: 35 }} onCreated={({ camera }) => camera.lookAt(0, lookY, 0)}>
            <hemisphereLight args={['#ffffff', '#cfe3d6', 1.35]} />
            <directionalLight position={[3, 5, 6]} intensity={1.7} />
            <directionalLight position={[-4, 2, 3]} intensity={0.45} />
            <group rotation={[0, yaw, 0]}>{procedural ? <DuduModel action={action} animate={animate} /> : <DuduCharacter action={action} animate={animate} expression={expression} />}</group>
          </Canvas>
        </div>
        <figcaption style={{ textAlign: 'center', padding: 6, fontSize: 13 }}>{label}</figcaption>
      </figure>)}
    </div>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Review /></StrictMode>)
