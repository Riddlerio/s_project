import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeHoyaChat, sendHoyaTurn, startHoyaChat, type HoyaChatSession } from '../api/hoyaChat'
import type { HoyaAction } from '../control/speechGameSignal'
import { Hoya3D } from '../tiger/Hoya3D'
import { AudioCapture } from '../speech/audioCapture'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'
import { CALIBRATION_MS, MicUtterancePipeline } from '../speech/micUtterance'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'
import { HoyaChatController, type HoyaChatState, type Speak } from './hoyaChatController'

const STATUS: Record<HoyaChatState, string> = {
  IDLE: '', LISTENING: '호야가 듣고 있어요', PROCESSING: '호야가 생각하고 있어요', FILLER_SPEAKING: '호야가 생각하고 있어요',
  RESPONSE_SPEAKING: '호야가 말하고 있어요', ENDED: '대화가 끝났어요',
}

/** 브라우저 TTS 한 번. 다른 음성과 겹치지 않게 이전 재생을 비우고, onend가 오지 않는 브라우저를 위해 안전 timer를 둔다. */
const speakKorean: Speak = (text, events) => {
  let finished = false
  let safety: number | undefined
  const finish = () => { if (finished) return; finished = true; window.clearTimeout(safety); events.onEnd() }
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  safety = window.setTimeout(finish, Math.min(15000, 1500 + text.length * 250))
  if (!synth) { window.setTimeout(() => { events.onStart(); finish() }, 0); return { cancel: () => { finished = true; window.clearTimeout(safety) } } }
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ko-KR'; utterance.rate = 0.9
  utterance.onstart = () => { if (!finished) events.onStart() }
  utterance.onend = finish
  utterance.onerror = finish
  synth.speak(utterance)
  return { cancel: () => { finished = true; window.clearTimeout(safety); synth.cancel() } }
}

export default function HoyaChat() {
  const navigate = useNavigate()
  const [capabilities] = useState(() => detectCapabilities())
  const realSupported = supportsRealMode('conversation_quest', capabilities)
  const [session, setSession] = useState<HoyaChatSession | null>(null)
  const [chatState, setChatState] = useState<HoyaChatState>('IDLE')
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [hoyaText, setHoyaText] = useState('호야랑 이야기할래?')
  const [preparing, setPreparing] = useState(false)
  const [micText, setMicText] = useState('')
  const [demoText, setDemoText] = useState('')
  const [error, setError] = useState('')
  const controller = useRef<HoyaChatController | null>(null)
  const capture = useRef<AudioCapture | null>(null)
  const startTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    controller.current?.dispose()
    capture.current?.stop()
    window.clearTimeout(startTimer.current)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  function listenWithMicrophone(chat: HoyaChatController) {
    const pipeline = new MicUtterancePipeline('any_sound')
    const recognizer = new WebSpeechRecognizer()
    let wasListening = false
    let capturing = false
    const audio = new AudioCapture()
    capture.current = audio
    return audio.start(frame => {
      // 호야가 말하거나 생각하는 동안의 소리(호야 자신의 TTS 포함)는 아동 발화로 처리하지 않는다.
      // 시작 전 보정(첫 1초)만 호야가 말하기 전에 처리한다.
      if (!chat.listening || capturing) {
        if (!pipeline.calibrated) pipeline.process(frame)
        wasListening = false
        return
      }
      // 다시 듣기 시작할 때 호야 말소리로 시작된 발화 조각을 버린다.
      if (!wasListening) { pipeline.resetUtterance(); wasListening = true }
      const { events, acoustic } = pipeline.process(frame)
      for (const event of events) {
        if (event.type === 'VOICE_START') {
          setMicText('호야가 네 말을 듣고 있어요')
          try { recognizer.start() } catch { /* 음성 인식이 없으면 소리 정보만 보낸다 */ }
        }
        if (event.type === 'VOICE_END' && acoustic) {
          capturing = true
          void recognizer.stop().catch(() => ({ transcript: null, alternatives: [] as string[] })).then(result => {
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
    if (preparing || session) return
    setPreparing(true); setError('')
    try {
      const started = await startHoyaChat(mode)
      const chat = new HoyaChatController({
        speak: speakKorean,
        requestReply: (turnIndex, utterance) => sendHoyaTurn(started.sessionId, turnIndex, utterance),
        onState: setChatState, onAction: setAction, onText: setHoyaText,
        onComplete: () => { void completeHoyaChat(started.sessionId).catch(() => undefined); capture.current?.stop() },
      })
      controller.current = chat
      setSession(started)
      if (mode === 'real') {
        setMicText('호야가 귀를 준비하고 있어요')
        await listenWithMicrophone(chat)
        // 처음 1초는 주변 소리 기준을 잡는다. 그 뒤에 호야가 인사한다.
        startTimer.current = window.setTimeout(() => { setMicText('마이크가 켜져 있어요'); chat.start(started.openingText) }, CALIBRATION_MS + 100)
      } else chat.start(started.openingText)
    } catch (cause) {
      capture.current?.stop()
      setError(cause instanceof Error ? cause.message : '지금은 호야와 대화할 수 없어요')
    } finally { setPreparing(false) }
  }

  function sendDemo() {
    const chat = controller.current
    if (!chat?.listening) return
    const text = demoText.trim().slice(0, 80)
    if (chat.submit({ transcript: text || null, alternatives: text ? [text] : [], acoustic: {}, recognizer: 'demo_script' })) setDemoText('')
  }

  function finish() {
    controller.current?.end()
    capture.current?.stop()
    if (session) void completeHoyaChat(session.sessionId).catch(() => undefined)
    setMicText('')
  }

  const listening = chatState === 'LISTENING'
  return <main className="child-screen game-screen">
    <h1>호야와 대화하기</h1>
    <div style={{ height: '48vh', minHeight: 300, width: '100%' }}><Hoya3D action={action} /></div>
    <p className="speech-bubble" aria-live="polite">{hoyaText}</p>
    <p aria-live="polite">{STATUS[chatState]}</p>
    {!session && <div>
      <button disabled={preparing || !realSupported} onClick={() => { void begin('real') }}>대화 시작 (마이크)</button>
      <button disabled={preparing} onClick={() => { void begin('demo') }}>DEMO로 대화 시작</button>
      {!realSupported && <p className="small">{missingText('conversation_quest', capabilities)}</p>}
    </div>}
    {session?.mode === 'real' && chatState !== 'ENDED' && <p className="small">{listening ? micText || '마이크가 켜져 있어요' : '호야가 말할 때는 마이크가 잠시 쉬어요'}</p>}
    {session?.mode === 'demo' && chatState !== 'ENDED' && <div>
      <label>호야에게 할 말<input value={demoText} maxLength={80} onChange={event => setDemoText(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') sendDemo() }} /></label>
      <button disabled={!listening} onClick={sendDemo}>호야에게 말하기</button>
      <p className="small">DEMO 대화입니다. 글자로 입력한 말이며 실제 음성 자료가 아닙니다.</p>
    </div>}
    {session && chatState !== 'ENDED' && <button onClick={finish}>대화 끝내기</button>}
    {chatState === 'ENDED' && <button onClick={() => navigate('/play/home')}>호야의 집으로</button>}
    {!session && <button className="quiet" onClick={() => navigate('/play/home')}>돌아가기</button>}
    {error && <p role="alert">{error}</p>}
  </main>
}
