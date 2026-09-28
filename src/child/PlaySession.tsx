import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { completePlay, sendUtterance } from '../api/play'
import type { PlayItem } from '../shared/events'
import type { PlayStart } from '../shared/types'
import { AudioCapture } from '../speech/audioCapture'
import { DemoRecognizer } from '../speech/demoRecognizer'
import { VadStateMachine } from '../speech/vad'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'
import BeamCanvas from '../game/magicBeam/BeamCanvas'
import { initialTowerState, towerTransition } from '../game/monsterTower/machine'
import { beamTransition, initialBeamState } from '../game/magicBeam/machine'
import Character from '../character/Character'

export default function PlaySession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const saved = sessionStorage.getItem('speechHero.play')
  const start = saved ? JSON.parse(saved) as PlayStart : null
  const [item, setItem] = useState<PlayItem | null>(start && start.sessionId === id ? start.firstItem : null)
  const [attempt, setAttempt] = useState(1)
  const [message, setMessage] = useState('주문을 들려줘!')
  const [voiceMs, setVoiceMs] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tower, setTower] = useState(initialTowerState)
  const [beam, setBeam] = useState(initialBeamState)
  const recognizer = useRef(start?.mode === 'real' ? new WebSpeechRecognizer() : new DemoRecognizer())
  const began = useRef<number | null>(null)
  const startedAt = useRef(Date.now())
  const submitting = useRef(false)

  useEffect(() => { if (!start || !item) navigate('/play') }, [start, item, navigate])
  useEffect(() => {
    if (!start || !item || busy) return
    let disposed = false
    const capture = new AudioCapture()
    const vad = new VadStateMachine()
    let calibration: number[] = []
    let calibrationStart = 0
    const submit = async (durationMs: number, voicedMs: number, rmsDb: number, source: string) => {
      if (submitting.current || disposed) return
      submitting.current = true
      setBusy(true)
      setMessage('마법을 확인하는 중이야…')
      try {
        const recognition = item.game === 'magic_beam' ? { transcript: null, recognizer: 'none', alternatives: [] } : await recognizer.current.stop()
        const response = await sendUtterance(start, item.itemId, attempt, recognition.transcript, recognition.recognizer, { durationMs, voicedMs, meanRmsDb: rmsDb, peakRmsDb: rmsDb, meanHfRatio: 0, onsetLatencyMs: 0, source }, Math.floor((Date.now() - startedAt.current) / 1000))
        const types = response.events.map(e => e.type)
        for (const event of response.events) {
          if (item.game === 'monster_tower') setTower(value => towerTransition(value, event))
        }
        if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'RESULT', success: types.includes('TARGET_SUCCESS') }))
        setMessage(types.includes('LEVEL_DOWN') ? '마법 충전! 작은 주문부터 다시 해보자!' : types.includes('LEVEL_UP') ? '충전 완료! 큰 마법이 나가요!' : types.includes('TARGET_SUCCESS') ? '멋진 마법이야!' : item.game === 'magic_beam' ? '이번엔 조금 더 길게!' : '방패가 생겼어. 다시 해보자!')
        if (response.sessionComplete || !response.nextItem) {
          const result = await completePlay(start, Math.floor((Date.now() - startedAt.current) / 1000))
          sessionStorage.setItem('speechHero.result', JSON.stringify(result))
          navigate('/play/reward')
          return
        }
        if (response.nextItem.game === 'magic_beam') setBeam(initialBeamState(response.nextItem.beamTargetMs))
        setAttempt(response.nextAttemptIndex)
        setItem(response.nextItem)
      } catch (cause) { setError(cause instanceof Error ? cause.message : '연결을 확인해 주세요') }
      finally { submitting.current = false; setBusy(false); began.current = null; setVoiceMs(0) }
    }
    if (start.mode === 'demo') {
      const down = (event: KeyboardEvent) => {
        if (event.code !== 'Space' || event.repeat || began.current !== null || submitting.current) return
        event.preventDefault(); began.current = performance.now(); setMessage('마법을 모으는 중이야!')
        if (item.game === 'magic_beam') setBeam(value => beamTransition(beamTransition(value, { type: 'LISTEN' }), { type: 'VOICE_START' }))
        else setTower(value => towerTransition(value, { type: 'VOICE_START', payload: {} }))
        if (item.game !== 'magic_beam') recognizer.current.start(item)
      }
      const up = (event: KeyboardEvent) => {
        if (event.code !== 'Space' || began.current === null) return
        event.preventDefault(); const duration = performance.now() - began.current
        if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'VOICE_END', voicedMs: duration }))
        else setTower(value => towerTransition(value, { type: 'VOICE_END', payload: {} }))
        void submit(duration, duration, -20, 'keyboard')
      }
      const timer = window.setInterval(() => { if (began.current !== null) { const elapsed = performance.now() - began.current; setVoiceMs(elapsed); if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'VOICE_CONTINUE', voicedMs: elapsed })) } }, 50)
      window.addEventListener('keydown', down); window.addEventListener('keyup', up)
      return () => { disposed = true; clearInterval(timer); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
    }
    capture.start(frame => {
      if (!calibrationStart) calibrationStart = frame.tMs
      if (frame.tMs - calibrationStart < 1000) { calibration.push(frame.rmsDb); return }
      if (calibration.length) { vad.calibrate(calibration); calibration = []; setMessage('마이크 준비 완료. 주문을 들려줘!') }
      for (const event of vad.process(frame)) {
        if (event.type === 'VOICE_START') { began.current = performance.now(); setMessage('마법을 모으는 중이야!'); if (item.game === 'magic_beam') setBeam(value => beamTransition(beamTransition(value, { type: 'LISTEN' }), { type: 'VOICE_START' })); else { setTower(value => towerTransition(value, { type: 'VOICE_START', payload: {} })); recognizer.current.start(item) } }
        if (event.type === 'VOICE_CONTINUE') { const elapsed = performance.now() - (began.current || performance.now()); setVoiceMs(elapsed); if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'VOICE_CONTINUE', voicedMs: elapsed })) }
        if (event.type === 'VOICE_END') { if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'VOICE_END', voicedMs: event.voicedMs })); else setTower(value => towerTransition(value, { type: 'VOICE_END', payload: {} })); void submit(event.durationMs || 0, event.voicedMs || 0, event.meanRmsDb || -60, 'microphone') }
      }
    }).catch(cause => setError(cause instanceof Error ? cause.message : '마이크 사용을 허용해 주세요'))
    return () => { disposed = true; capture.stop() }
  }, [item?.itemId, attempt, busy])
  if (!start || !item) return null
  return <main className="child-screen game-screen"><div className="game-top"><span>{start.heroName}</span><span>{start.mode === 'demo' ? 'DEMO · Space를 누르며 발성' : '실제 음성'}</span></div><div className="monster" aria-hidden="true">{item.game === 'magic_beam' ? '✨' : tower.charge ? '⚡🐲' : tower.shield ? '🛡️🐲' : '🐲'}</div><h1>{item.game === 'magic_beam' ? '빛의 마법' : '몬스터 타워'}</h1>{item.game === 'monster_tower' && <div className="health" aria-label={`몬스터 마법 체력 ${tower.health}`}>{'❤️'.repeat(Math.ceil(tower.health / 2))}</div>}<p className="target">{item.displayText}</p>{item.game === 'magic_beam' && <BeamCanvas voicedMs={beam.voicedMs || voiceMs} targetMs={item.beamTargetMs || 1500} />}<div aria-live="polite"><Character line={message} mood={tower.charge || tower.shield ? 'thinking' : 'happy'} /></div>{error && <p role="alert">{error} <button onClick={() => setError('')}>다시 시도</button>{start.mode === 'real' && <button onClick={() => navigate('/play/map')}>DEMO 모드 선택</button>}</p>}<p className="small">{start.mode === 'demo' ? 'Space를 누르는 동안 발성해 주세요. DEMO 인식 결과를 사용합니다.' : '마이크에 말하면 자동으로 마법이 시작됩니다.'}</p></main>
}
