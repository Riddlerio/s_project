import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { sendActivityUtterance, type ActivityItem, type ActivityRound, type ActivityStart } from '../api/activities'
import type { Acoustic } from '../shared/types'
import { HoyaActionController } from '../control/HoyaActionController'
import type { HoyaAction } from '../control/speechGameSignal'
import { ActivityScene, RoundFeedback, type SceneFx } from './ActivityScene'
import { AttackChoice } from './AttackChoice'
import './activityLayout.css'
import { claimActivity, heartbeatActivity, pauseActivity } from '../api/adventure'
import { AudioCapture } from '../speech/audioCapture'
import { DEFAULT_VAD } from '../speech/vad'
import { MicUtterancePipeline } from '../speech/micUtterance'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'
import { KoreanTts } from '../speech/koreanTts'

const gameNames = { magic_beam: '빛의 마법', sky_climb: '하늘 오르기', monster_adventure: '몬스터 모험', conversation_quest: '두두와 소풍' }

export default function ActivitySession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<ActivityStart | null>(() => {
    try { const saved = JSON.parse(sessionStorage.getItem('speechHero.activity') || 'null') as ActivityStart | null; return saved?.sessionId === id ? saved : null }
    catch { return null }
  })
  const [round, setRound] = useState<ActivityRound | null>(session?.currentRound || null)
  const [item, setItem] = useState<ActivityItem | null>(session?.firstItem || null)
  const [attempt, setAttempt] = useState(1)
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [message, setMessage] = useState('두두가 기다리고 있어!')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [demoSpeech, setDemoSpeech] = useState(session?.firstItem?.displayText || '')
  const [completed, setCompleted] = useState<number[]>([])
  const [ready, setReady] = useState(false)
  const [suspended, setSuspended] = useState(false)
  const suspendedRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const claimRequest = useRef<{ id: string; promise: Promise<ActivityStart> } | null>(null)
  const [speaking, setSpeaking] = useState(false)
  // 서버가 이번 라운드 기준으로 알려 준다. 철회는 다음 라운드부터 적용된다.
  const [magicBeamGranted, setMagicBeamGranted] = useState(false)
  // 다른 기기가 진행 권한을 가져갔을 때만 이 기기의 명시적 이어받기를 보여 준다.
  const [needsTakeover, setNeedsTakeover] = useState(false)
  const [attack, setAttack] = useState<'basic' | 'magic_beam'>('basic')
  const attackRef = useRef(attack)
  attackRef.current = attack
  const [feedback, setFeedback] = useState<{ stars: number; praise: string; material?: 'rice' | 'tuna' } | null>(null)
  const [fx, setFx] = useState<SceneFx | null>(null)
  const fxCount = useRef(0)
  const [captureReadyKey, setCaptureReadyKey] = useState<string | null>(null)
  const [capabilities] = useState(() => detectCapabilities())
  const realSupported = !session || session.mode !== 'real' || supportsRealMode(session.game, capabilities)
  const began = useRef<number | null>(null)
  const startedAt = useRef(Date.now())
  const promptShownAt = useRef(performance.now())
  const onsetLatency = useRef(0)
  const modelSpeaking = useRef(false)
  const modelPending = useRef(false)
  const lastModeledItem = useRef<string | null>(null)
  const submitting = useRef(false)
  const voice = useRef<KoreanTts | null>(null)
  const pipelineRef = useRef<MicUtterancePipeline | null>(null)
  const mounted = useRef(false)
  const actionTimers = useRef<number[]>([])
  const controller = useRef<HoyaActionController | null>(null)
  if (!controller.current) controller.current = new HoyaActionController(setAction)
  const signal = controller.current
  const captureKey = `${session?.sessionId}:${round?.index}:${item?.itemId}:${attempt}`
  const modelKey = `${session?.sessionId}:${round?.index}:${item?.itemId}`

  function applyMagicBeam(available: boolean | undefined) {
    if (available === undefined) return
    setMagicBeamGranted(available)
    if (!available) setAttack('basic')
  }
  function stopFor(cause: unknown, fallback: string) {
    setError(cause instanceof Error ? cause.message : fallback)
    setNeedsTakeover(cause instanceof ApiError && cause.status === 409)
    suspendedRef.current = true; setSuspended(true); began.current = null; voice.current?.cancel()
  }

  useEffect(() => {
    mounted.current = true
    const tts = new KoreanTts({ onBlockedChange: blocked => {
      modelSpeaking.current = blocked
      if (!mounted.current) return
      pipelineRef.current?.resetUtterance()
      if (!blocked) promptShownAt.current = performance.now()
      setSpeaking(blocked)
    } })
    voice.current = tts
    return () => {
      mounted.current = false
      tts.dispose()
      actionTimers.current.forEach(window.clearTimeout)
      actionTimers.current = []
    }
  }, [])

  function adopt(live: ActivityStart) {
    setSession(live); sessionRef.current = live
    setRound(live.currentRound); setItem(live.firstItem)
    setAttempt(live.nextAttemptIndex ?? 1); setCompleted(live.completedRounds ?? [])
    sessionStorage.setItem('speechHero.activity', JSON.stringify(live))
    applyMagicBeam(live.magicBeamAvailable ?? false)
    suspendedRef.current = false; setSuspended(false); setError(''); setNeedsTakeover(false); setReady(true)
  }

  useEffect(() => {
    if (!id) { navigate('/play/map'); return }
    let active = true
    setReady(false)
    // StrictMode의 effect 재실행에도 최초 진행 권한을 두 번 발급받지 않는다.
    if (claimRequest.current?.id !== id) claimRequest.current = { id,
      promise: claimActivity(id, false, sessionRef.current?.sessionId === id ? sessionRef.current.leaseToken : undefined) }
    claimRequest.current.promise.then(live => {
      if (!active) return
      adopt(live)
    }).catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : '세션을 다시 열 수 없어요'); setNeedsTakeover(cause instanceof ApiError && cause.status === 409) } })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!ready || !session?.leaseToken) return
    let active = true
    const pause = () => {
      const current = sessionRef.current
      suspendedRef.current = true; setSuspended(true); began.current = null
      voice.current?.cancel()
      if (current && !current.sessionComplete) void pauseActivity(current).catch(() => undefined)
    }
    const visibility = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pause)
    const heartbeat = window.setInterval(() => {
      const current = sessionRef.current
      if (!current || document.hidden || suspendedRef.current) return
      void heartbeatActivity(current).catch(cause => { if (active) stopFor(cause, '연결을 확인한 뒤 다시 계속해 주세요') })
    }, 15000)
    return () => {
      active = false; window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pause)
      // 완료했거나 이 기기가 새 권한을 받은 뒤에는 이전 권한으로 멈춤을 보내지 않는다.
      const current = sessionRef.current
      if (!current?.sessionComplete && current?.leaseToken === session.leaseToken) void pauseActivity(session).catch(() => undefined)
    }
  }, [ready, session?.sessionId, session?.leaseToken])

  async function continueHere(takeover = false) {
    if (!id || busy) return
    setBusy(true)
    try { const live = await claimActivity(id, takeover, sessionRef.current?.leaseToken); if (mounted.current) adopt(live) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '연결을 확인해 주세요'); setNeedsTakeover(cause instanceof ApiError && cause.status === 409) }
    finally { if (mounted.current) setBusy(false) }
  }

  async function saveAndExit() {
    if (!session || busy) return
    suspendedRef.current = true; setSuspended(true); began.current = null; voice.current?.cancel(); setBusy(true)
    try { await pauseActivity(session); navigate('/play/home') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장 연결을 확인해 주세요') }
    finally { if (mounted.current) setBusy(false) }
  }

  async function finishActivity(live: ActivityStart) {
    const reward = await api<Record<string, unknown>>(`/play/sessions/${live.sessionId}/complete`, {
      method: 'POST', headers: { 'X-Activity-Lease': live.leaseToken ?? '' },
      body: JSON.stringify({ elapsedSec: Math.floor((Date.now() - startedAt.current) / 1000) }) })
    if (!mounted.current) return
    sessionStorage.removeItem('speechHero.activity')
    sessionStorage.setItem('speechHero.result', JSON.stringify(reward))
    navigate('/play/reward')
  }

  useEffect(() => {
    if (!ready || !session?.sessionComplete || suspended) return
    let active = true
    setBusy(true)
    void finishActivity(session).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '완료 저장을 다시 시도해 주세요') })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [ready, session, suspended])
  useEffect(() => { if (item) { setDemoSpeech(item.displayText); promptShownAt.current = performance.now() } }, [item?.itemId])
  useEffect(() => {
    if (!ready || suspended || session?.sessionComplete || !round || !item || round.elicitationType !== 'DIRECT_IMITATION') return
    if (session?.mode === 'real' && captureReadyKey !== captureKey) return
    if (lastModeledItem.current === modelKey) { modelPending.current = false; return }
    modelPending.current = true
    const speech = voice.current?.speak(item.displayText, {
      onStart: () => signal.command('TALKING'),
      onEnd: () => { lastModeledItem.current = modelKey; modelPending.current = false; signal.command('LISTENING') },
    }, { rate: 0.8 })
    return () => speech?.cancel()
  }, [ready, suspended, session?.sessionComplete, round?.index, item?.itemId, captureReadyKey])

  async function submit(acoustic: Acoustic, transcript: string | null) {
    if (!ready || suspendedRef.current || !session || !round || !item || submitting.current || modelSpeaking.current || !mounted.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    setMessage('두두가 듣고 있어…')
    try {
      const result = await sendActivityUtterance(session, item, round.index, attempt, transcript, acoustic, session.game === 'monster_adventure' ? attackRef.current : 'basic')
      if (!mounted.current) return
      actionTimers.current.forEach(window.clearTimeout)
      actionTimers.current = []
      const usedAttack = session.game === 'monster_adventure' ? attackRef.current : 'basic'
      applyMagicBeam(result.magicBeamAvailable)
      const kinds = new Set(result.events.map(event => event.type))
      const clear = result.events.find(event => event.type === 'ROUND_CLEAR')
      const stars = clear?.payload.stars
      const praise = clear?.payload.praise
      const material = clear?.payload.material === 'rice' || clear?.payload.material === 'tuna' ? clear.payload.material : undefined
      const validStars = typeof stars === 'number' && stars >= 1 && stars <= 3 ? stars : undefined
      if (validStars && typeof praise === 'string') setFeedback({ stars: validStars, praise, ...(material ? { material } : {}) })
      // 장면 효과는 서버가 돌려준 결과만 옮긴다. 다시 해보기는 실패 표시 없이 잔잔하게 보여 준다.
      const hitKind = kinds.has('TARGET_SUCCESS') ? 'hit' : kinds.has('TARGET_RETRY') ? 'retry' : 'none'
      if (hitKind !== 'none' || validStars) setFx({ id: ++fxCount.current, result: hitKind, attack: usedAttack, ...(validStars ? { stars: validStars } : {}), ...(material ? { material } : {}) })
      if (kinds.has('TARGET_SUCCESS')) { signal.dispatch(session.game, { type: 'TARGET_SUCCESS' }); setMessage('좋아! 다음 모험으로 가자!') }
      else if (kinds.has('LISTEN_AGAIN')) { signal.dispatch(session.game, { type: 'UNCERTAIN' }); setMessage('앗, 내가 잘 못 들었나 봐. 천천히 다시 말해줄래?') }
      else if (kinds.has('NO_SPEECH')) { signal.dispatch(session.game, { type: 'NO_SPEECH' }); setMessage('괜찮아, 준비되면 들려줘!') }
      else if (kinds.has('ITEM_ADVANCE')) { signal.dispatch(session.game, { type: 'UNCERTAIN' }); setMessage('다음 모험을 해보자!') }
      else if (kinds.has('STORY_CONTINUE')) { setMessage(result.dialogue?.text || '좋아, 같이 가자!'); signal.command('WALK_TO') }
      else { signal.dispatch(session.game, { type: 'TARGET_RETRY' }); setMessage('좋아, 같이 한 번 더 해보자!') }
      const spoken = [typeof praise === 'string' ? praise : '', result.dialogue?.text ?? ''].filter(Boolean).join(' ')
      if (spoken) {
        if (result.dialogue) {
        result.dialogue.hoyaActions.forEach((command, index) => {
          actionTimers.current.push(window.setTimeout(() => {
            if (mounted.current) signal.command(command as HoyaAction)
          }, index * 450))
        })
        }
        await voice.current?.speak(spoken, {
          onStart: () => signal.command('TALKING'), onEnd: () => signal.command('IDLE'),
        }).finished
        if (!mounted.current || suspendedRef.current) return
        actionTimers.current.forEach(window.clearTimeout)
        actionTimers.current = []
      }
      if (kinds.has('ROUND_CLEAR')) setCompleted(value => [...value, round.index])
      if (result.sessionComplete) {
        setSession({ ...session, sessionComplete: true })
        return
      }
      if (result.nextItem && result.currentRound) {
        if (!kinds.has('ROUND_CLEAR')) await new Promise(resolve => window.setTimeout(resolve, 1200))
        if (!mounted.current) return
        setRound(result.currentRound)
        setItem(result.nextItem)
        setAttempt(result.nextAttemptIndex)
      }
    } catch (cause) {
      if (mounted.current) {
        // 화면이 늦게 갱신돼 쓸 수 없는 매직빔을 보냈다면 멈추지 않고 기본 공격으로 돌린다. 시도는 쓰이지 않았다.
        if (cause instanceof ApiError && cause.status === 403 && attackRef.current === 'magic_beam') {
          applyMagicBeam(false); setMessage('이번엔 기본 공격으로 해보자!')
        } else stopFor(cause, '연결을 확인해 주세요')
      }
    }
    finally { submitting.current = false; began.current = null; if (mounted.current) setBusy(false) }
  }

  useEffect(() => {
    if (!ready || suspended || !session || session.sessionComplete || !round || !item || session.mode !== 'real' || !realSupported) return
    const capture = new AudioCapture()
    // 발화 뒤 기다리는 시간은 라운드가 정한다. 쉼 후 재개 라운드는 한 발화 안에서 자연스러운 쉼을 허용한다.
    const pipeline = new MicUtterancePipeline(session.game === 'magic_beam' ? 'fricative' : 'any_sound', round.endHoldMs ?? DEFAULT_VAD.endHoldMs)
    pipelineRef.current = pipeline
    const recognizer = new WebSpeechRecognizer()
    setCaptureReadyKey(null)
    modelPending.current = round.elicitationType === 'DIRECT_IMITATION' && lastModeledItem.current !== modelKey
    let disposed = false
    let recognizing = false
    let awaitingRecognition = false
    let wasListening = false
    capture.start(frame => {
      // 모델 음성은 초기 주변 소리 보정에도 넣지 않는다.
      if (disposed || suspendedRef.current || awaitingRecognition || submitting.current || modelSpeaking.current) { wasListening = false; return }
      if (!pipeline.calibrated) {
        pipeline.process(frame)
        if (pipeline.calibrated) { pipeline.resetUtterance(); setCaptureReadyKey(captureKey) }
        return
      }
      if (modelPending.current) return
      if (!wasListening) { pipeline.resetUtterance(); wasListening = true }
      const { events, acoustic } = pipeline.process(frame)
      for (const event of events) {
        if (event.type === 'VOICE_START') {
          onsetLatency.current = Math.min(60000, Math.max(0, performance.now() - promptShownAt.current))
          pipeline.onsetLatencyMs = onsetLatency.current
          signal.dispatch(session.game, { type: 'VOICE_START' })
          setMessage('두두가 힘을 모으고 있어!')
          if (session.game === 'monster_adventure' || session.game === 'conversation_quest') {
            try {
              recognizer.start(item as Parameters<WebSpeechRecognizer['start']>[0])
              recognizing = true
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : '음성 인식을 다시 시작해 주세요')
            }
          }
        }
        if (event.type === 'VOICE_CONTINUE') signal.dispatch(session.game, { type: 'VOICE_CONTINUE', energy01: pipeline.tracker.energy01 })
        if (event.type === 'VOICE_END' && acoustic) {
          signal.dispatch(session.game, { type: 'VOICE_END' })
          if (session.game === 'monster_adventure' || session.game === 'conversation_quest') {
            awaitingRecognition = true
            void recognizer.stop().then(result => {
              recognizing = false; awaitingRecognition = false
              if (!disposed) return submit(acoustic, result.transcript)
            }).catch(cause => {
              recognizing = false; awaitingRecognition = false
              if (!disposed) setError(cause instanceof Error ? cause.message : '음성 인식을 다시 시작해 주세요')
            })
          } else void submit(acoustic, null)
        }
      }
    }).catch(cause => { if (!disposed) setError(cause instanceof Error ? cause.message : '마이크를 사용할 수 없어요') })
    return () => {
      disposed = true; capture.stop()
      if (pipelineRef.current === pipeline) pipelineRef.current = null
      if (recognizing) void recognizer.stop().catch(() => undefined)
    }
  }, [ready, suspended, item?.itemId, round?.index, round?.endHoldMs, attempt, session?.mode, session?.sessionComplete, realSupported])

  function begin() {
    if (!ready || suspendedRef.current || !session || sessionRef.current?.sessionComplete || busy || submitting.current || modelSpeaking.current || began.current !== null) return
    began.current = performance.now()
    onsetLatency.current = Math.min(60000, Math.max(0, began.current - promptShownAt.current))
    signal.dispatch(session.game, { type: 'VOICE_START' })
    setMessage('두두가 힘을 모으고 있어!')
  }
  function end(transcriptOverride?: string) {
    if (!mounted.current || !session || !round || !item || began.current === null) return
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
  }, [session?.mode, round?.index, item?.itemId, busy, ready])

  if (ready && session?.sessionComplete) return <main className="child-screen game-screen"><p>다섯 라운드를 마쳤어! 완료를 저장하고 있어요.</p>{error && <><p role="alert">{error}</p><button disabled={busy} onClick={() => void continueHere()}>완료 저장 다시 시도</button></>}</main>
  if (!ready || !session || !round || !item) return <main className="child-screen game-screen"><p>{error ? '모험을 열기 전에 확인해 주세요.' : '모험을 다시 불러오는 중…'}</p>{error && <><p role="alert">{error}</p><p>이 기기에서 이어받으면 이전 기기는 더 이상 제출할 수 없어요.</p><button disabled={busy} onClick={() => void continueHere(true)}>이 기기에서 이어받기</button><button className="quiet" onClick={() => navigate('/play/map')}>모험 지도로</button></>}</main>
  return <main className={`child-screen game-screen activity-game activity-${session.game}`}><div className="activity-shell">
    <header className="activity-header"><div><p className="eyebrow">ADVENTURE · {session.mode === 'demo' ? 'DEMO 연습' : '실제 음성'}</p><h1>{gameNames[session.game]}</h1></div><span>ROUND {round.index} / {session.rounds.length}</span><button className="quiet dudu-save-exit" disabled={busy} onClick={() => void saveAndExit()}>저장하고 집으로</button></header>
    <div className="activity-progress" aria-label="다섯 라운드">{session.rounds.map(value => <span key={value.id} className={completed.includes(value.index) ? 'completed' : value.index === round.index ? 'current' : ''} aria-current={value.index === round.index ? 'step' : undefined}><small>{String(value.index).padStart(2, '0')}</small><span>{completed.includes(value.index) ? '완료' : value.index === round.index ? '진행 중' : '다음'}</span></span>)}</div>
    <section className="activity-stage"><ActivityScene game={session.game} action={action} magicBeam={attack === 'magic_beam'} fx={fx} />
      <div className="activity-instruction"><p className="eyebrow">TODAY'S MOMENT</p><h2>{round.childTitle.replace(/호야|루미/g, '두두')}</h2><p>{round.childPrompt.replace(/호야|루미/g, '두두')}</p><div className="activity-target"><span>이번에 말할 것</span><strong>{item.displayText}</strong></div><p className="activity-message" aria-live="polite">{message.replace(/호야|루미/g, '두두')}</p>
        {feedback && <RoundFeedback key={fx?.id} {...feedback} />}
        {session.game === 'monster_adventure' && <AttackChoice value={attack} magicBeam={magicBeamGranted} disabled={busy || speaking} onChange={setAttack} />}
        <div className="activity-controls">
          {suspended && <div role="status"><p>모험을 잠시 멈췄어요. 연결을 확인한 뒤 계속해요.</p><button disabled={busy} onClick={() => void continueHere()}>다시 계속하기</button>
            {needsTakeover && <><p>이 기기에서 이어받으면 이전 기기는 더 이상 제출할 수 없어요.</p><button disabled={busy} onClick={() => void continueHere(true)}>이 기기에서 이어받기</button></>}</div>}
          {session.mode === 'demo' && session.game === 'conversation_quest' && <div className="activity-demo-dialogue"><label>두두에게 들려줄 말<input value={demoSpeech} onChange={event => setDemoSpeech(event.target.value)} maxLength={50} /></label>{round.index === 1 && <div><button disabled={busy || speaking} onClick={() => { begin(); window.setTimeout(() => end(item.displayText), 350) }}>{item.displayText} 고르기</button><button disabled={busy || speaking} onClick={() => { begin(); window.setTimeout(() => end('바나나'), 350) }}>바나나 고르기</button></div>}</div>}
          {session.mode === 'demo' && <button className="activity-hold" disabled={busy || speaking || suspended} onPointerDown={begin} onPointerUp={() => end()} onPointerLeave={() => end()}>누르고 말하기 <span>Space</span></button>}
          {speaking && <p className="small" aria-live="polite">두두가 말한 뒤 네 차례가 와요.</p>}
          {session.mode === 'real' && captureReadyKey !== captureKey && <p role="status">주변 소리를 확인할게. 잠깐 조용히 기다려줘!</p>}
          {!realSupported && <p role="alert" className="notice">{missingText(session.game, capabilities)}</p>}
          {error && <p role="alert" className="notice">{error}</p>}
        </div>
      </div>
    </section>
    <p className="activity-footnote">{session.mode === 'demo' ? 'DEMO 입력입니다. 실제 발음 평가가 아닙니다.' : '음향 특징과 브라우저 인식 결과를 사용한 기초 추정입니다.'}</p>
  </div></main>
}
