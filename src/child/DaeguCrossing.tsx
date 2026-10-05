import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HoyaAction } from '../control/speechGameSignal'
import { ARRIVAL_STRIPE, CrossingScene, type BeatGrid } from '../game/crossing/CrossingScene'
import {
  callWord, LISTEN_AGAIN_LEAD, MISS_LINE, MODEL_LEAD, onsetReason, praiseLine, retryLine, ROUND_TITLES, STRIPES,
  type CrossingItem, type PaceEvent,
} from '../game/crossing/crossingFlow'
import { previewJudge, serverJudge, type CrossingJudge, type CrossingTurn } from '../game/crossing/crossingJudge'
import { OnsetPipeline } from '../game/crossing/onsetPipeline'
import {
  bar, barMs, beatLeadMs, beatMs, COUNT_IN, DEFAULT_RHYTHM, nextBarStart, nextBeat, nextBpm, timingKind, type Bar, type RhythmSetting,
} from '../game/crossing/rhythm'
import { ApiError } from '../api/client'
import type { Acoustic } from '../shared/types'
import { AudioCapture } from '../speech/audioCapture'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'
import { KoreanTts } from '../speech/koreanTts'
import { unlockDuduAudio } from '../speech/duduClips'
import { outputLatencyMs, playFx, PopBurst, scheduleTicks, unlockFx, VoiceCredit, type PopKind, type TickHandle } from './demoFx'
import { TurnCue } from './turnCue'
import { RetryTipCard } from './RetryTip'
import { MISS_TIP, retryTip, type RetryTip } from '../game/crossing/retryTips'
import { isName } from './koreanText'
import { hasPicture, WordPicture } from './WordPicture'
import './duduDemo.css'

/*
 * '대구대 건너기'(2026-10-05 데모, 같은 날 사용자 결정으로 박자가 있는 리듬게임으로 바꿈). 박자 규칙은 game/crossing/rhythm.ts에 있다.
 * 진행
 * - 두두가 박을 타며 '하나·둘·셋·넷'으로 시작한다.
 * - 카드마다 한 마디: 1·2·3박 '똑'과 함께 카드가 다가와 4박에 두두 머리 위 동그라미에 들어오고, 아이가 그 박에 말한다.
 * - 두두가 먼저 들려줄 때(1라운드, 다시 들려주기)는 두두 마디(4박에 두두가 부름)가 먼저 온다.
 * 판정과 연출
 * - 서버가 성공이라고 하면 두두가 다음 박에 흰 줄 하나를 폴짝 건넌다.
 * - 박 맞춤('딱 맞았어!')은 화면 연출이고 저장하지 않는다.
 * - 다시·불확실·무발화는 실패로 보여 주지 않는다.
 * 지켜야 할 규칙
 * - '똑' 소리가 다 들린 뒤에 마이크를 연다('네 차례' 규칙).
 * - 듣는 동안 두두는 멈춘다(정지 규칙).
 * - 점수·정확도는 아이 화면에 보이지 않는다.
 */
