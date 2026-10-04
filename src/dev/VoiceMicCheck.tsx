import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Acoustic } from '../shared/types'
import { AudioCapture } from '../speech/audioCapture'
import { availableVoices, DUDU_PITCH, pickDuduVoice, readDuduVoiceSetting, saveDuduVoiceSetting } from '../speech/duduVoice'
import { MicUtterancePipeline } from '../speech/micUtterance'

/*
 * 개발 서버 전용 점검 화면(/voice-mic-check.html). 배포 빌드에 들어가지 않는다.
 * 1) 두두 목소리 고르기 2) /ㅅ/ 음절('사')과 '다'가 음향 근사로 어떻게 보이는지 3) 깜빡이는 박자에 맞춰 말할 때의 시간 차.
 * 결과는 판정 기준을 정하기 위한 측정이며 발음 평가가 아니다. 음성은 저장하지 않고 숫자 요약만 화면에 남는다.
 */
const LINES = ['안녕~ 만나서 반가워! 나는 두두야.', '정말 잘했어!', "우리 게임 해 볼까? 아래 '대구대 건너기'를 눌러 볼래?", '오늘 나랑 얘기해 줘서 고마워. 다음에 또 만나!']
const TAGS = ['사', '다', '스~', '기타'] as const
// 음향 근사: 소리 시작에 마찰 구간이 있으면 '사·스' 쪽으로 본다. 기준값은 이 측정으로 정한다.
const ONSET_FRICATION_MIN_MS = 60

type Row = { id: number; at: string; tag: string; acoustic: Acoustic }
type BeatResult = { beats: number; hits: number; offsetsMs: number[] }

function VoicePanel() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => availableVoices())
  const saved = readDuduVoiceSetting()
  const [name, setName] = useState<string | null>(saved.name)
  const [pitch, setPitch] = useState(saved.pitch)
  const [rate, setRate] = useState(0.9)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const update = () => setVoices(availableVoices())
    speechSynthesis.addEventListener('voiceschanged', update)
    const timer = window.setTimeout(update, 800)
    return () => { speechSynthesis.removeEventListener('voiceschanged', update); window.clearTimeout(timer) }
  }, [])
  const korean = voices.filter(voice => /^ko/i.test(voice.lang))
  const chosen = pickDuduVoice(korean, name)
  const recommended = pickDuduVoice(korean, null)
  function play(text: string) {
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'; utterance.rate = rate; utterance.pitch = pitch
    if (chosen) utterance.voice = chosen
    speechSynthesis.speak(utterance)
  }
  return <section style={card}>
    <h2>1. 두두 목소리</h2>
    <p style={muted}>브라우저가 주는 무료 음성만 씁니다. Edge(인터넷 연결)에는 한국어 남성 음성 InJoon·Hyunsu가 있습니다. 고른 값은 이 기기에만 저장됩니다.</p>
    {!korean.length && <p style={warn}>한국어 음성이 아직 없습니다. 잠시 뒤 새로고침하거나 Edge로 열어 주세요.</p>}
    {korean.length > 0 && !/injoon|hyunsu|bongjin|gookmin/i.test(korean.map(v => v.name).join(' ')) && <p style={warn}>이 브라우저에는 한국어 남성 음성이 없습니다. Edge에서 열어 보세요.</p>}
    <div style={{ display: 'grid', gap: 4 }}>
      {korean.map(voice => <label key={voice.name}><input type="radio" name="voice" checked={chosen?.name === voice.name} onChange={() => setName(voice.name)} /> {voice.name}{voice.name === recommended?.name ? ' · 추천' : ''}{voice.localService ? '' : ' · 온라인'}</label>)}
    </div>
    <p>높이 {pitch.toFixed(2)} <input type="range" min={0.8} max={1.6} step={0.05} value={pitch} onChange={event => setPitch(Number(event.target.value))} /> 빠르기 {rate.toFixed(2)} <input type="range" min={0.7} max={1.1} step={0.05} value={rate} onChange={event => setRate(Number(event.target.value))} /> <button onClick={() => { setPitch(DUDU_PITCH); setRate(0.9) }}>기본값</button></p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{LINES.map(line => <button key={line} onClick={() => play(line)}>▶ {line}</button>)}</div>
    <p><button style={primary} disabled={!chosen} onClick={() => { saveDuduVoiceSetting({ name: chosen?.name ?? null, pitch }); setMessage(`저장했습니다: ${chosen?.name} · 높이 ${pitch.toFixed(2)}`) }}>이 목소리로 두두 정하기</button> <span>{message}</span></p>
  </section>
}

