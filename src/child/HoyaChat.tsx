import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { completeHoyaChat, getHoyaChat, sendHoyaTurn, startHoyaChat, type HoyaChatSession } from '../api/hoyaChat'
import type { HoyaAction } from '../control/speechGameSignal'
import { Hoya3D } from '../tiger/Hoya3D'
import { AudioCapture } from '../speech/audioCapture'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'
import { MicUtterancePipeline } from '../speech/micUtterance'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'
import { HoyaChatController, type HoyaChatState } from './hoyaChatController'
import { KoreanTts } from '../speech/koreanTts'
import { unlockDuduAudio } from '../speech/duduClips'
import './duduDemo.css'
import { playTurnChime, unlockFx, VoiceCredit } from './demoFx'
import { TurnCue } from './turnCue'
import { picturedWords, WordPicture } from './WordPicture'
import { GameCard } from './GameCard'

/** 대화를 마치고 두두가 권하는 게임. 화면 아래 버튼으로 들어간다(2026-10-05 데모 흐름). */
export const CROSSING_PATH = '/play/crossing'
/** '대구대 건너기' 카드 그림(Meshy 이미지 생성, Nano Banana Pro, 2026-10-05. docs/ASSET_LICENSES.md). */
const CROSSING_CARD_ART = '/assets/art/crossing_card.webp'
// 인사할 때 먼저 점프하고 나서 말한다.
const GREETING_JUMP_MS = 1300

const STATUS: Record<HoyaChatState, string> = {
  IDLE: '', LISTENING: '두두가 듣고 있어요', PROCESSING: '두두가 생각하고 있어요', FILLER_SPEAKING: '두두가 생각하고 있어요',
  RECOVERING: '두두가 생각하고 있어요', RESPONSE_SPEAKING: '두두가 말하고 있어요', ENDED: '대화가 끝났어요',
}

