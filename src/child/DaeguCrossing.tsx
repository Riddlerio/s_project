import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HoyaAction } from '../control/speechGameSignal'
import { ARRIVAL_STRIPE, CrossingScene } from '../game/crossing/CrossingScene'
import {
  listenAgainLine, MISS_LINE, modelLine, nextPace, onsetReason, praiseLine, retryLine, ROUND_TITLES, START_PACE, STRIPES,
  type CrossingItem, type CrossingResult, type Pace, type PaceEvent,
} from '../game/crossing/crossingFlow'
import { previewJudge, serverJudge, type CrossingJudge, type CrossingTurn } from '../game/crossing/crossingJudge'
import { OnsetPipeline } from '../game/crossing/onsetPipeline'
import { ApiError } from '../api/client'
import type { Acoustic } from '../shared/types'
import { AudioCapture } from '../speech/audioCapture'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'
import { KoreanTts } from '../speech/koreanTts'
import { unlockDuduAudio } from '../speech/duduClips'
import { playFx, playTurnChime, PopBurst, unlockFx, VoiceCredit, type PopKind } from './demoFx'
import { TurnCue } from './turnCue'
import { isName } from './koreanText'
import './duduDemo.css'

/*
 * '대구대 건너기'(2026-10-05 데모). 말풍선이 두두 머리 위 동그라미에 들어오면 아이가 그 소리를 말한다.
 * 서버가 성공이라고 하면 두두가 횡단보도 흰 줄 하나를 폴짝 건넌다. 다시·불확실·무발화는 실패로 보여 주지 않는다.
 * 듣는 동안 두두는 멈춘다(정지 규칙). 점수·정확도는 아이 화면에 보이지 않는다.
 */
