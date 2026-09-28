import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { completePlay, sendUtterance } from '../api/play'
import type { PlayItem } from '../shared/events'
import type { PlayStart } from '../shared/types'
import { AudioCapture } from '../speech/audioCapture'
import { DemoRecognizer } from '../speech/demoRecognizer'
import { VadStateMachine } from '../speech/vad'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'
import { SustainTracker } from '../speech/sustainTracker'
import { assessAudioQuality } from '../speech/audioQuality'
import type { Acoustic } from '../shared/types'
import BeamCanvas from '../game/magicBeam/BeamCanvas'
import { initialTowerState, towerTransition } from '../game/monsterTower/machine'
import { beamTransition, initialBeamState } from '../game/magicBeam/machine'
import Character from '../character/Character'
import { toChildOutcome } from '../shared/pronunciation'
import { HoyaActionController } from '../control/HoyaActionController'
import type { GameKind, HoyaAction, SpeechGameSignal } from '../control/speechGameSignal'
import { Hoya3D } from '../tiger/Hoya3D'

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
  const [hoyaAction, setHoyaAction] = useState<HoyaAction>('IDLE')
  const hoyaController = useRef<HoyaActionController | null>(null)
  if (!hoyaController.current) hoyaController.current = new HoyaActionController(setHoyaAction)
  const hoyaSignal = (game: string, signal: SpeechGameSignal) =>
    hoyaController.current?.dispatch((game === 'monster_tower' ? 'monster_adventure' : game) as GameKind, signal)
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
    let sustain: SustainTracker | undefined
    const submit = async (acoustic: Acoustic) => {
      if (submitting.current || disposed) return
      submitting.current = true
      setBusy(true)
      setMessage('마법을 확인하는 중이야…')
      try {
        const recognition = item.game === 'magic_beam' ? { transcript: null, recognizer: 'none', alternatives: [] } : await recognizer.current.stop()
        const response = await sendUtterance(start, item.itemId, attempt, recognition.transcript, recognition.recognizer, acoustic, Math.floor((Date.now() - startedAt.current) / 1000))
        const types = response.events.map(e => e.type)
        for (const event of response.events) {
          if (item.game === 'monster_tower') setTower(value => towerTransition(value, event))
        }
        const outcome = toChildOutcome(response.events)
        hoyaSignal(item.game, outcome === 'SUCCESS' ? { type: 'TARGET_SUCCESS' } : outcome === 'RETRY' ? { type: 'TARGET_RETRY' } : { type: 'UNCERTAIN' })
        if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'RESULT', outcome }))
        setMessage(outcome === 'UNCERTAIN' ? '앗, 내가 잘 못 들었나 봐. 천천히 다시 들려줄래?' : outcome === 'NO_SPEECH' ? '괜찮아, 준비되면 들려줘!' : outcome === 'NEUTRAL_CONTINUE' ? '다음 마법으로 가보자!' : types.includes('LEVEL_DOWN') ? '마법 충전! 작은 주문부터 다시 해보자!' : types.includes('LEVEL_UP') ? '충전 완료! 큰 마법이 나가요!' : outcome === 'SUCCESS' ? '멋진 마법이야!' : '좋아, 같이 한 번 더 해보자!')
        if (response.sessionComplete || !response.nextItem) {
          const result = await completePlay(start, Math.floor((Date.now() - startedAt.current) / 1000))
          sessionStorage.setItem('speechHero.result', JSON.stringify(result))
          navigate('/play/reward')
          return
        }
        if (response.nextItem.game === 'magic_beam') setBeam(initialBeamState(response.nextItem.beamTargetMs))
        if (outcome !== 'SUCCESS') await new Promise(resolve => window.setTimeout(resolve, 1200))
        setAttempt(response.nextAttemptIndex)
        setItem(response.nextItem)
      } catch (cause) { setError(cause instanceof Error ? cause.message : '연결을 확인해 주세요') }
      finally { submitting.current = false; setBusy(false); began.current = null; setVoiceMs(0) }
    }
    if (start.mode === 'demo') {
      const down = (event: KeyboardEvent) => {
        if (event.code !== 'Space' || event.repeat || began.current !== null || submitting.current) return
        event.preventDefault(); began.current = performance.now(); setMessage('마법을 모으는 중이야!')
        hoyaSignal(item.game, { type: 'VOICE_START' })
        if (item.game === 'magic_beam') setBeam(value => beamTransition(beamTransition(value, { type: 'LISTEN' }), { type: 'VOICE_START' }))
        else setTower(value => towerTransition(value, { type: 'VOICE_START', payload: {} }))
        if (item.game !== 'magic_beam') recognizer.current.start(item)
      }
      const up = (event: KeyboardEvent) => {
        if (event.code !== 'Space' || began.current === null) return
        event.preventDefault(); const duration = performance.now() - began.current
        hoyaSignal(item.game, { type: 'VOICE_END' })
        if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'VOICE_END', voicedMs: duration }))
        else setTower(value => towerTransition(value, { type: 'VOICE_END', payload: {} }))
        void submit({ durationMs: duration, voicedMs: duration, activeMs: duration, bestRunMs: duration, fricationMs: duration, meanRmsDb: -20, peakRmsDb: -20, meanHfRatio: 0, onsetLatencyMs: 0, source: 'keyboard' })
      }
      const timer = window.setInterval(() => { if (began.current !== null) { const elapsed = performance.now() - began.current; setVoiceMs(elapsed); hoyaSignal(item.game, { type: 'VOICE_CONTINUE', energy01: Math.min(1, elapsed / 1500) }); if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'VOICE_CONTINUE', voicedMs: elapsed })) } }, 50)
      window.addEventListener('keydown', down); window.addEventListener('keyup', up)
      return () => { disposed = true; clearInterval(timer); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
    }
    capture.start(frame => {
      if (!calibrationStart) calibrationStart = frame.tMs
      if (frame.tMs - calibrationStart < 1000) { calibration.push(frame.rmsDb); return }
      if (calibration.length) { vad.calibrate(calibration); calibration = []; sustain = new SustainTracker(item.game === 'magic_beam' ? 'fricative' : 'any_sound', vad.noiseFloor); setMessage('마이크 준비 완료. 주문을 들려줘!') }
      const wasVoice = vad.state === 'voice' || vad.state === 'maybe_silence'
      const events = vad.process(frame)
      if (events.some(event => event.type === 'VOICE_START')) sustain?.reset(vad.noiseFloor)
      if (wasVoice || events.some(event => event.type === 'VOICE_START')) sustain?.process(frame)
      for (const event of events) {
        if (event.type === 'VOICE_START') { hoyaSignal(item.game, { type: 'VOICE_START' }); began.current = performance.now(); setMessage('마법을 모으는 중이야!'); if (item.game === 'magic_beam') setBeam(value => beamTransition(beamTransition(value, { type: 'LISTEN' }), { type: 'VOICE_START' })); else { setTower(value => towerTransition(value, { type: 'VOICE_START', payload: {} })); recognizer.current.start(item) } }
        if (event.type === 'VOICE_CONTINUE') { hoyaSignal(item.game, { type: 'VOICE_CONTINUE', energy01: sustain?.energy01 ?? 0 }); const elapsed = item.game === 'magic_beam' ? sustain?.bestRunMs ?? 0 : performance.now() - (began.current || performance.now()); setVoiceMs(elapsed); if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'VOICE_CONTINUE', voicedMs: elapsed })) }
        if (event.type === 'VOICE_END') {
          hoyaSignal(item.game, { type: 'VOICE_END' })
          const bestRunMs = sustain?.bestRunMs ?? 0
          if (item.game === 'magic_beam') setBeam(value => beamTransition(value, { type: 'VOICE_END', voicedMs: bestRunMs }))
          else setTower(value => towerTransition(value, { type: 'VOICE_END', payload: {} }))
          const quality = assessAudioQuality(event.noiseFloorDb ?? null, event.meanRmsDb ?? -60, event.durationMs ?? 0, event.clippingRatio ?? 0)
          void submit({ durationMs: event.durationMs ?? 0, voicedMs: event.voicedMs ?? 0, activeMs: sustain?.totalActiveMs ?? 0,
            bestRunMs, fricationMs: sustain?.fricationMs ?? 0, meanRmsDb: event.meanRmsDb ?? -60,
            peakRmsDb: event.peakRmsDb ?? -60, meanHfRatio: event.meanHfRatio ?? 0,
            meanCentroidHz: event.meanCentroidHz ?? 0, noiseFloorDb: event.noiseFloorDb,
            clippingRatio: event.clippingRatio, snrDb: quality.snrDb ?? undefined, onsetLatencyMs: 0, source: 'microphone' })
        }
      }
    }).catch(cause => setError(cause instanceof Error ? cause.message : '마이크 사용을 허용해 주세요'))
    return () => { disposed = true; capture.stop() }
  }, [item?.itemId, attempt, busy])
  if (!start || !item) return null
  return <main className="child-screen game-screen"><div className="game-top"><span>{start.heroName}</span><span>{start.mode === 'demo' ? 'DEMO · Space를 누르며 발성' : '실제 음성'}</span></div><div style={{ height: '42vh', minHeight: 260 }}><Hoya3D action={hoyaAction} /></div><div className="monster" aria-hidden="true">{item.game === 'magic_beam' ? '✨' : tower.charge ? '⚡🐲' : tower.shield ? '🛡️🐲' : '🐲'}</div><h1>{item.game === 'magic_beam' ? '빛의 마법' : '몬스터 타워'}</h1>{item.game === 'monster_tower' && <div className="health" aria-label={`몬스터 마법 체력 ${tower.health}`}>{'❤️'.repeat(Math.ceil(tower.health / 2))}</div>}<p className="target">{item.displayText}</p>{item.game === 'magic_beam' && <BeamCanvas voicedMs={beam.voicedMs || voiceMs} targetMs={item.beamTargetMs || 1500} />}<div aria-live="polite"><Character line={message} mood={tower.charge || tower.shield ? 'thinking' : 'happy'} /></div>{error && <p role="alert">{error} <button onClick={() => setError('')}>다시 시도</button>{start.mode === 'real' && <button onClick={() => navigate('/play/map')}>DEMO 모드 선택</button>}</p>}<p className="small">{start.mode === 'demo' ? 'Space를 누르는 동안 발성해 주세요. DEMO 인식 결과를 사용합니다.' : '마이크에 말하면 자동으로 마법이 시작됩니다.'}</p></main>
}
