import { browserClipPlayer, type ClipPlayer } from './duduClips'
import { availableVoices, pickDuduVoice, readDuduVoiceSetting, type DuduVoiceSetting } from './duduVoice'

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
  /** 두두 목소리(음성 이름·높이). 기본은 이 기기에 저장한 값 또는 선호 남성 음성이다. */
  voice?(): { voice: SpeechSynthesisVoice | null; pitch: number }
  /** 미리 만든 두두 음성 파일. 기본은 실제 브라우저에서만 켠다(테스트의 가짜 음성 엔진에서는 끔). */
  clips?: ClipPlayer | null
}

function defaultDuduVoice(setting: DuduVoiceSetting = readDuduVoiceSetting()) {
  return { voice: pickDuduVoice(availableVoices(), setting.name), pitch: setting.pitch }
}
interface Playback {
  ending?: boolean
  utterance?: SpeechSynthesisUtterance
  clip?: { stop(): void }
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
  private readonly clips: ClipPlayer | null

  constructor(private readonly options: KoreanTtsOptions = {}) {
    this.synthesis = options.synthesis === undefined
      ? (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)
      : options.synthesis
    this.clips = options.clips === undefined ? (options.synthesis === undefined ? browserClipPlayer() : null) : options.clips
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
    // 문장이 모두 두두 음성 파일로 있으면 파일을 재생한다. 못 틀면 같은 말을 브라우저 음성으로 한다.
    const urls = this.clips?.plan(text) ?? null
    if (urls && this.clips) {
      playback.safety = setTimeout(() => this.finish(playback, 'timeout', true), this.options.timeoutMs ?? Math.min(20000, 2000 + text.length * 300))
      playback.clip = this.clips.play(urls, {
        onStart: () => { if (live()) events.onStart?.() },
        onEnd: () => this.finish(playback, 'ended'),
        onError: () => {
          if (!live()) return
          clearTimeout(playback.safety); playback.clip = undefined
          this.speakSynthesis(playback, text, options, live)
        },
      })
    } else this.speakSynthesis(playback, text, options, live)
    return { finished, cancel: () => { if (!this.disposed && this.active === playback) this.finish(playback, 'cancelled', true) } }
  }

  private speakSynthesis(playback: Playback, text: string, options: { rate?: number }, live: () => boolean): void {
    const events = playback.events
    if (!this.synthesis) {
      this.finish(playback, 'unavailable')
    } else {
      try {
        this.synthesis.cancel()
        const utterance = (this.options.createUtterance ?? (value => new SpeechSynthesisUtterance(value)))(text)
        playback.utterance = utterance
        utterance.lang = 'ko-KR'; utterance.rate = options.rate ?? 0.9
        // 실제 브라우저 음성일 때만 두두 목소리를 고른다(테스트의 가짜 음성 엔진은 그대로).
        if (this.options.voice || this.options.synthesis === undefined) {
          const dudu = (this.options.voice ?? defaultDuduVoice)()
          if (dudu.voice) utterance.voice = dudu.voice
          utterance.pitch = dudu.pitch
        }
        utterance.onstart = () => { if (live()) events.onStart?.() }
        utterance.onend = () => this.finish(playback, 'ended')
        utterance.onerror = () => this.finish(playback, 'error', true)
        playback.safety = setTimeout(() => this.finish(playback, 'timeout', true),
          this.options.timeoutMs ?? Math.min(15000, 1500 + text.length * 250))
        this.synthesis.speak(utterance)
      } catch { this.finish(playback, 'error', true) }
    }
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
    playback.clip?.stop(); playback.clip = undefined
    if (!playback.utterance) return
    playback.utterance.onstart = null; playback.utterance.onend = null; playback.utterance.onerror = null
  }

  private setBlocked(blocked: boolean): void {
    if (this.isBlocked === blocked) return
    this.isBlocked = blocked
    this.options.onBlockedChange?.(blocked)
  }
}
