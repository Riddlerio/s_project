import type { PlayItem } from '../shared/events'
import type { RecognitionResult, SpeechRecognizer } from './recognizer'

interface NativeResult { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }
interface NativeSpeechRecognition { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; onresult: ((event: NativeResult) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void }
type SpeechWindow = Window & { SpeechRecognition?: new () => NativeSpeechRecognition; webkitSpeechRecognition?: new () => NativeSpeechRecognition }

export class WebSpeechRecognizer implements SpeechRecognizer {
  readonly id = 'web_speech'
  private instance?: NativeSpeechRecognition
  private pending?: Promise<RecognitionResult>
  isAvailable() { const scope = window as SpeechWindow; return !!(scope.SpeechRecognition || scope.webkitSpeechRecognition) }
  start(_expected: PlayItem) {
    const scope = window as SpeechWindow
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition
    if (!Constructor) throw new Error('실제 음성 인식을 지원하지 않는 브라우저입니다')
    const rec = new Constructor()
    rec.lang = 'ko-KR'; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 5
    this.instance = rec
    this.pending = new Promise((resolve, reject) => {
      rec.onresult = event => { const choices = Array.from(event.results[0] || []); resolve({ transcript: choices[0]?.transcript || null, alternatives: choices.map(c => c.transcript), confidence: choices[0]?.confidence || null, recognizer: this.id }) }
      rec.onerror = event => event.error === 'no-speech' ? resolve({ transcript: null, alternatives: [], confidence: null, recognizer: this.id }) : reject(new Error(`음성 인식 연결: ${event.error}`))
      rec.onend = () => resolve({ transcript: null, alternatives: [], confidence: null, recognizer: this.id })
    })
    rec.start()
  }
  async stop(): Promise<RecognitionResult> { this.instance?.stop(); return Promise.race([this.pending!, new Promise<RecognitionResult>(resolve => setTimeout(() => resolve({ transcript: null, alternatives: [], confidence: null, recognizer: this.id }), 3000))]) }
}
