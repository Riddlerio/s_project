import type { HoyaAction } from '../control/speechGameSignal'
import type { Acoustic } from '../shared/types'

/**
 * 호야와 대화하기의 turn 흐름. 화면(React)과 분리해 timer·TTS·응답 순서를 테스트할 수 있게 한다.
 * 내부 상태는 HoyaAction(캐릭터 표정)과 다른 값이다.
 *
 * LISTENING → (아동 발화) → PROCESSING(THINKING) → [늦으면 "음..." 1회: FILLER_SPEAKING] → RESPONSE_SPEAKING → LISTENING
 */
export type HoyaChatState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'FILLER_SPEAKING' | 'RESPONSE_SPEAKING' | 'ENDED'

/** 응답이 이 시간보다 늦을 때만 "음..."을 한 번 말한다. 사용성 테스트에서 조정한다. */
export const HOYA_THINKING_FILLER_DELAY_MS = 750
export const HOYA_FILLER_TEXT = '음...'
/** 서버에 닿지 못했을 때의 말. 오류 내용이나 발음 결과를 말하지 않는다. */
export const HOYA_OFFLINE_TEXT = '호야가 잠깐 딴생각을 했어. 다시 이야기해 줄래?'

export interface SpeakHandle { cancel(): void }
export type Speak = (text: string, events: { onStart(): void; onEnd(): void }) => SpeakHandle
export interface ChatUtterance { transcript: string | null; alternatives: string[]; acoustic: Partial<Acoustic>; recognizer: 'web_speech' | 'demo_script' }
export interface ChatReply { text: string; hoyaActions: string[]; nextTurnIndex?: number; sessionComplete: boolean }
export interface Timers { set(callback: () => void, ms: number): unknown; clear(id: unknown): void }

export interface ChatDeps {
  speak: Speak
  requestReply(turnIndex: number, utterance: ChatUtterance): Promise<ChatReply>
  onState(state: HoyaChatState): void
  onAction(action: HoyaAction): void
  onText(text: string): void
  onComplete?(): void
  fillerDelayMs?: number
  timers?: Timers
}

const defaultTimers: Timers = { set: (callback, ms) => setTimeout(callback, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) }

export class HoyaChatController {
  private current: HoyaChatState = 'IDLE'
  private nextTurn = 1
  /** 대기 중인 turn. 새 turn·종료 때 바뀌어 늦게 온 응답을 버린다. */
  private turnToken = 0
  /** 재생 중인 음성. 종료·새 재생 때 바뀌어 이전 TTS callback을 버린다. */
  private speechToken = 0
  private fillerTimer: unknown = undefined
  private fillerUsed = false
  private pending: { reply: ChatReply; advance: boolean } | null = null
  private speech?: SpeakHandle
  private silent = false
  private readonly timers: Timers

  constructor(private readonly deps: ChatDeps) { this.timers = deps.timers ?? defaultTimers }

  get state(): HoyaChatState { return this.current }
  get turnIndex(): number { return this.nextTurn }
  /** 호야가 말하거나 생각하는 동안에는 아동 발화를 받지 않는다(호야 자신의 TTS를 다시 듣지 않게). */
  get listening(): boolean { return this.current === 'LISTENING' }

  start(openingText: string): void {
    if (this.current !== 'IDLE') return
    this.respond(openingText, () => this.listen())
  }

  /** 아동 발화 1회를 보낸다. LISTENING이 아니면 무시하고 false를 돌려준다. */
  submit(utterance: ChatUtterance): boolean {
    if (this.current !== 'LISTENING') return false
    const token = ++this.turnToken
    const index = this.nextTurn
    this.fillerUsed = false
    this.pending = null
    this.setState('PROCESSING')
    this.action('THINKING')
    this.fillerTimer = this.timers.set(() => this.playFiller(token), this.deps.fillerDelayMs ?? HOYA_THINKING_FILLER_DELAY_MS)
    this.deps.requestReply(index, utterance).then(
      reply => this.receive(token, reply, true),
      () => this.receive(token, { text: HOYA_OFFLINE_TEXT, hoyaActions: [], sessionComplete: false }, false))
    return true
  }

  /** 대화 끝내기. 진행 중인 timer·TTS를 멈추고 이후 응답은 반영하지 않는다. */
  end(): void {
    if (this.current === 'ENDED') return
    this.stopAll()
    this.setState('ENDED')
    this.action('IDLE')
  }

  /** 화면이 사라질 때. 아무 callback도 더 부르지 않는다. */
  dispose(): void {
    this.silent = true
    this.stopAll()
    this.current = 'ENDED'
  }

  private stopAll() {
    this.turnToken++
    this.speechToken++
    this.clearFiller()
    this.pending = null
    this.speech?.cancel()
    this.speech = undefined
  }

  private clearFiller() {
    if (this.fillerTimer !== undefined) this.timers.clear(this.fillerTimer)
    this.fillerTimer = undefined
  }

  private playFiller(token: number) {
    this.fillerTimer = undefined
    if (token !== this.turnToken || this.current !== 'PROCESSING' || this.fillerUsed) return
    this.fillerUsed = true
    this.setState('FILLER_SPEAKING')
    // "음..." 동안에도 표정은 THINKING이다. 끝나면 도착한 응답을 말하거나 계속 생각한다.
    this.play(HOYA_FILLER_TEXT, () => {}, () => {
      if (token !== this.turnToken) return
      const waiting = this.pending
      this.pending = null
      if (waiting) this.answer(waiting.reply, waiting.advance)
      else { this.setState('PROCESSING'); this.action('THINKING') }
    })
  }

  private receive(token: number, reply: ChatReply, advance: boolean) {
    if (token !== this.turnToken || this.current === 'ENDED') return
    // "음..."을 말하는 중이면 끝날 때까지 기다린다. 두 음성을 겹쳐 재생하지 않는다.
    if (this.current === 'FILLER_SPEAKING') { this.pending = { reply, advance }; return }
    if (this.current !== 'PROCESSING') return
    this.clearFiller()
    this.answer(reply, advance)
  }

  private answer(reply: ChatReply, advance: boolean) {
    // 서버가 받지 못한 turn(연결 실패)은 번호를 올리지 않아 다음 발화가 같은 번호로 다시 간다.
    if (advance) this.nextTurn = reply.nextTurnIndex ?? this.nextTurn + 1
    this.respond(reply.text, () => {
      if (reply.sessionComplete) { this.end(); this.deps.onComplete?.() }
      else this.listen()
    })
  }

  private respond(text: string, done: () => void) {
    this.setState('RESPONSE_SPEAKING')
    if (!this.silent) this.deps.onText(text)
    this.play(text, () => this.action('TALKING'), done)
  }

  private play(text: string, onStart: () => void, onEnd: () => void) {
    const token = ++this.speechToken
    const live = () => token === this.speechToken && this.current !== 'ENDED'
    this.speech = this.deps.speak(text, {
      onStart: () => { if (live()) onStart() },
      onEnd: () => { if (!live()) return; this.speech = undefined; onEnd() },
    })
  }

  private listen() {
    this.setState('LISTENING')
    this.action('LISTENING')
  }

  private setState(state: HoyaChatState) {
    this.current = state
    if (!this.silent) this.deps.onState(state)
  }

  private action(action: HoyaAction) { if (!this.silent) this.deps.onAction(action) }
}