type Card = 'hidden' | 'away' | 'here' | 'gone' | 'cleared'
const PRAISE_SHOW_MS = 1400
/** 칭찬 말풍선 둘레에 한 번 반짝이는 별(위치·지연·색). 빨간색은 쓰지 않는다. */
const PRAISE_SPARKS = [
  { x: '-14px', y: '-12px', d: '0ms', c: '#f4b400' }, { x: '96%', y: '-16px', d: '120ms', c: '#7ac13a' },
  { x: '102%', y: '60%', d: '220ms', c: '#ffd75e' }, { x: '-20px', y: '70%', d: '320ms', c: '#13a389' },
  { x: '48%', y: '-22px', d: '180ms', c: '#ffffff' },
]
const MAX_SPEECH_MS = 4000
// 말풍선이 동그라미에 들어온 뒤 이 안에 말을 시작하면 '딱 맞았어!'(큰 펑). 화면 연출일 뿐 판정·기록에 쓰지 않는다.
const ON_TIME_MS = 1500
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** preview: 개발 검토 화면(crossing-review.html)에서만 true. 서버 없이 근사 판정으로 장면을 확인한다. */
export default function DaeguCrossing({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate()
  const [capabilities] = useState(() => detectCapabilities())
  const realSupported = supportsRealMode('daegu_crossing', capabilities)
  const [phase, setPhase] = useState<'intro' | 'play' | 'arrive'>('intro')
  const [mode, setMode] = useState<'real' | 'demo'>('demo')
  const [item, setItem] = useState<CrossingItem | null>(null)
  const [card, setCard] = useState<Card>('hidden')
  const [cardKey, setCardKey] = useState(0)
  const [windowOpen, setWindowOpen] = useState(false)
  const [stripe, setStripe] = useState(0)
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [caption, setCaptionText] = useState('')
  // 칭찬(praise)·도착(arrive) 말풍선은 금빛으로 통통 튀고 글자가 하나씩 떠오른다(화면 연출).
  const [captionStyle, setCaptionStyle] = useState<'normal' | 'praise' | 'arrive'>('normal')
  const [captionKey, setCaptionKey] = useState(0)
  const setCaption = (text: string, style: 'normal' | 'praise' | 'arrive' = 'normal') => {
    setCaptionText(text); setCaptionStyle(style); setCaptionKey(key => key + 1)
  }
  const [pop, setPop] = useState<{ key: number; kind: PopKind; label: string } | null>(null)
  const [countdown, setCountdown] = useState('')
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState('')
  const [holding, setHolding] = useState(false)
  const pace = useRef<Pace>(START_PACE)
  const history = useRef<PaceEvent[]>([])
  const judge = useRef<CrossingJudge | null>(null)
  const heroName = useRef('')
  const voice = useRef<KoreanTts | null>(null)
  const capture = useRef<AudioCapture | null>(null)
  const pipeline = useRef<OnsetPipeline | null>(null)
  const listening = useRef(false)
  const speaking = useRef(false)
  const busy = useRef(false)
  const timers = useRef<number[]>([])
  const windowTimer = useRef<number | null>(null)
  const holdStart = useRef<number | null>(null)
  const windowOpenedAt = useRef(0)
  const speechStartAt = useRef<number | null>(null)
  const current = useRef<CrossingItem | null>(null)
  const counts = useRef({ attempts: 0, successes: 0 })
  const startedAt = useRef(0)
  const firstWord = useRef<string | null>(null)
  // 타이머 안에서 읽는 값은 ref로 둔다(지난 렌더의 값을 읽지 않게).
  const pausedRef = useRef(false)
  const modeRef = useRef<'real' | 'demo'>('demo')
  const mounted = useRef(true)
  const still = reducedMotion()

  useEffect(() => {
    mounted.current = true
    const tts = new KoreanTts({ onBlockedChange: blocked => {
      speaking.current = blocked
      // 두두 목소리가 마이크로 들어간 조각을 버린다.
      if (!blocked) pipeline.current?.resetUtterance()
    } })
    voice.current = tts
    return () => { mounted.current = false; clearTimers(); capture.current?.stop(); tts.dispose() }
  }, [])

  function later(callback: () => void, ms: number) {
    const id = window.setTimeout(() => { if (mounted.current) callback() }, ms)
    timers.current.push(id)
  }
  function clearTimers() {
    timers.current.forEach(id => window.clearTimeout(id)); timers.current = []
    if (windowTimer.current !== null) window.clearTimeout(windowTimer.current)
    windowTimer.current = null
  }
  /** 두두가 말한다(자막 + 입 움직임). 끝나면 then을 부른다. */
  function say(text: string, then?: () => void, speakingAction: HoyaAction = 'TALKING', style: 'normal' | 'praise' | 'arrive' = 'normal') {
    setCaption(text, style)
    const tts = voice.current
    if (!tts) { then?.(); return }
    void tts.speak(text, { onStart: () => setAction(speakingAction) }, { rate: 0.85 }).finished.then(() => { if (mounted.current) then?.() })
  }

  async function begin(selected: 'real' | 'demo') {
    unlockDuduAudio(); unlockFx()
    setError(''); setMode(selected); modeRef.current = selected
    const provider = preview ? previewJudge() : serverJudge(selected)
    judge.current = provider
    try {
      const started = await provider.start()
      if (!mounted.current) return
      heroName.current = started.heroName
      if (selected === 'real') await startMicrophone()
      startedAt.current = Date.now()
      setPhase('play')
      // 시작 전 기대감: 두두가 손을 흔들며 "준비~ 시작!"
      setAction('WAVE'); setCountdown('준비~')
      later(() => setCountdown('시작!'), 900)
      later(() => { setCountdown(''); present(started.first, pace.current.approachMs) }, 1600)
    } catch (cause) {
      // 서버가 이 게임을 모르면 422다(서버 작업 전). 그 밖에는 서버가 준 문구를 쓴다.
      setError(cause instanceof ApiError && cause.status === 422 ? '서버에 아직 대구대 건너기가 준비되지 않았어요.'
        : cause instanceof Error && typeof cause.message === 'string' && !cause.message.startsWith('[object') ? cause.message : '게임을 시작할 수 없어요')
    }
  }

  async function startMicrophone() {
    const onset = new OnsetPipeline()
    pipeline.current = onset
    const mic = new AudioCapture()
    capture.current = mic
    await mic.start(frame => {
      if (!onset.calibrated) { onset.process(frame); return }
      if (!listening.current || speaking.current) return
      const { events, acoustic } = onset.process(frame)
      if (events.some(event => event.type === 'VOICE_START')) speechStartAt.current ??= performance.now()
      if (events.some(event => event.type === 'VOICE_START') && windowTimer.current !== null) {
        // 말을 시작했으면 기다림 시간이 끝나도 말을 다 들을 때까지 기다린다(최대 4초).
        window.clearTimeout(windowTimer.current)
        windowTimer.current = window.setTimeout(() => { if (listening.current) closeWindow(null) }, MAX_SPEECH_MS)
      }
      if (acoustic) closeWindow(acoustic)
    })
  }

  /** 말풍선이 오른쪽에서 다가와 동그라미에 들어온다. 1라운드는 두두가 먼저 들려준다. */
  function present(next: CrossingItem, approachMs: number) {
    current.current = next
    setItem(next); setCardKey(key => key + 1); setCard('away'); setWindowOpen(false)
    setAction('IDLE'); setCaption('')
    if (next.level === 'word' && firstWord.current === null) firstWord.current = next.text
    requestAnimationFrame(() => requestAnimationFrame(() => { if (mounted.current) setCard('here') }))
    later(() => {
      if (next.modelCue) say(modelLine(next.text), openWindow)
      else openWindow()
    }, still ? 300 : approachMs)
  }

  /** '네 차례': 두두 귀 쫑긋 + 차임 → 차임이 다 들린 뒤 듣기를 열고 빛·배지를 켠다(차임이 마이크에 들어가지 않게). */
  function openWindow() {
    if (pausedRef.current) return
    setAction('LISTENING')
    later(() => {
      setWindowOpen(true); setCaption(`'${current.current?.text}' 하고 말해 줘!`)
      pipeline.current?.resetUtterance()
      windowOpenedAt.current = performance.now(); speechStartAt.current = null
      listening.current = true
      windowTimer.current = window.setTimeout(() => { if (listening.current) closeWindow(null) }, pace.current.windowMs)
    }, playTurnChime())
  }

  /** 듣기를 끝낸다. acoustic이 없으면 기다리는 동안 말이 없었던 것(지나감)이다. */
  function closeWindow(acoustic: Acoustic | null) {
    if (!listening.current) return
    listening.current = false
    if (windowTimer.current !== null) window.clearTimeout(windowTimer.current)
    windowTimer.current = null
    setWindowOpen(false)
    void submit(acoustic)
  }

  async function submit(acoustic: Acoustic | null) {
    const provider = judge.current, item = current.current
    if (!provider || !item || busy.current) return
    busy.current = true
    if (acoustic) counts.current.attempts++
    else { setCard('gone'); setAction('THINKING'); playFx('whoosh'); say(MISS_LINE, undefined, 'THINKING') }
    try {
      const sent: Acoustic = acoustic ?? { durationMs: 0, voicedMs: 0, activeMs: 0, meanRmsDb: -60, peakRmsDb: -60, meanHfRatio: 0, onsetLatencyMs: 0, source: modeRef.current === 'demo' ? 'keyboard' : 'microphone' }
      const turn = await provider.submit(item, { transcript: null, acoustic: sent })
      if (mounted.current) react(turn, acoustic)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장 연결을 확인해 주세요')
    } finally { busy.current = false }
  }

  function react(turn: CrossingTurn, acoustic: Acoustic | null) {
    const item = current.current!
    const missed = acoustic === null
    const event: PaceEvent = missed ? 'miss' : turn.result
    history.current.push(event)
    pace.current = nextPace(pace.current, history.current)
    const advanced = turn.next === null || turn.next.stripeIndex !== item.stripeIndex

    const proceed = () => {
      if (turn.complete || !turn.next) { arrive(); return }
      present(turn.next, advanced ? pace.current.approachMs : Math.max(1500, pace.current.approachMs / 2))
    }
    if (turn.result === 'success') {
      counts.current.successes++
      setCard('cleared'); setStripe(value => Math.min(STRIPES, value + 1)); setAction('CHEER')
      const started = speechStartAt.current
      const kind: PopKind = started !== null && started - windowOpenedAt.current <= ON_TIME_MS ? 'perfect' : 'good'
      const line = praiseLine(counts.current.successes - 1)
      setPop({ key: Date.now(), kind, label: kind === 'perfect' ? '딱 맞았어!' : '펑!' }); playFx(kind)
      later(() => setPop(null), PRAISE_SHOW_MS)
      say(kind === 'perfect' ? `딱 맞았어! ${line}` : line, () => later(proceed, 300), 'CHEER', 'praise')
      return
    }
    if (missed) { later(proceed, 1800); return }
    const result: CrossingResult = turn.result
    // 결과는 서버 판정을 따르고, 단서 문구만 같은 음향 요약으로 고른다(기준이 다르면 기본 단서).
    if (result === 'retry') say(retryLine(acoustic.source === 'keyboard' ? null : onsetReason(acoustic), item.text), proceed, 'ENCOURAGE')
    else say(listenAgainLine(item.text), proceed)
  }

  /** 끝: 남은 줄을 두두가 이어서 건너 정문에 도착한다(실패 연출 없음). */
  function arrive() {
    setPhase('arrive'); setCard('hidden'); setWindowOpen(false)
    listening.current = false
    capture.current?.stop()
    const remaining = STRIPES - counts.current.successes
    const walk = (left: number) => {
      if (left <= 0) { finale(); return }
      setStripe(value => Math.min(STRIPES, value + 1)); later(() => walk(left - 1), still ? 50 : 380)
    }
    if (remaining > 0) say('남은 길은 두두랑 같이 가자!', () => walk(remaining))
    else finale()
  }
  function finale() {
    setStripe(ARRIVAL_STRIPE); setAction('CHEER')
    const name = heroName.current
    void judge.current?.finish(Math.floor((Date.now() - startedAt.current) / 1000)).catch(() => undefined)
    say(`도착! 정말 잘했어! 역시 ${name ? isName(name) : '최고야'}!`, () => later(() => navigate('/play/goodbye', {
      state: { attempts: counts.current.attempts, word: firstWord.current ?? '사과', heroName: name } }), 1200), 'CHEER', 'arrive')
  }

  function togglePause() {
    if (!pausedRef.current) {
      pausedRef.current = true; setPaused(true); clearTimers(); listening.current = false; setWindowOpen(false); voice.current?.cancel()
      setCaption('잠깐 쉬어요. 준비되면 다시 시작을 눌러 줘.'); setAction('IDLE')
    } else {
      pausedRef.current = false; setPaused(false)
      if (current.current) present(current.current, pace.current.approachMs)
    }
  }

  // DEMO: 누르고 있는 동안 말하는 것으로 본다(실제 발음 평가가 아님).
  function holdDown() { if (listening.current) { holdStart.current = performance.now(); speechStartAt.current ??= holdStart.current; setHolding(true) } }
  function holdUp() {
    if (holdStart.current === null) return
    const ms = Math.round(performance.now() - holdStart.current)
    holdStart.current = null; setHolding(false)
    closeWindow({ durationMs: ms, voicedMs: ms, activeMs: ms, bestRunMs: ms, fricationMs: Math.min(ms, 200), meanRmsDb: -20, peakRmsDb: -12,
      meanHfRatio: 0.5, onsetLatencyMs: 0, source: 'keyboard', onsetFricationMs: 150, voicedAfterFricationMs: Math.max(0, ms - 150) })
  }
  useEffect(() => {
    if (phase !== 'play' || mode !== 'demo') return
    const down = (event: KeyboardEvent) => { if (event.code === 'Space' && !event.repeat) { event.preventDefault(); holdDown() } }
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') { event.preventDefault(); holdUp() } }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  })

  const roundIndex = item?.roundIndex ?? 1
  return <main className="crossing-screen"><div className="crossing-shell">
    <header className="crossing-top">
      <div><p className="eyebrow">대구대 건너기{mode === 'demo' ? ' · DEMO 연습' : ''}{preview ? ' · 미리보기(서버 판정 아님)' : ''}</p>
        <h1>{phase === 'play' ? (stripe < STRIPES ? `정문까지 ${STRIPES - stripe}칸!` : '거의 다 왔어!') : '두두랑 대구대까지!'}</h1>
        {phase === 'play' && <span className="crossing-chip">{ROUND_TITLES[roundIndex - 1]}</span>}</div>
      {phase === 'play' && <button className="secondary-action" onClick={togglePause}>{paused ? '다시 시작' : '잠깐 쉬기'}</button>}
    </header>

    {phase === 'intro' && <section className="crossing-intro">
      <div className="crossing-intro-art" aria-hidden="true"><span>🚦 초록불! 대구대까지 10칸</span></div>
      <h2>두두랑 횡단보도를 건너 대구대까지 가요</h2>
      <ol>
        <li><b>1</b>말풍선이 두두 머리 위 동그라미에 들어오면 그 소리를 말해 줘.</li>
        <li><b>2</b>잘 말하면 펑! 두두가 흰 줄 하나를 폴짝 건너요.</li>
        <li><b>3</b>처음에는 두두가 먼저 들려줄게. 천천히 해도 괜찮아!</li>
      </ol>
      <div className="crossing-controls">
        <button disabled={!realSupported} onClick={() => { void begin('real') }}>마이크로 시작</button>
        <button className="secondary-action" onClick={() => { void begin('demo') }}>DEMO로 시작(누르고 말하기)</button>
      </div>
      {!realSupported && <p className="small">{missingText('daegu_crossing', capabilities)}</p>}
      <p className="crossing-badge">게임 속 칭찬은 박자·시도에 대한 응원이에요. 발음은 선생님이 따로 확인해요.</p>
    </section>}

    {phase !== 'intro' && <>
      <div className="crossing-stage">
        <CrossingScene stripe={stripe} action={action} animate={!windowOpen && !still && !paused} bob={phase === 'play'} arrived={phase === 'arrive'} />
        {phase === 'play' && <div className="crossing-lane" aria-hidden="true">
          <div className={`crossing-ring${windowOpen ? ' open' : ''}`} />
          {item && card !== 'hidden' && <div key={cardKey} className={`crossing-card ${item.level === 'word' ? 'word' : ''} ${card}`}
            style={{ ['--approach' as string]: `${pace.current.approachMs}ms` }}>{item.text}</div>}
        </div>}
        {pop && <PopBurst key={pop.key} kind={pop.kind} label={pop.label} still={still} />}
        {countdown && <div className="crossing-countdown" role="status">{countdown}</div>}
        <TurnCue on={phase === 'play' && windowOpen} />
      </div>
      <p key={captionKey} className={`crossing-caption${caption ? '' : ' empty'}${captionStyle === 'normal' ? '' : ` ${captionStyle}`}`} aria-live="polite">
        {captionStyle === 'normal' || still ? caption || ' ' : <>
          {/* 낱말 단위로 묶어 줄이 바뀌어도 '!' 같은 한 글자만 따로 떨어지지 않게 한다. 글자 지연은 문장 전체 순서를 따른다. */}
          {caption.split(' ').map((word, w, words) => {
            const start = words.slice(0, w).reduce((sum, previous) => sum + [...previous].length + 1, 0)
            return <span key={w}>{w > 0 && ' '}<span className="praise-word">{[...word].map((char, i) => <span key={i} className="praise-char" style={{ ['--i' as string]: start + i }}>{char}</span>)}</span></span>
          })}
          {PRAISE_SPARKS.map((spark, i) => <i key={i} className="praise-spark" aria-hidden="true" style={{ ['--x' as string]: spark.x, ['--y' as string]: spark.y, ['--d' as string]: spark.d, ['--c' as string]: spark.c }} />)}
        </>}
      </p>
      <div className="crossing-path" aria-label={`흰 줄 ${STRIPES}개 중 ${Math.min(stripe, STRIPES)}개 건넘`}>
        <span className="crossing-path-end start" aria-hidden="true">출발</span>
        {Array.from({ length: STRIPES }, (_, i) => <span key={i} className={`crossing-path-step${i < stripe ? ' done' : ''}${i === stripe ? ' here' : ''}`}>{i === stripe && phase === 'play' ? '🐾' : ''}</span>)}
        <span className="crossing-path-end goal" aria-hidden="true">대구대</span>
      </div>
      {phase === 'play' && mode === 'demo' && <div className="crossing-controls">
        <button className={holding ? 'pressed' : ''} disabled={!windowOpen && !holding}
          onPointerDown={holdDown} onPointerUp={holdUp} onPointerLeave={() => { if (holdStart.current !== null) holdUp() }}>누르고 말하기 <span className="small">Space</span></button>
        <p className="small">DEMO 입력입니다. 실제 발음 평가가 아닙니다.</p>
      </div>}
    </>}
    {error && <p role="alert" className="notice">{error}</p>}
    <VoiceCredit />
  </div></main>
}