type Card = 'hidden' | 'away' | 'here' | 'landed' | 'gone' | 'cleared'
const PRAISE_SHOW_MS = 1400
/** 칭찬 말풍선 둘레에 한 번 반짝이는 별(위치·지연·색). 빨간색은 쓰지 않는다. */
const PRAISE_SPARKS = [
  { x: '-14px', y: '-12px', d: '0ms', c: '#f4b400' }, { x: '96%', y: '-16px', d: '120ms', c: '#7ac13a' },
  { x: '102%', y: '60%', d: '220ms', c: '#ffd75e' }, { x: '-20px', y: '70%', d: '320ms', c: '#13a389' },
  { x: '48%', y: '-22px', d: '180ms', c: '#ffffff' },
]
const MAX_SPEECH_MS = 4000
/** 다음 마디를 잡을 때 최소 여유(카드·소리 예약). */
const LEAD_MS = 320
/** 귀 쫑긋(0.38초)이 마이크가 열리기 전에 끝나도록 3박보다 조금 먼저 듣기 자세를 잡는다. */
const PERK_LEAD_MS = 120
/** 음성 파일 재생 시작 지연(대략). 두두가 박에 맞춰 부를 때 그만큼 먼저 튼다. */
const CLIP_START_MS = 40
/** 말 시작 감지는 분석 창(약 20ms)만큼 늦다. 박 맞춤 연출에만 쓴다. */
const DETECT_LAG_MS = 20
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
  // 같은 카드를 다시 할 때 위쪽에 보이는 도움말(입 모양 그림 + 짧은 안내). 맞거나 다음 카드로 넘어가면 지운다.
  const [tip, setTip] = useState<RetryTip | null>(null)
  const [countdown, setCountdown] = useState('')
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState('')
  const [holding, setHolding] = useState(false)
  // 박 표시: 지금 마디의 몇째 박인지(0이면 박 없음), 누구 마디인지(두두가 부르는 마디·아이 마디).
  const [beat, setBeat] = useState(0)
  const [beatSerial, setBeatSerial] = useState(0)
  const [turn, setTurn] = useState<'dudu' | 'child' | null>(null)
  const [tempo, setTempo] = useState(DEFAULT_RHYTHM.startBpm)
  const rhythm = useRef<RhythmSetting>(DEFAULT_RHYTHM)
  const bpm = useRef(DEFAULT_RHYTHM.startBpm)
  // 박 격자: anchor는 어떤 마디의 시작 시각(performance.now 기준). 두두가 이 격자에 맞춰 몸을 흔든다.
  const grid = useRef<BeatGrid | null>(null)
  const ticks = useRef<TickHandle[]>([])
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
  const landAt = useRef(0)
  const speechStartAt = useRef<number | null>(null)
  const current = useRef<CrossingItem | null>(null)
  const counts = useRef({ attempts: 0, successes: 0 })
  const startedAt = useRef(0)
  const firstWord = useRef<string | null>(null)
  const modelIntroduced = useRef(false)
  // 오늘 연습한 말(마무리 화면에 그림 카드로 보여 준다. 맞았는지는 넘기지 않는다)
  const practiced = useRef<string[]>([])
  // 쉬는 동안 마지막 줄까지 끝났으면 다시 시작할 때 도착으로 간다.
  const finishedWhilePaused = useRef(false)
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
  /** 박 격자 위의 시각(performance.now 기준)에 부른다. */
  function at(time: number, callback: () => void) { later(callback, Math.max(0, time - performance.now())) }
  function tick(times: readonly number[]) { ticks.current.push(scheduleTicks(times)) }
  function clearTimers() {
    timers.current.forEach(id => window.clearTimeout(id)); timers.current = []
    ticks.current.forEach(handle => handle.cancel()); ticks.current = []
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
  function beatAt(time: number, n: number) { at(time, () => { setBeat(n); setBeatSerial(value => value + 1) }) }

  async function begin(selected: 'real' | 'demo') {
    unlockDuduAudio(); unlockFx()
    setError(''); setMode(selected); modeRef.current = selected
    const provider = preview ? previewJudge() : serverJudge(selected)
    judge.current = provider
    try {
      const started = await provider.start()
      if (!mounted.current) return
      heroName.current = started.heroName
      rhythm.current = started.rhythm
      bpm.current = started.rhythm.startBpm; setTempo(started.rhythm.startBpm)
      if (selected === 'real') await startMicrophone()
      startedAt.current = Date.now()
      // 첫 카드는 박을 센 뒤에 낸다. 그 사이에 쉬었다가 다시 시작해도 이 카드부터 이어진다.
      current.current = started.first
      setPhase('play')
      const countIn = () => {
        // 박을 타며 시작: 두두가 박에 맞춰 몸을 흔들고 '하나·둘·셋·넷' 한 마디를 센 다음 첫 카드가 온다.
        const start = performance.now() + 450
        grid.current = { anchor: start, bpm: bpm.current }
        setAction('IDLE')
        const intro = bar(start, bpm.current)
        tick(intro.beats)
        intro.beats.forEach((time, i) => { at(time, () => setCountdown(COUNT_IN[i])); beatAt(time, i + 1) })
        at(intro.land + beatMs(bpm.current) * 0.8, () => { setCountdown(''); setBeat(0) })
        at(start + barMs(bpm.current) - LEAD_MS - 40, () => present(started.first))
      }
      // 처음 카드를 두두가 먼저 들려주면 '두두 따라 해 봐.'를 먼저 말하고 박을 센다.
      if (started.first.modelCue) { modelIntroduced.current = true; say(MODEL_LEAD, () => { if (!pausedRef.current) countIn() }, 'WAVE') }
      else countIn()
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
      // 말 시작 시각: 감지 시점에서 되살린 앞부분(preRoll)만큼 앞. 박 맞춤 연출에만 쓴다(판정·저장 아님).
      if (events.some(event => event.type === 'VOICE_START')) speechStartAt.current ??= performance.now() - onset.preRollMs - DETECT_LAG_MS
      if (events.some(event => event.type === 'VOICE_START') && windowTimer.current !== null) {
        // 말을 시작했으면 기다림 시간이 끝나도 말을 다 들을 때까지 기다린다(최대 4초).
        window.clearTimeout(windowTimer.current)
        windowTimer.current = window.setTimeout(() => { if (listening.current) closeWindow(null) }, MAX_SPEECH_MS)
      }
      if (acoustic) closeWindow(acoustic)
    })
  }

  /** 카드 하나를 낸다. 두두가 먼저 들려주면 lead(이끄는 말)를 하고 박을 시작한다. */
  function present(next: CrossingItem, lead?: string) {
    current.current = next
    // 쉬는 중이면 아무것도 내지 않는다(다시 시작할 때 이 카드부터).
    if (pausedRef.current) return
    setItem(next); setCardKey(key => key + 1); setCard('away'); setWindowOpen(false); setTurn(null); setBeat(0)
    setAction('IDLE'); setCaption('')
    if (next.level === 'word' && firstWord.current === null) firstWord.current = next.text
    if (!practiced.current.includes(next.text)) practiced.current.push(next.text)
    const line = lead ?? (next.modelCue && !modelIntroduced.current ? MODEL_LEAD : null)
    if (line) { if (line === MODEL_LEAD) modelIntroduced.current = true; say(line, () => scheduleBars(next)); return }
    scheduleBars(next)
  }

  /** 다음 마디부터 박을 놓는다. 빠르기가 바뀌었으면 이 마디부터 새 박자다. */
  function scheduleBars(next: CrossingItem) {
    if (pausedRef.current || !mounted.current) return
    const now = performance.now()
    const previous = grid.current ?? { anchor: now + LEAD_MS, bpm: bpm.current }
    let start = nextBarStart(previous.anchor, previous.bpm, now, LEAD_MS)
    grid.current = { anchor: start, bpm: bpm.current }
    if (next.modelCue) { duduBar(start, next); start += barMs(bpm.current) }
    childBar(start, next)
  }

  /** 두두 마디(부르기): 1·2·3박 '똑'과 함께 카드가 다가오고, 4박에 두두가 낱말을 부른다. */
  function duduBar(start: number, next: CrossingItem) {
    const b = bar(start, bpm.current)
    tick(b.beats.slice(0, 3))
    at(b.beats[0], () => { setTurn('dudu'); setCard('here'); setCaption('두두가 먼저 할게. 잘 들어 봐!') })
    b.beats.forEach((time, i) => beatAt(time, i + 1))
    const word = callWord(next.text)
    at(b.land - beatLeadMs(word) - CLIP_START_MS, () => {
      if (pausedRef.current) return
      void voice.current?.speak(word, { onStart: () => setAction('TALKING') }, { rate: 0.85 })
    })
    at(b.land, () => setCard('landed'))
  }

  /**
   * 아이 마디: 1·2·3박 '똑', 4박에 카드가 동그라미에 들어오면 아이가 말한다. '똑'이 다 들린 뒤 마이크를 연다.
   * 두두가 먼저 부른 뒤라 카드가 이미 동그라미에 있으면 제자리에서 다시 박을 센다.
   */
  function childBar(start: number, next: CrossingItem) {
    const b = bar(start, bpm.current, outputLatencyMs())
    tick(b.beats.slice(0, 3))
    at(b.beats[0], () => { setTurn('child'); setAction('IDLE'); setCard('here'); setCaption(`하나, 둘, 셋 다음에 '${next.text}'!`) })
    b.beats.forEach((time, i) => beatAt(time, i + 1))
    // 귀 쫑긋(듣기 자세)은 마이크가 열리기 전에 끝난다.
    at(b.beats[2] - PERK_LEAD_MS, () => setAction('LISTENING'))
    at(b.micOpen, () => openWindow(b, next))
    at(b.land, () => setCard('landed'))
  }

  function openWindow(b: Bar, next: CrossingItem) {
    if (pausedRef.current) return
    setWindowOpen(true); setCaption(`지금! '${next.text}'`)
    pipeline.current?.resetUtterance()
    landAt.current = b.land; speechStartAt.current = null
    listening.current = true
    windowTimer.current = window.setTimeout(() => { if (listening.current) closeWindow(null) }, Math.max(0, b.windowEnd - performance.now()))
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
    const provider = judge.current, target = current.current
    if (!provider || !target || busy.current) return
    busy.current = true
    if (acoustic) counts.current.attempts++
    else { setCard('gone'); setAction('THINKING'); playFx('whoosh'); say(MISS_LINE, undefined, 'THINKING') }
    try {
      const sent: Acoustic = acoustic ?? { durationMs: 0, voicedMs: 0, activeMs: 0, meanRmsDb: -60, peakRmsDb: -60, meanHfRatio: 0, onsetLatencyMs: 0, source: modeRef.current === 'demo' ? 'keyboard' : 'microphone' }
      const result = await provider.submit(target, { transcript: null, acoustic: sent })
      if (mounted.current) react(result, acoustic)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장 연결을 확인해 주세요')
    } finally { busy.current = false }
  }

  function react(result: CrossingTurn, acoustic: Acoustic | null) {
    const target = current.current!
    const missed = acoustic === null
    if (pausedRef.current) {
      // 서버 답을 기다리는 동안 쉬었다: 결과만 반영하고 연출·말은 하지 않는다. 다시 시작하면 다음 카드부터.
      if (result.result === 'success') { counts.current.successes++; setStripe(value => Math.min(STRIPES, value + 1)) }
      if (result.complete || !result.next) finishedWhilePaused.current = true
      else current.current = result.next
      return
    }
    history.current.push(missed ? 'miss' : result.result)
    // 빠르기: 한 번에 하나만 바꾸고, 바꾸면 기록을 비운다(다음 변경은 새 기록으로 판단).
    const changed = nextBpm(bpm.current, history.current, rhythm.current)
    if (changed !== bpm.current) { bpm.current = changed; setTempo(changed); history.current = [] }
    setTurn(null); setBeat(0)

    const proceed = () => {
      if (result.complete || !result.next) { arrive(); return }
      // 불확실 뒤 다시 들려줄 때는 '두두가 다시 들려줄게.'를 하고 두두 마디부터 박을 센다(실패로 말하지 않음).
      const again = !missed && (result.result === 'uncertain' || result.result === 'no_speech') && result.next.modelCue
      present(result.next, again ? LISTEN_AGAIN_LEAD : undefined)
    }
    const sameCard = !!result.next && result.next.itemId === target.itemId
    if (result.result === 'success') {
      setTip(null)
      counts.current.successes++
      setCard('cleared')
      const kind = timingKind(speechStartAt.current, landAt.current)
      const line = praiseLine(counts.current.successes - 1)
      setPop({ key: Date.now(), kind, label: kind === 'perfect' ? '딱 맞았어!' : '펑!' }); playFx(kind)
      later(() => setPop(null), PRAISE_SHOW_MS)
      // 두두는 다음 박에 맞춰 흰 줄 하나를 건넌다(박을 타며 건너기).
      const g = grid.current
      at(g ? nextBeat(g.anchor, g.bpm, performance.now() + 60) : performance.now(), () => { setStripe(value => Math.min(STRIPES, value + 1)); setAction('CHEER') })
      say(kind === 'perfect' ? `딱 맞았어! ${line}` : line, () => later(proceed, 250), 'CHEER', 'praise')
      return
    }
    if (missed) { setTip(sameCard ? MISS_TIP : null); later(proceed, 1800); return }
    // 결과는 서버 판정을 따르고, 단서 문구만 같은 음향 요약으로 고른다(기준이 다르면 기본 단서).
    const reason = acoustic.source === 'keyboard' ? null : onsetReason(acoustic)
    setTip(sameCard ? retryTip(reason, target.text) : null)
    if (result.result === 'retry') say(retryLine(reason, target.text), proceed, 'ENCOURAGE')
    else proceed()
  }

  /** 끝: 남은 줄은 두두가 박에 맞춰 이어서 건너 정문에 도착한다(실패 연출 없음). */
  function arrive() {
    setPhase('arrive'); setCard('hidden'); setWindowOpen(false); setTurn(null); setBeat(0); setTip(null)
    listening.current = false
    capture.current?.stop()
    const remaining = STRIPES - counts.current.successes
    const walk = (left: number) => {
      if (left <= 0) { finale(); return }
      setStripe(value => Math.min(STRIPES, value + 1)); later(() => walk(left - 1), still ? 50 : beatMs(bpm.current))
    }
    if (remaining > 0) say('남은 길은 두두랑 같이 가자!', () => walk(remaining))
    else finale()
  }
  function finale() {
    setStripe(ARRIVAL_STRIPE); setAction('CHEER')
    const name = heroName.current
    void judge.current?.finish(Math.floor((Date.now() - startedAt.current) / 1000)).catch(() => undefined)
    say(`도착! 정말 잘했어! 역시 ${name ? isName(name) : '최고야'}!`, () => later(() => navigate('/play/goodbye', {
      state: { attempts: counts.current.attempts, word: firstWord.current ?? '사과', heroName: name, words: practiced.current } }), 1200), 'CHEER', 'arrive')
  }

  function togglePause() {
    if (!pausedRef.current) {
      pausedRef.current = true; setPaused(true); clearTimers(); listening.current = false; setWindowOpen(false); voice.current?.cancel()
      setTurn(null); setBeat(0); setCountdown('')
      setCaption('잠깐 쉬어요. 준비되면 다시 시작을 눌러 줘.'); setAction('IDLE')
    } else {
      pausedRef.current = false; setPaused(false)
      if (finishedWhilePaused.current) arrive()
      else if (current.current) present(current.current)
    }
  }

  // DEMO: 누르고 있는 동안 말하는 것으로 본다(실제 발음 평가가 아님). 누른 때를 말 시작으로 박 맞춤을 본다.
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
  const beatLabel = turn === 'dudu' ? '두두' : '말해!'
  return <main className="crossing-screen dudu-sky"><div className="crossing-shell">
    <header className="crossing-top">
      {/* 도움말이 있으면 제목 자리에 보인다(무대·버튼이 밀리지 않게). 제목은 화면 읽기용으로 남긴다. */}
      {phase === 'play' && tip && <RetryTipCard key={`${tip.title}-${tip.body}`} tip={tip} />}
      <div className={phase === 'play' && tip ? 'crossing-top-main sr-only' : 'crossing-top-main'}><p className="eyebrow">대구대 건너기{mode === 'demo' ? ' · DEMO 연습' : ''}{preview ? ' · 미리보기(서버 판정 아님)' : ''}</p>
        <h1>{phase === 'play' ? (stripe < STRIPES ? `정문까지 ${STRIPES - stripe}칸!` : '거의 다 왔어!') : '두두랑 대구대까지!'}</h1>
        {phase === 'play' && <><span className="crossing-chip">{ROUND_TITLES[roundIndex - 1]}</span>
          <span className="crossing-chip tempo"><span aria-hidden="true">♩ {tempo}</span><span className="sr-only">빠르기 1분에 {tempo}박</span></span></>}</div>
      {/* 쉬기: 게임처럼 동그란 아이콘 버튼(이름은 화면 읽기용으로 그대로). 제목·도움말과 한 줄에 둔다. */}
      {phase === 'play' && <button className="secondary-action crossing-pause" onClick={togglePause} aria-label={paused ? '다시 시작' : '잠깐 쉬기'} title={paused ? '다시 시작' : '잠깐 쉬기'}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paused ? <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /> : <><rect x="6.5" y="5.5" width="4" height="13" rx="1.6" fill="currentColor" /><rect x="13.5" y="5.5" width="4" height="13" rx="1.6" fill="currentColor" /></>}</svg>
      </button>}
    </header>

    {phase === 'intro' && <section className="crossing-intro">
      {/* 시작 전 박자 미리보기: '똑·똑·똑' 다음 넷째 박에 말한다(84BPM으로 차례로 켜짐, 움직임 줄이기면 멈춤). */}
      <div className="crossing-intro-art" aria-hidden="true">
        <span>🚦 박자 타고 대구대까지 10칸</span>
        <div className="crossing-intro-beats">{['똑', '똑', '똑', '사!'].map((text, n) => <i key={n} className={n === 3 ? 'say' : ''} style={{ ['--n' as string]: n }}>{text}</i>)}</div>
      </div>
      <h2>두두랑 박자에 맞춰 횡단보도를 건너요</h2>
      <ol>
        <li><b>1</b>두두가 '똑·똑·똑' 박자를 세면, 넷째 박에 카드가 두두 머리 위 동그라미에 쏙 들어와요.</li>
        <li><b>2</b>그때 카드 글자를 말해요. 박에 딱 맞으면 '딱 맞았어!', 조금 늦어도 잘 말하면 '펑!' 하고 한 줄 건너요.</li>
        <li><b>3</b>처음에는 두두가 먼저 불러 줄게. 천천히 시작하고, 잘하면 조금씩 빨라져요.</li>
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
        <CrossingScene stripe={stripe} action={action} animate={!windowOpen && !still && !paused} bob={phase === 'play'} arrived={phase === 'arrive'} beat={grid} />
        {phase === 'play' && <div className="crossing-lane" aria-hidden="true">
          <div key={`ring-${beatSerial}`} className={`crossing-ring${windowOpen ? ' open' : ''}${turn === 'dudu' && beat === 4 ? ' dudu' : ''}${beat >= 1 && beat <= 3 && !windowOpen ? ' tick' : ''}`} />
          {/* 낱말 라운드는 그림 보고 말하기다: 그림이 있는 낱말은 카드에 그림을 함께 보여 준다. */}
          {item && card !== 'hidden' && <div key={cardKey} className={`crossing-card ${item.level === 'word' ? 'word' : ''}${item.level === 'word' && hasPicture(item.text) ? ' pictured' : ''} ${card}`}
            style={{ ['--approach' as string]: `${Math.round(3 * beatMs(tempo))}ms` }}>{item.level === 'word' && <WordPicture word={item.text} size={46} />}<span>{item.text}</span></div>}
        </div>}
        {/* 박 표시(무대 아래): 1~3박은 '똑', 4박은 말할 박(두두 마디에서는 두두가 부르는 박). */}
        {phase === 'play' && <div className={`crossing-beats${turn ? ` ${turn}` : ''}`} aria-hidden="true">
          {[1, 2, 3, 4].map(n => <i key={n} className={`${beat === n ? 'on' : ''}${beat > n ? ' done' : ''}${n === 4 ? ' say' : ''}`}>{n === 4 ? beatLabel : COUNT_IN[n - 1]}</i>)}
        </div>}
        {pop && <PopBurst key={pop.key} kind={pop.kind} label={pop.label} still={still} />}
        {countdown && <div key={countdown} className="crossing-countdown" role="status">{countdown}</div>}
        <TurnCue on={phase === 'play' && windowOpen} />
      </div>
      <p key={captionKey} className={`crossing-caption${caption ? '' : ' empty'}${captionStyle === 'normal' ? '' : ` ${captionStyle}`}`} aria-live="polite">
        {captionStyle === 'normal' || still ? caption || ' ' : <>
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
