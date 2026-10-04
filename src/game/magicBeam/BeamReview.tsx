import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MagicBeamScene } from './MagicBeamScene'
import type { HoyaAction } from '../../control/speechGameSignal'
import type { SceneFx } from '../../child/ActivityScene'
import '../../styles/global.css'
import '../../styles/child.css'

function BeamReview() {
  const [roundIndex, setRoundIndex] = useState(() => Math.min(5, Math.max(1, Number(new URLSearchParams(location.search).get('round')) || 1)))
  const [action, setAction] = useState<HoyaAction>('LISTENING')
  const [fx, setFx] = useState<SceneFx | null>(null)
  const began = useRef<number | null>(null)
  const duration = useRef(0)
  function begin() { began.current = performance.now(); duration.current = 0; setFx(null); setAction('BEAM') }
  function end() { duration.current = began.current === null ? 0 : performance.now() - began.current; began.current = null; setAction('RELEASE') }
  return <main className="child-screen" style={{ maxWidth: 1100, margin: 'auto', padding: 20 }}>
    <h1>빛의 마법 장면 검토</h1>
    <p>개발용 시각 자료입니다. 실제 마이크·서버 판정·치료 효과 검사가 아닙니다.</p>
    <nav aria-label="검토 라운드" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {[1, 2, 3, 4, 5].map(index => <button key={index} aria-pressed={roundIndex === index} onClick={() => { began.current = null; duration.current = 0; setFx(null); setAction('LISTENING'); setRoundIndex(index) }}>{index}라운드</button>)}
    </nav>
    <MagicBeamScene roundIndex={roundIndex} action={action} targetMs={1500} fx={fx} readInput={() => ({ active: began.current !== null, durationMs: began.current === null ? duration.current : performance.now() - began.current })} />
    <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
      <button onPointerDown={begin} onPointerUp={end} onPointerLeave={() => { if (began.current !== null) end() }}>누르는 동안 빛 보기</button>
      <button onClick={() => { began.current = null; duration.current = 0; setAction('CHEER'); setFx({ id: Date.now(), result: 'hit', attack: 'basic', stars: 3, ...(roundIndex === 2 || roundIndex === 4 ? { material: 'rice' as const } : {}) }) }}>보상 모양만 보기</button>
      <button onClick={() => { began.current = null; duration.current = 0; setAction('LISTENING'); setFx(null) }}>듣기 자세로</button>
    </div>
  </main>
}

createRoot(document.getElementById('root')!).render(<BeamReview />)
