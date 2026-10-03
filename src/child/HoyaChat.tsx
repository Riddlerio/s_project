import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeHoyaChat, getHoyaChat, sendHoyaTurn, startHoyaChat, type HoyaChatSession } from '../api/hoyaChat'
import type { HoyaAction } from '../control/speechGameSignal'
import { Hoya3D } from '../tiger/Hoya3D'
import { AudioCapture } from '../speech/audioCapture'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'
import { MicUtterancePipeline } from '../speech/micUtterance'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'
import { HoyaChatController, type HoyaChatState } from './hoyaChatController'
import { KoreanTts } from '../speech/koreanTts'

const STATUS: Record<HoyaChatState, string> = {
  IDLE: '', LISTENING: '두두가 듣고 있어요', PROCESSING: '두두가 생각하고 있어요', FILLER_SPEAKING: '두두가 생각하고 있어요',
  RECOVERING: '두두가 생각하고 있어요', RESPONSE_SPEAKING: '두두가 말하고 있어요', ENDED: '대화가 끝났어요',
}

export default function HoyaChat() {
  const navigate = useNavigate()
  const [capabilities] = useState(() => detectCapabilities())
  const realSupported = supportsRealMode('conversation_quest', capabilities)
  const [session, setSession] = useState<HoyaChatSession | null>(null)
  const [chatState, setChatState] = useState<HoyaChatState>('IDLE')
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [hoyaText, setHoyaText] = useState('두두랑 이야기할래?')
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
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    const tts = new KoreanTts()
    voice.current = tts
    return () => {
      mounted.current = false
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
      })
      controller.current = chat
      setSession(started)
      if (mode === 'real') {
        setMicText('두두가 귀를 준비하고 있어요')
        // 실제 frame으로 1초 보정이 끝난 뒤 인사한다. 단순 시간 경과는 마이크 준비를 보장하지 않는다.
        await listenWithMicrophone(chat, () => {
          if (!mounted.current || voice.current !== tts) return
          setMicText('마이크가 켜져 있어요'); chat.start(started.openingText)
        })
      } else chat.start(started.openingText)
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

  const listening = chatState === 'LISTENING'
  return <main className="child-screen game-screen">
    <h1>두두와 대화하기</h1>
    <div style={{ height: '48vh', minHeight: 300, width: '100%' }}><Hoya3D action={action} /></div>
    <p className="speech-bubble" aria-live="polite">{hoyaText}</p>
    <p aria-live="polite">{STATUS[chatState]}</p>
    {!session && <div>
      <button disabled={preparing || !realSupported} onClick={() => { void begin('real') }}>대화 시작 (마이크)</button>
      <button disabled={preparing} onClick={() => { void begin('demo') }}>DEMO로 대화 시작</button>
      {!realSupported && <p className="small">{missingText('conversation_quest', capabilities)}</p>}
    </div>}
    {session?.mode === 'real' && chatState !== 'ENDED' && <p className="small">{listening ? micText || '마이크가 켜져 있어요' : '두두가 말할 때는 마이크가 잠시 쉬어요'}</p>}
    {session?.mode === 'demo' && chatState !== 'ENDED' && <div>
      <label>두두에게 할 말<input value={demoText} maxLength={80} onChange={event => setDemoText(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') sendDemo() }} /></label>
      <button disabled={!listening} onClick={sendDemo}>두두에게 말하기</button>
      <p className="small">DEMO 대화입니다. 글자로 입력한 말이며 실제 음성 자료가 아닙니다.</p>
    </div>}
    {session && chatState !== 'ENDED' && <button onClick={finish}>대화 끝내기</button>}
    {chatState === 'ENDED' && <button onClick={() => navigate('/play/home')}>두두의 집으로</button>}
    {!session && <button className="quiet" onClick={() => navigate('/play/home')}>돌아가기</button>}
    {error && <p role="alert">{error}</p>}
  </main>
}
