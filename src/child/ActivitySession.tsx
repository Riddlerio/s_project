import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { resumeActivity, sendActivityUtterance, type ActivityItem, type ActivityRound, type ActivityStart } from '../api/activities'
import type { Acoustic } from '../shared/types'
import { HoyaActionController } from '../control/HoyaActionController'
import type { HoyaAction } from '../control/speechGameSignal'
import { Hoya3D } from '../tiger/Hoya3D'
import { AudioCapture } from '../speech/audioCapture'
import { DEFAULT_VAD } from '../speech/vad'
import { MicUtterancePipeline } from '../speech/micUtterance'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'

const gameNames = { magic_beam: '빛의 마법', sky_climb: '하늘 오르기', monster_adventure: '몬스터 모험', conversation_quest: '두두와 소풍' }

export default function ActivitySession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const saved = sessionStorage.getItem('speechHero.activity')
  const session = saved ? JSON.parse(saved) as ActivityStart : null
  const [round, setRound] = useState<ActivityRound | null>(session?.currentRound || null)
  const [item, setItem] = useState<ActivityItem | null>(session?.firstItem || null)
  const [attempt, setAttempt] = useState(1)
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [message, setMessage] = useState('두두가 기다리고 있어!')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [demoSpeech, setDemoSpeech] = useState(session?.firstItem.displayText || '')
  const [completed, setCompleted] = useState<number[]>([])
  const [ready, setReady] = useState(false)
  const [capabilities] = useState(() => detectCapabilities())
  const realSupported = !session || session.mode !== 'real' || supportsRealMode(session.game, capabilities)
  const began = useRef<number | null>(null)
  const startedAt = useRef(Date.now())
  const promptShownAt = useRef(performance.now())
  const onsetLatency = useRef(0)
  const modelSpeaking = useRef(false)
  const submitting = useRef(false)
  const controller = useRef<HoyaActionController | null>(null)
  if (!controller.current) controller.current = new HoyaActionController(setAction)
  const signal = controller.current

  useEffect(() => {
    if (!session || session.sessionId !== id) { navigate('/play/map'); return }
    let active = true
    resumeActivity(session.sessionId).then(live => {
      if (!active) return
      setRound(live.currentRound); setItem(live.firstItem)
      setAttempt(live.nextAttemptIndex ?? 1); setCompleted(live.completedRounds ?? [])
      sessionStorage.setItem('speechHero.activity', JSON.stringify(live))
      setReady(true)
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '세션을 다시 열 수 없어요') })
    return () => { active = false }
  }, [id])
  useEffect(() => { if (item) { setDemoSpeech(item.displayText); promptShownAt.current = performance.now() } }, [item?.itemId])
  useEffect(() => {
    if (!ready || !round || !item || round.elicitationType !== 'DIRECT_IMITATION' || !('speechSynthesis' in window)) return
    const speech = new SpeechSynthesisUtterance(item.displayText)
    speech.lang = 'ko-KR'; speech.rate = 0.8
    speech.onstart = () => { modelSpeaking.current = true; signal.command('TALKING') }
    speech.onend = () => { modelSpeaking.current = false; signal.command('LISTENING') }
    window.speechSynthesis.speak(speech)
  }, [ready, round?.index, item?.itemId])

  async function submit(acoustic: Acoustic, transcript: string | null) {
    if (!session || !round || !item || submitting.current) return
    submitting.current = true
    setBusy(true)
    setMessage('두두가 듣고 있어…')
    try {
      const result = await sendActivityUtterance(session, item, round.index, attempt, transcript, acoustic)
      const kinds = new Set(result.events.map(event => event.type))
      if (kinds.has('TARGET_SUCCESS')) { signal.dispatch(session.game, { type: 'TARGET_SUCCESS' }); setMessage('좋아! 다음 모험으로 가자!') }
      else if (kinds.has('LISTEN_AGAIN')) { signal.dispatch(session.game, { type: 'UNCERTAIN' }); setMessage('앗, 내가 잘 못 들었나 봐. 천천히 다시 말해줄래?') }
      else if (kinds.has('NO_SPEECH')) { signal.dispatch(session.game, { type: 'NO_SPEECH' }); setMessage('괜찮아, 준비되면 들려줘!') }
      else if (kinds.has('ITEM_ADVANCE')) { signal.dispatch(session.game, { type: 'UNCERTAIN' }); setMessage('다음 모험을 해보자!') }
      else if (kinds.has('STORY_CONTINUE')) { setMessage(result.dialogue?.text || '좋아, 같이 가자!'); signal.command('WALK_TO') }
      else { signal.dispatch(session.game, { type: 'TARGET_RETRY' }); setMessage('좋아, 같이 한 번 더 해보자!') }
      if (result.dialogue) {
        result.dialogue.hoyaActions.forEach((command, index) => {
          window.setTimeout(() => signal.command(command as HoyaAction), index * 450)
        })
        if ('speechSynthesis' in window) {
          const speech = new SpeechSynthesisUtterance(result.dialogue.text)
          speech.lang = 'ko-KR'; speech.rate = 0.9
          speech.onstart = () => signal.command('TALKING')
          speech.onend = () => signal.command('IDLE')
          window.speechSynthesis.speak(speech)
        }
      }
      if (kinds.has('ROUND_CLEAR')) setCompleted(value => [...value, round.index])
      if (result.sessionComplete) {
        const reward = await api<Record<string, unknown>>(`/play/sessions/${session.sessionId}/complete`, { method: 'POST', body: JSON.stringify({ elapsedSec: Math.floor((Date.now() - startedAt.current) / 1000) }) })
        sessionStorage.removeItem('speechHero.activity')
        sessionStorage.setItem('speechHero.result', JSON.stringify(reward))
        navigate('/play/reward')
        return
      }
      if (result.nextItem && result.currentRound) {
        if (!kinds.has('ROUND_CLEAR')) await new Promise(resolve => window.setTimeout(resolve, 1200))
        setRound(result.currentRound)
        setItem(result.nextItem)
        setAttempt(result.nextAttemptIndex)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '연결을 확인해 주세요') }
    finally { submitting.current = false; began.current = null; setBusy(false) }
  }

  useEffect(() => {
    if (!ready || !session || !round || !item || session.mode !== 'real' || !realSupported) return
    const capture = new AudioCapture()
    // 발화 뒤 기다리는 시간은 라운드가 정한다. 쉼 후 재개 라운드는 한 발화 안에서 자연스러운 쉼을 허용한다.
    const pipeline = new MicUtterancePipeline(session.game === 'magic_beam' ? 'fricative' : 'any_sound', round.endHoldMs ?? DEFAULT_VAD.endHoldMs)
    const recognizer = new WebSpeechRecognizer()
    let disposed = false
    capture.start(frame => {
      if (disposed || submitting.current || modelSpeaking.current) return
      const { events, acoustic } = pipeline.process(frame)
      for (const event of events) {
        if (event.type === 'VOICE_START') {
          onsetLatency.current = Math.min(60000, Math.max(0, performance.now() - promptShownAt.current))
          pipeline.onsetLatencyMs = onsetLatency.current
          signal.dispatch(session.game, { type: 'VOICE_START' })
          setMessage('두두가 힘을 모으고 있어!')
          if (session.game === 'monster_adventure' || session.game === 'conversation_quest') recognizer.start(item as Parameters<WebSpeechRecognizer['start']>[0])
        }
        if (event.type === 'VOICE_CONTINUE') signal.dispatch(session.game, { type: 'VOICE_CONTINUE', energy01: pipeline.tracker.energy01 })
        if (event.type === 'VOICE_END' && acoustic) {
          signal.dispatch(session.game, { type: 'VOICE_END' })
          if (session.game === 'monster_adventure' || session.game === 'conversation_quest') {
            void recognizer.stop().then(result => submit(acoustic, result.transcript))
          } else void submit(acoustic, null)
        }
      }
    }).catch(cause => setError(cause instanceof Error ? cause.message : '마이크를 사용할 수 없어요'))
    return () => { disposed = true; capture.stop() }
  }, [ready, item?.itemId, round?.index, round?.endHoldMs, attempt, session?.mode, realSupported])

  function begin() {
    if (!session || busy || began.current !== null) return
    began.current = performance.now()
    onsetLatency.current = Math.min(60000, Math.max(0, began.current - promptShownAt.current))
    signal.dispatch(session.game, { type: 'VOICE_START' })
    setMessage('두두가 힘을 모으고 있어!')
  }
  function end(transcriptOverride?: string) {
    if (!session || !round || !item || began.current === null) return
    const duration = Math.max(300, performance.now() - began.current)
    began.current = null
    signal.dispatch(session.game, { type: 'VOICE_END' })
    const acoustic: Acoustic = { durationMs: duration, voicedMs: duration, activeMs: duration,
      bestRunMs: duration, fricationMs: duration, meanRmsDb: -20, peakRmsDb: -12,
      meanHfRatio: 0.5, onsetLatencyMs: onsetLatency.current, source: 'keyboard',
      sustainSegmentsMs: round.id.endsWith('r4') ? [600, 600, 600] : [duration],
      pauseTotalMs: round.id.endsWith('r4') ? 900 : 0, interruptionCount: 0,
      energyMean01: 0.5, onsetFricationMs: 500, voicedAfterFricationMs: 300 }
    void submit(acoustic, session.game === 'conversation_quest' ? transcriptOverride ?? demoSpeech : session.game === 'monster_adventure' ? item.displayText : null)
  }
  useEffect(() => {
    if (session?.mode !== 'demo') return
    const down = (event: KeyboardEvent) => { if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) begin() } }
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') { event.preventDefault(); end() } }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [session?.mode, round?.index, item?.itemId, busy])

  if (!session || !round || !item) return null
  if (!ready) return <main className="child-screen game-screen"><p>모험을 다시 불러오는 중…</p>{error && <p role="alert">{error}</p>}</main>
  return <main className={`child-screen game-screen activity-game activity-${session.game}`}><div className="activity-shell">
    <header className="activity-header"><div><p className="eyebrow">ADVENTURE · {session.mode === 'demo' ? 'DEMO 연습' : '실제 음성'}</p><h1>{gameNames[session.game]}</h1></div><span>ROUND {round.index} / {session.rounds.length}</span></header>
    <div className="activity-progress" aria-label="다섯 라운드">{session.rounds.map(value => <span key={value.id} className={completed.includes(value.index) ? 'completed' : value.index === round.index ? 'current' : ''} aria-current={value.index === round.index ? 'step' : undefined}><small>{String(value.index).padStart(2, '0')}</small><span>{completed.includes(value.index) ? '완료' : value.index === round.index ? '진행 중' : '다음'}</span></span>)}</div>
    <section className="activity-stage"><div className="activity-stage-art"><div className="activity-art-ring" aria-hidden="true" />{session.game === 'monster_adventure' && <><div className="monster-path" aria-hidden="true" /><div className={`monster-opponent ${action === 'ATTACK' ? 'monster-hit' : ''}`} role="img" aria-label={action === 'ATTACK' ? '몬스터가 물러나요' : '숲의 몬스터가 길 앞에 있어요'}><span className="monster-horn monster-horn-left" /><span className="monster-horn monster-horn-right" /><span className="monster-body"><span className="monster-eye monster-eye-left" /><span className="monster-eye monster-eye-right" /><span className="monster-mouth" /></span><span className="monster-feet" /></div>{action === 'CAST' && <span className="monster-voice-wave" aria-hidden="true" />}<span className="monster-caption">숲의 몬스터</span></>}<div className="activity-character"><Hoya3D action={action} /></div><span className="activity-art-caption">DUDU IS WITH YOU</span></div><div className="activity-instruction"><p className="eyebrow">TODAY'S MOMENT</p><h2>{round.childTitle.replace(/호야|루미/g, '두두')}</h2><p>{round.childPrompt.replace(/호야|루미/g, '두두')}</p><div className="activity-target"><span>이번에 말할 것</span><strong>{item.displayText}</strong></div><p className="activity-message" aria-live="polite">{message.replace(/호야|루미/g, '두두')}</p></div></section>
    <div className="activity-controls">
      {session.mode === 'demo' && session.game === 'conversation_quest' && <div className="activity-demo-dialogue"><label>두두에게 들려줄 말<input value={demoSpeech} onChange={event => setDemoSpeech(event.target.value)} maxLength={50} /></label>{round.index === 1 && <div><button disabled={busy} onClick={() => { begin(); window.setTimeout(() => end(item.displayText), 350) }}>{item.displayText} 고르기</button><button disabled={busy} onClick={() => { begin(); window.setTimeout(() => end('바나나'), 350) }}>바나나 고르기</button></div>}</div>}
      {session.mode === 'demo' && <button className="activity-hold" disabled={busy} onPointerDown={begin} onPointerUp={() => end()} onPointerLeave={() => end()}>누르고 말하기 <span>Space</span></button>}
      {!realSupported && <p role="alert" className="notice">{missingText(session.game, capabilities)}</p>}
      {error && <p role="alert" className="notice">{error}</p>}
      <p className="small">{session.mode === 'demo' ? 'DEMO 입력입니다. 실제 발음 평가가 아닙니다.' : '음향 특징과 브라우저 인식 결과를 사용한 기초 추정입니다.'}</p>
    </div>
  </div></main>
}
