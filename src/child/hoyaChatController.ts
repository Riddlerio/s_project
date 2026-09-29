import type { HoyaAction } from '../control/speechGameSignal'
import type { Acoustic } from '../shared/types'

/**
 * 호야와 대화하기의 turn 흐름. 화면(React)과 분리해 timer·TTS·응답 순서를 테스트할 수 있게 한다.
 * 내부 상태는 HoyaAction(캐릭터 표정)과 다른 값이며, 호야 표정은 이 상태에서만 정한다
 * (PROCESSING·FILLER_SPEAKING → THINKING, RESPONSE_SPEAKING → TALKING, LISTENING → LISTENING).
 *
 * LISTENING → (아동 발화) → PROCESSING(THINKING) → [늦으면 "음..." 1회: FILLER_SPEAKING] → RESPONSE_SPEAKING → LISTENING
 *
 * 발화 1회마다 요청 ID를 하나 만든다. 응답을 받지 못한 turn은 같은 ID로만 다시 묻고,
 * 다음 발화를 보내기 전에 그 turn이 서버에서 어떻게 됐는지 먼저 확인한다.
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
export interface ChatReply { text: string; nextTurnIndex?: number; sessionComplete: boolean }
/** 서버로 보내는 발화 1회. 재시도는 이 객체(같은 번호·요청 ID·발화)를 그대로 다시 쓴다. */
export interface TurnRequest { index: number; requestId: string; utterance: ChatUtterance }
export interface Timers { set(callback: () => void, ms: number): unknown; clear(id: unknown): void }

/** 서버가 요청을 거절함(4xx). 같은 요청을 다시 보내도 결과가 같다. */
export class TurnRejectedError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export interface ChatDeps {
  speak: Speak
  requestReply(request: TurnRequest): Promise<ChatReply>
  /** 거절된 뒤 서버의 대화 상태로 번호를 맞춘다. 없으면 번호를 그대로 둔다. */
  resync?(): Promise<{ nextTurnIndex: number; active: boolean }>
  onState(state: HoyaChatState): void
  onAction(action: HoyaAction): void
  onText(text: string): void
  onComplete?(): void
  newRequestId?(): string
  fillerDelayMs?: number
  timers?: Timers
}

const defaultTimers: Timers = { set: (callback, ms) => setTimeout(callback, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) }

/** 아동·계정 정보를 담지 않는 임의 값. */
export function randomRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
}

export class HoyaChatController {
  private current: HoyaChatState = 'IDLE'
  private nextTurn = 1
  /** 대기 중인 turn. 새 turn·종료 때 바뀌어 늦게 온 응답을 버린다. */
  private turnToken = 0
  /** 재생 중인 음성. 종료·새 재생 때 바뀌어 이전 TTS callback을 버린다. */
  private speechToken = 0
  private fillerTimer: unknown = undefined
  private fillerUsed = false
  private pending: ChatReply | null = null
  /** 보냈지만 결과를 모르는 turn. 다음 발화 전에 같은 요청 ID로 먼저 확인한다. */
  private unresolved: TurnRequest | null = null
  private speech?: SpeakHandle
  private silent = false
  private readonly timers: Timers

  constructor(private readonly deps: ChatDeps) { this.timers = deps.timers ?? defaultTimers }

  get state(): HoyaChatState { return this.current }
  get turnIndex(): number { return this.nextTurn }
  get hasUnresolvedTurn(): boolean { return this.unresolved !== null }
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
    this.fillerUsed = false
    this.pending = null
    this.setState('PROCESSING')
    this.action('THINKING')
    this.fillerTimer = this.timers.set(() => this.playFiller(token), this.deps.fillerDelayMs ?? HOYA_THINKING_FILLER_DELAY_MS)
    void this.process(token, utterance)
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

  private async process(token: number, utterance: ChatUtterance) {
    // 이전 발화의 결과를 모르면 먼저 같은 요청 ID로 확인한다. 이전 발화와 새 발화를 섞지 않는다.
    const earlier = this.unresolved
    let request: TurnRequest | null = earlier
    try {
      if (earlier) {
        const recovered = await this.deps.requestReply(earlier)
        if (token !== this.turnToken) return
        this.unresolved = null
        this.nextTurn = recovered.nextTurnIndex ?? earlier.index + 1
        if (recovered.sessionComplete) { this.receive(token, recovered); return }
      }
      request = { index: this.nextTurn, requestId: (this.deps.newRequestId ?? randomRequestId)(), utterance }
      const reply = await this.deps.requestReply(request)
      if (token !== this.turnToken) return
      this.nextTurn = reply.nextTurnIndex ?? request.index + 1
      this.receive(token, reply)
    } catch (error) {
      if (token !== this.turnToken) return
      if (error instanceof TurnRejectedError) {
        // 거절은 재시도해도 같다. 미해결 turn을 버리고 서버 상태로 번호를 맞춘다(409 반복 방지).
        this.unresolved = null
        const state = await this.deps.resync?.().catch(() => null)
        if (token !== this.turnToken) return
        if (state && !state.active) { this.end(); this.deps.onComplete?.(); return }
        if (state) this.nextTurn = state.nextTurnIndex
      } else {
        // 서버가 처리했는지 모른다. 번호를 올리지 않고 이 요청을 기억해 다음 발화 전에 같은 ID로 확인한다.
        this.unresolved = request
      }
      this.receive(token, { text: HOYA_OFFLINE_TEXT, sessionComplete: false })
    }
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
      if (waiting) this.answer(waiting)
      else { this.setState('PROCESSING'); this.action('THINKING') }
    })
  }

  private receive(token: number, reply: ChatReply) {
    if (token !== this.turnToken || this.current === 'ENDED') return
    // "음..."을 말하는 중이면 끝날 때까지 기다린다. 두 음성을 겹쳐 재생하지 않는다.
    if (this.current === 'FILLER_SPEAKING') { this.pending = reply; return }
    if (this.current !== 'PROCESSING') return
    this.clearFiller()
    this.answer(reply)
  }

  private answer(reply: ChatReply) {
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
