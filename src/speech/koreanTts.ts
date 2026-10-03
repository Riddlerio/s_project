/** 두두 음성이 끝난 뒤 스피커의 잔향이 입력에 섞이지 않도록 기다리는 초기값. */
export const KOREAN_TTS_RELEASE_DELAY_MS = 300

export type KoreanSpeechResult = 'ended' | 'error' | 'timeout' | 'cancelled' | 'unavailable'
export interface KoreanSpeechHandle { cancel(): void; finished: Promise<KoreanSpeechResult> }
export interface KoreanSpeechEvents { onStart?(): void; onEnd?(): void }
interface KoreanTtsOptions {
  onBlockedChange?(blocked: boolean): void
  /** 테스트에서도 브라우저의 종료·오류·취소 순서를 그대로 재현한다. */
  synthesis?: Pick<SpeechSynthesis, 'speak' | 'cancel'> | null
  createUtterance?(text: string): SpeechSynthesisUtterance
  timeoutMs?: number
}
interface Playback {
  ending?: boolean
  utterance?: SpeechSynthesisUtterance
  safety?: ReturnType<typeof setTimeout>
  release?: ReturnType<typeof setTimeout>
  resolve(result: KoreanSpeechResult): void
  events: KoreanSpeechEvents
}

/** 요청 즉시 입력을 닫고 실제 종료/취소와 유예가 끝난 뒤에만 다시 연다. */
export class KoreanTts {
  private active?: Playback
  private disposed = false
  private isBlocked = false
  private readonly synthesis: KoreanTtsOptions['synthesis']

  constructor(private readonly options: KoreanTtsOptions = {}) {
    this.synthesis = options.synthesis === undefined
      ? (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)
      : options.synthesis
  }

  get blocked(): boolean { return this.isBlocked }

  speak(text: string, events: KoreanSpeechEvents = {}, options: { rate?: number } = {}): KoreanSpeechHandle {
    if (this.disposed) return { cancel() {}, finished: Promise.resolve('cancelled') }
    this.stopActive()
    this.setBlocked(true)
    let resolve!: (result: KoreanSpeechResult) => void
    const finished = new Promise<KoreanSpeechResult>(done => { resolve = done })
    const playback: Playback = { resolve, events }
    this.active = playback
    const live = () => !this.disposed && this.active === playback && !playback.ending
    if (!this.synthesis) {
      this.finish(playback, 'unavailable')
    } else {
      try {
        this.synthesis.cancel()
        const utterance = (this.options.createUtterance ?? (value => new SpeechSynthesisUtterance(value)))(text)
        playback.utterance = utterance
        utterance.lang = 'ko-KR'; utterance.rate = options.rate ?? 0.9
        utterance.onstart = () => { if (live()) events.onStart?.() }
        utterance.onend = () => this.finish(playback, 'ended')
        utterance.onerror = () => this.finish(playback, 'error', true)
        playback.safety = setTimeout(() => this.finish(playback, 'timeout', true),
          this.options.timeoutMs ?? Math.min(15000, 1500 + text.length * 250))
        this.synthesis.speak(utterance)
      } catch { this.finish(playback, 'error', true) }
    }
    return { finished, cancel: () => { if (!this.disposed && this.active === playback) this.finish(playback, 'cancelled', true) } }
  }

  cancel(): void { if (this.active) this.finish(this.active, 'cancelled', true) }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopActive()
    this.setBlocked(false)
  }

  private finish(playback: Playback, result: KoreanSpeechResult, cancelAudio = false): void {
    if (this.disposed || this.active !== playback) return
    // 종료 유예 중 취소해도 이전 onEnd가 다음 차례를 열지 못하게 한다.
    if (playback.release !== undefined) {
      if (result !== 'cancelled') return
      clearTimeout(playback.release)
    }
    clearTimeout(playback.safety)
    playback.ending = true
    this.detach(playback)
    if (cancelAudio) this.synthesis?.cancel()
    playback.release = setTimeout(() => {
      if (this.disposed || this.active !== playback) return
      this.active = undefined
      this.setBlocked(false)
      playback.resolve(result)
      if (result !== 'cancelled') playback.events.onEnd?.()
    }, KOREAN_TTS_RELEASE_DELAY_MS)
  }

  private stopActive(): void {
    const previous = this.active
    if (!previous) return
    this.active = undefined
    clearTimeout(previous.safety); clearTimeout(previous.release)
    this.detach(previous)
    this.synthesis?.cancel()
    previous.resolve('cancelled')
  }

  private detach(playback: Playback): void {
    if (!playback.utterance) return
    playback.utterance.onstart = null; playback.utterance.onend = null; playback.utterance.onerror = null
  }

  private setBlocked(blocked: boolean): void {
    if (this.isBlocked === blocked) return
    this.isBlocked = blocked
    this.options.onBlockedChange?.(blocked)
  }
}