function MicPanel() {
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('꺼짐')
  const [level, setLevel] = useState(-90)
  const [noise, setNoise] = useState<number | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [tag, setTag] = useState<string>('사')
  const [beat, setBeat] = useState<BeatResult | null>(null)
  const [flash, setFlash] = useState(false)
  const capture = useRef<AudioCapture | null>(null)
  const zero = useRef(0)
  const onsets = useRef<number[]>([])
  const tagRef = useRef(tag)
  tagRef.current = tag

  async function start() {
    const pipeline = new MicUtterancePipeline('fricative')
    const mic = new AudioCapture()
    capture.current = mic
    setStatus('조용히 1초 기다려 주세요(잡음 기준 측정)…')
    try {
      let shownAt = 0, noiseShown = false
      await mic.start(frame => {
        if (frame.tMs - shownAt > 100) { shownAt = frame.tMs; setLevel(frame.rmsDb) }
        const { events, acoustic } = pipeline.process(frame)
        if (pipeline.calibrated && !noiseShown) { noiseShown = true; setNoise(pipeline.vad.noiseFloor) }
        for (const event of events) if (event.type === 'VOICE_START') onsets.current.push(zero.current + event.tMs)
        if (acoustic) setRows(previous => [...previous, { id: previous.length + 1, at: new Date().toLocaleTimeString(), tag: tagRef.current, acoustic }])
      })
      zero.current = performance.now()
      setRunning(true); setStatus('듣는 중. 한 번에 하나씩 말하고 1초 쉬어 주세요.')
    } catch (error) {
      setStatus(`마이크를 열 수 없습니다: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  function stop() { capture.current?.stop(); capture.current = null; setRunning(false); setStatus('꺼짐') }
  useEffect(() => () => capture.current?.stop(), [])

  // 화면이 깜빡이는 박자(1.5초 간격 6번)에 맞춰 '사'라고 말한다. 소리 대신 빛으로 박을 주어 스피커 소리가 마이크에 들어가지 않게 한다.
  async function beatTest() {
    onsets.current = []
    const beats: number[] = []
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => window.setTimeout(resolve, i === 0 ? 1500 : 1500))
      beats.push(performance.now()); setFlash(true)
      window.setTimeout(() => setFlash(false), 200)
    }
    await new Promise(resolve => window.setTimeout(resolve, 1200))
    const offsetsMs: number[] = []
    for (const at of beats) {
      const nearest = onsets.current.filter(onset => onset > at - 600 && onset < at + 1200).sort((a, b) => Math.abs(a - at) - Math.abs(b - at))[0]
      if (nearest !== undefined) offsetsMs.push(Math.round(nearest - at))
    }
    setBeat({ beats: beats.length, hits: offsetsMs.length, offsetsMs })
  }

  const results = { userAgent: navigator.userAgent, secure: window.isSecureContext, noiseFloorDb: noise, rows: rows.map(row => ({ tag: row.tag, ...pick(row.acoustic) })), beat }
  return <section style={card}>
    <h2>2. 마이크 · '사'와 '다'</h2>
    <p style={muted}>아래에서 말할 소리를 고르고 그 소리를 한 번 말한 뒤 1초 쉬어 주세요. '사' 5번, '다' 5번, '스~' 3번이면 충분합니다. 이어폰을 쓰거나 스피커 소리를 줄여 주세요.</p>
    <p>{running ? <button onClick={stop}>마이크 끄기</button> : <button style={primary} onClick={() => void start()}>마이크 켜기</button>} <span>{status}</span></p>
    <div style={{ height: 14, background: '#e5ebe7', borderRadius: 7, overflow: 'hidden', maxWidth: 420 }}><div style={{ width: `${Math.max(0, Math.min(100, (level + 80) * 1.4))}%`, height: '100%', background: '#1f6b57' }} /></div>
    <p style={muted}>소리 크기 {level.toFixed(0)} dB · 잡음 기준 {noise === null ? '측정 중' : `${noise.toFixed(0)} dB`}</p>
    <p>지금 말할 소리: {TAGS.map(value => <label key={value} style={{ marginRight: 10 }}><input type="radio" checked={tag === value} onChange={() => setTag(value)} /> {value}</label>)}</p>
    <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
      <thead><tr>{['#', '말한 소리', '길이', '시작 마찰', '마찰 뒤 유성', '전체 마찰', '소리-잡음', '근사 판정'].map(head => <th key={head} style={cell}>{head}</th>)}</tr></thead>
      <tbody>{rows.map(row => {
        const a = row.acoustic
        const fric = a.onsetFricationMs ?? 0
        return <tr key={row.id}><td style={cell}>{row.id}</td><td style={cell}>{row.tag}</td><td style={cell}>{ms(a.durationMs)}</td><td style={cell}>{ms(fric)}</td><td style={cell}>{ms(a.voicedAfterFricationMs)}</td><td style={cell}>{ms(a.fricationMs)}</td><td style={cell}>{a.noiseFloorDb === undefined ? '-' : `${(a.meanRmsDb - a.noiseFloorDb).toFixed(0)}dB`}</td><td style={cell}>{fric >= ONSET_FRICATION_MIN_MS ? '마찰 시작 있음(사·스 쪽)' : '마찰 없음(다 쪽)'}</td></tr>
      })}</tbody>
    </table>
    <h2 style={{ marginTop: 20 }}>3. 박자에 맞춰 말하기</h2>
    <p style={muted}>마이크를 켠 채로 시작을 누르면 원이 1.5초마다 6번 빛납니다. 빛날 때마다 '사'라고 말해 주세요.</p>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div aria-hidden="true" style={{ width: 90, height: 90, borderRadius: '50%', background: flash ? '#f4b400' : '#dfe6e2', transition: 'background 60ms' }} />
      <button disabled={!running} onClick={() => void beatTest()}>박자 테스트 시작</button>
      {beat && <span>잡힌 박 {beat.hits}/{beat.beats} · 시간 차 {beat.offsetsMs.join(', ')} ms{beat.offsetsMs.length ? ` · 평균 ${Math.round(beat.offsetsMs.reduce((s, v) => s + v, 0) / beat.offsetsMs.length)} ms` : ''}</span>}
    </div>
    <h2 style={{ marginTop: 20 }}>4. 결과 보내기</h2>
    <p><button style={primary} onClick={() => void navigator.clipboard.writeText(JSON.stringify(results, null, 1))}>결과 복사</button> <span style={muted}>복사한 내용을 Claude에게 붙여 넣어 주세요. 음성은 들어 있지 않고 숫자만 있습니다.</span></p>
  </section>
}

const ms = (value?: number) => `${Math.round(value ?? 0)}ms`

function pick(a: Acoustic) {
  return { durationMs: a.durationMs, onsetFricationMs: a.onsetFricationMs, voicedAfterFricationMs: a.voicedAfterFricationMs, fricationMs: a.fricationMs,
    bestRunMs: a.bestRunMs, meanHfRatio: a.meanHfRatio, meanCentroidHz: a.meanCentroidHz, meanRmsDb: a.meanRmsDb, noiseFloorDb: a.noiseFloorDb, clippingRatio: a.clippingRatio }
}

const card = { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 } as const
const muted = { color: '#5c706a', fontSize: 13 } as const
const warn = { color: '#8a4b00', fontSize: 13 } as const
const cell = { border: '1px solid #dfe6e2', padding: '4px 8px' } as const
const primary = { background: '#1f6b57', color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 700 } as const

function Page() {
  return <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16, background: '#f5f6f1', minHeight: '100vh', maxWidth: 980, margin: '0 auto' }}>
    <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>두두 목소리 · 마이크 점검</h1>
    <p style={muted}>데모 1일차 측정용(개발 서버 전용). 판정은 근사이며 발음 평가가 아닙니다. 음성은 저장하지 않습니다.</p>
    <VoicePanel />
    <MicPanel />
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Page /></StrictMode>)