export default function HoyaChat() {
  const navigate = useNavigate()
  const location = useLocation()
  const autostart = (location.state as { autostart?: boolean } | null)?.autostart === true
  const [suggested, setSuggested] = useState(false)
  const [capabilities] = useState(() => detectCapabilities())
  const realSupported = supportsRealMode('conversation_quest', capabilities)
  const [session, setSession] = useState<HoyaChatSession | null>(null)
  const [chatState, setChatState] = useState<HoyaChatState>('IDLE')
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [hoyaText, setHoyaText] = useState(autostart ? '' : '두두랑 이야기할래?')
  const [preparing, setPreparing] = useState(false)
  const [micText, setMicText] = useState('')
  const [demoText, setDemoText] = useState('')
  const [error, setError] = useState('')
  const controller = useRef<HoyaChatController | null>(null)
  const capture = useRef<AudioCapture | null>(null)
  const voice = useRef<KoreanTts | null>(null)
  const recognizerRef = useRef<WebSpeechRecognizer | null>(null)
  const recognizing = useRef(false)
  const microphoneToken = useRef(0)
  const cueTimer = useRef<number | undefined>(undefined)
  const mounted = useRef(false)
  const nextGameRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mounted.current = true
    const tts = new KoreanTts()
    voice.current = tts
    return () => {
      mounted.current = false
      window.clearTimeout(cueTimer.current)
      controller.current?.dispose()
      stopMicrophone()
      tts.dispose()
    }
  }, [])

  function stopMicrophone() {
    microphoneToken.current++
    capture.current?.stop()
    if (recognizing.current) void recognizerRef.current?.stop().catch(() => undefined)
    recognizing.current = false
    recognizerRef.current = null
  }

  function listenWithMicrophone(chat: HoyaChatController, onReady: () => void) {
    const pipeline = new MicUtterancePipeline('any_sound')
    const recognizer = new WebSpeechRecognizer()
    recognizerRef.current = recognizer
    const token = ++microphoneToken.current
    let wasListening = false
    let capturing = false
    const audio = new AudioCapture()
    capture.current = audio
    return audio.start(frame => {
      if (token !== microphoneToken.current) return
      // 호야가 말하거나 생각하는 동안의 소리(호야 자신의 TTS 포함)는 아동 발화로 처리하지 않는다.
      // 시작 전 보정(첫 1초)만 호야가 말하기 전에 처리한다.
      if (!chat.listening || capturing) {
        if (chat.state === 'IDLE' && !voice.current?.blocked && !pipeline.calibrated) {
          pipeline.process(frame)
          if (pipeline.calibrated) { pipeline.resetUtterance(); onReady() }
        }
        wasListening = false
        return
      }
      // 다시 듣기 시작할 때 호야 말소리로 시작된 발화 조각을 버린다.
      if (!wasListening) { pipeline.resetUtterance(); wasListening = true }
      const { events, acoustic } = pipeline.process(frame)
      for (const event of events) {
        if (event.type === 'VOICE_START') {
          setMicText('두두가 네 말을 듣고 있어요')
          try { recognizer.start(); recognizing.current = true } catch { /* 음성 인식이 없으면 소리 정보만 보낸다 */ }
        }
        if (event.type === 'VOICE_END' && acoustic) {
          capturing = true
          void recognizer.stop().catch(() => ({ transcript: null, alternatives: [] as string[] })).then(result => {
            if (token !== microphoneToken.current) return
            recognizing.current = false
            capturing = false
            chat.submit({ transcript: result.transcript?.slice(0, 80) ?? null, alternatives: result.alternatives.slice(0, 5).map(value => value.slice(0, 80)),
              acoustic, recognizer: 'web_speech' })
            setMicText('마이크가 켜져 있어요')
          })
        }
      }
    })
  }

  async function begin(mode: 'real' | 'demo') {
    unlockDuduAudio(); unlockFx()
    if (preparing || session) return
    const tts = voice.current
    if (!tts) return
    setPreparing(true); setError('')
    try {
      const started = await startHoyaChat(mode)
      if (!mounted.current || voice.current !== tts) return
      const chat = new HoyaChatController({
        speak: (text, events) => tts.speak(text, events),
        // 같은 발화는 같은 요청 ID로만 재시도한다. 서버가 이미 끝낸 turn이면 저장된 답을 받는다.
        requestReply: request => sendHoyaTurn(started.sessionId, request),
        resync: () => getHoyaChat(started.sessionId).then(value => ({ nextTurnIndex: value.nextTurnIndex, active: value.status === 'active' })),
        onState: setChatState, onAction: setAction, onText: setHoyaText,
        onComplete: () => { void completeHoyaChat(started.sessionId).catch(() => undefined); stopMicrophone() },
        onNextActivity: activity => { if (activity === 'daegu_crossing') setSuggested(true) },
        // '네 차례': 두두 귀 쫑긋 + 차임이 다 들린 뒤에 듣기를 연다(차임이 마이크에 들어가지 않게).
        beforeListen: open => {
          if (!mounted.current || voice.current !== tts) return
          setAction('LISTENING')
          cueTimer.current = window.setTimeout(open, playTurnChime())
        },
      })
      // 인사: 먼저 점프하고(웃는 얼굴) 이어서 입을 움직이며 말한다.
      const greet = () => {
        setAction('CHEER')
        window.setTimeout(() => { if (mounted.current && voice.current === tts) chat.start(started.openingText) }, GREETING_JUMP_MS)
      }
      controller.current = chat
      setSession(started)
      if (mode === 'real') {
        setMicText('두두가 귀를 준비하고 있어요')
        // 실제 frame으로 1초 보정이 끝난 뒤 인사한다. 단순 시간 경과는 마이크 준비를 보장하지 않는다.
        await listenWithMicrophone(chat, () => {
          if (!mounted.current || voice.current !== tts) return
          setMicText('마이크가 켜져 있어요'); greet()
        })
      } else greet()
    } catch (cause) {
      if (!mounted.current || voice.current !== tts) return
      controller.current?.dispose()
      voice.current?.cancel()
      stopMicrophone()
      setSession(null)
      setError(cause instanceof Error ? cause.message : '지금은 두두와 대화할 수 없어요')
    } finally { if (mounted.current && voice.current === tts) setPreparing(false) }
  }

  function sendDemo() {
    const chat = controller.current
    if (!chat?.listening) return
    const text = demoText.trim().slice(0, 80)
    if (chat.submit({ transcript: text || null, alternatives: text ? [text] : [], acoustic: {}, recognizer: 'demo_script' })) setDemoText('')
  }

  function finish() {
    controller.current?.end()
    stopMicrophone()
    if (session) void completeHoyaChat(session.sessionId).catch(() => undefined)
    setMicText('')
  }

  // 로그인 직후에는 바로 두두가 인사한다(로그인 버튼 누름이 브라우저의 소리·마이크 허용 조건이 된다).
  // 개발 모드(StrictMode)의 두 번 실행에서도 한 번만 시작하도록 다음 차례로 미루고 정리 때 취소한다.
  useEffect(() => {
    if (!autostart) return
    const timer = window.setTimeout(() => { void begin(realSupported ? 'real' : 'demo') }, 0)
    return () => window.clearTimeout(timer)
  }, [autostart])

  // 두두가 게임을 권하면 카드가 보이게 한 번 내린다(휴대폰처럼 화면이 좁아 카드가 아래에 있을 때).
  useEffect(() => {
    if (!suggested) return
    const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    nextGameRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
  }, [suggested])

  function goCrossing() {
    unlockDuduAudio(); unlockFx()
    finish()
    navigate(CROSSING_PATH, { state: { from: 'chat' } })
  }

  const listening = chatState === 'LISTENING'
  // 두두가 권했거나 대화를 끝냈으면 아래 '대구대 건너기'가 열린다.
  const gameOpen = suggested || chatState === 'ENDED'
  // 두두 말에 나온 목표 낱말은 그림으로도 보여 준다(어린 아이의 그림 단서, 선택 질문).
  const pictures = picturedWords(hoyaText)
  const statusKind = chatState === 'LISTENING' ? 'listening' : chatState === 'RESPONSE_SPEAKING' ? 'speaking' : STATUS[chatState] ? 'thinking' : ''
  return <main className="child-screen game-screen dudu-chat dudu-hub dudu-sky">
    <header className="dudu-hub-top">
      <h1 className="dudu-hub-title">두두와 대화하기<small>말하는 용기가 자라는 곳</small></h1>
      {session && chatState !== 'ENDED' && <button className="quiet dudu-hub-end" onClick={finish}>대화 끝내기</button>}
    </header>
    <div className="dudu-hub-main">
      {/* 두두를 세로로 크게 세운다(참고 디자인). 아이가 말할 차례면 '네 차례!'가 두두 무대에 뜬다. */}
      <section className="dudu-hub-dudu">
        <div className="dudu-chat-stage tall"><Hoya3D action={action} /><TurnCue on={listening} /></div>
      </section>
      <section className="dudu-hub-talk">
        <div className="speech-bubble dudu-bubble">
          <p aria-live="polite">{hoyaText || '\u00a0'}</p>
          {/* 두두 말에 나온 목표 낱말은 말풍선 안에 그림으로도 보여 준다(어린 아이의 그림 단서). */}
          {pictures.length > 0 && <div className="dudu-picture-cues" role="group" aria-label="그림 단서">
            {pictures.map(word => <figure key={word}><WordPicture word={word} size={60} /><figcaption>{word}</figcaption></figure>)}
          </div>}
        </div>
        <p className={`dudu-status ${statusKind}`} aria-live="polite">{STATUS[chatState]}</p>
        {!session && <div className="dudu-hub-start">
          <button className="dudu-hub-cta" disabled={preparing || !realSupported} onClick={() => { void begin('real') }}><span aria-hidden="true">▶</span> 대화 시작 (마이크)</button>
          <button className="secondary-action" disabled={preparing} onClick={() => { void begin('demo') }}>DEMO로 대화 시작</button>
          {!realSupported && <p className="small">{missingText('conversation_quest', capabilities)}</p>}
        </div>}
        {session?.mode === 'real' && chatState !== 'ENDED' && <p className="small dudu-hub-note">{listening ? micText || '마이크가 켜져 있어요' : '두두가 말할 때는 마이크가 잠시 쉬어요'}</p>}
        {session?.mode === 'demo' && chatState !== 'ENDED' && <div className="dudu-hub-demo">
          <label>두두에게 할 말<input value={demoText} maxLength={80} onChange={event => setDemoText(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') sendDemo() }} /></label>
          <button disabled={!listening} onClick={sendDemo}>두두에게 말하기</button>
          <p className="small">DEMO 대화입니다. 글자로 입력한 말이며 실제 음성 자료가 아닙니다.</p>
        </div>}
        {/* 시연 흐름(로그인 → 대화 → 건너기 → 마무리)으로 들어왔으면 집(지도·아이템)으로 나가지 않는다(사용자 결정: 데모에 아이템 없음). */}
        {chatState === 'ENDED' && !autostart && <button onClick={() => navigate('/play/home')}>두두의 집으로</button>}
        {!session && <button className="quiet" onClick={() => navigate(autostart ? '/play' : '/play/home')}>{autostart ? '처음으로' : '돌아가기'}</button>}
        {error && <p role="alert">{error}</p>}
        {session && <nav ref={nextGameRef} className={`dudu-next-game${gameOpen ? ' suggested' : ''}`} aria-label="두두가 권하는 게임">
          {gameOpen && <span className="dudu-next-hint" aria-hidden="true">여기를 눌러 봐!</span>}
          <GameCard title="대구대 건너기" badge="리듬게임" image={CROSSING_CARD_ART} open={gameOpen} onClick={goCrossing}
            subtitle="박자에 맞춰 말하며 횡단보도를 건너 대구대까지!" lockedText="두두랑 이야기를 조금 더 하면 열려요" />
          {!gameOpen && <button className="quiet dudu-skip" onClick={goCrossing}>선생님: 게임으로 넘기기</button>}
        </nav>}
      </section>
    </div>
    <VoiceCredit />
  </main>
}
