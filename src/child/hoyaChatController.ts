import type { HoyaAction } from '../control/speechGameSignal'
import type { Acoustic } from '../shared/types'

/**
 * 호야와 대화하기의 turn 흐름. 화면(React)과 분리해 timer·TTS·응답 순서를 테스트할 수 있게 한다.
 * 내부 상태는 HoyaAction(캐릭터 표정)과 다른 값이며, 호야 표정은 이 상태에서만 정한다
 * (PROCESSING·FILLER_SPEAKING·RECOVERING → THINKING, RESPONSE_SPEAKING → TALKING, LISTENING → LISTENING).
 *
 * LISTENING → (아동 발화) → PROCESSING(THINKING) → [늦으면 "음..." 1회: FILLER_SPEAKING] → RESPONSE_SPEAKING → LISTENING
 *
 * 발화 1회마다 요청 ID를 하나 만든다. 응답을 받지 못하면(결과를 모름) RECOVERING이 되어 같은 ID로만 다시 묻는다.
 * 그동안에는 새 발화를 받지 않고, 복구된 호야 답을 실제로 말한 뒤에만 다시 듣는다.
 * 그래서 서버에 저장된 대화와 아동이 실제로 들은 대화가 같다.
 */
export type HoyaChatState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'FILLER_SPEAKING' | 'RECOVERING' | 'RESPONSE_SPEAKING' | 'ENDED'

/** 응답이 이 시간보다 늦을 때만 "음..."을 한 번 말한다. 사용성 테스트에서 조정한다. */
export const HOYA_THINKING_FILLER_DELAY_MS = 750
export const HOYA_FILLER_TEXT = '음...'
/** 서버가 발화를 받지 않았을 때(거절)의 말. 오류 내용이나 발음 결과를 말하지 않는다. */
export const HOYA_OFFLINE_TEXT = '두두가 잠깐 딴생각을 했어. 다시 이야기해 줄래?'
/** 결과를 모르는 turn을 복구하는 동안의 말. 새 발화를 청하지 않는다. "음..."은 turn마다 한 번만 쓰므로 넣지 않는다. */
export const HOYA_RECOVERING_TEXT = '잠깐만, 두두가 다시 생각해 볼게.'
/** 여러 번 복구해도 결과를 모를 때의 마지막 말. 이후 대화를 끝낸다. */
export const HOYA_DISCONNECTED_TEXT = '두두가 잠시 쉬어야 해. 다음에 또 이야기하자!'
/** 복구 재시도 사이 대기(ms). 각 재시도는 API 계층에서도 같은 요청 ID로 몇 번 더 묻는다. 끝없이 반복하지 않는다. */
export const HOYA_RECOVERY_DELAYS_MS = [1000, 2000, 4000]

export interface SpeakHandle { cancel(): void }
export type Speak = (text: string, events: { onStart(): void; onEnd(): void }) => SpeakHandle
export interface ChatUtterance { transcript: string | null; alternatives: string[]; acoustic: Partial<Acoustic>; recognizer: 'web_speech' | 'demo_script' }
/** nextActivity: 서버가 대화를 마치고 게임을 권할 때만 온다(예: 'daegu_crossing'). 근거·횟수 같은 내부 정보는 오지 않는다. */
export interface ChatReply { text: string; nextTurnIndex?: number; sessionComplete: boolean; nextActivity?: string | null }
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
  /** 두두가 게임을 권하는 말을 시작할 때 부른다. 화면은 아래 게임 버튼을 빛낸다. */
  onNextActivity?(activity: string): void
  /**
   * 다시 듣기 직전에 화면이 '네 차례' 신호(두두 귀 쫑긋·짧은 차임)를 내고, 끝나면 open을 부른다(2026-10-05 Phase 4).
   * 그동안 상태는 RESPONSE_SPEAKING이라 마이크 소리(차임 포함)를 아동 발화로 받지 않는다. 없으면 바로 듣는다.
   * 대화를 끝내는 답 뒤에는 부르지 않는다. 신호 중에 끝내기·정리되면 open을 불러도 듣지 않는다.
   */
  beforeListen?(open: () => void): void
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
  private recoveryTimer: unknown = undefined
  private fillerUsed = false
  private pending: ChatReply | null = null
  /** 보냈지만 결과를 모르는 turn. 복구가 끝날 때까지 새 발화를 받지 않는다. */
  private unresolved: TurnRequest | null = null
  /** 복구 안내 말을 하는 중. 이때 도착한 답은 안내가 끝난 뒤 말한다. */
  private noticeSpeaking = false
  private speech?: SpeakHandle
  private silent = false
  private readonly timers: Timers

  constructor(private readonly deps: ChatDeps) { this.timers = deps.timers ?? defaultTimers }

  get state(): HoyaChatState { return this.current }
  get turnIndex(): number { return this.nextTurn }
  get hasUnresolvedTurn(): boolean { return this.unresolved !== null }
  /** 호야가 말하거나 생각하거나 복구하는 동안에는 아동 발화를 받지 않는다(호야 자신의 TTS를 다시 듣지 않게). */
  get listening(): boolean { return this.current === 'LISTENING' && this.unresolved === null }

  start(openingText: string): void {
    if (this.current !== 'IDLE') return
    this.respond(openingText, () => this.listen())
  }

  /** 아동 발화 1회를 보낸다. LISTENING이 아니면 무시하고 false를 돌려준다. */
  submit(utterance: ChatUtterance): boolean {
    if (!this.listening) return false
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
    const request: TurnRequest = { index: this.nextTurn, requestId: (this.deps.newRequestId ?? randomRequestId)(), utterance }
    try {
      const reply = await this.deps.requestReply(request)
      if (token !== this.turnToken) return
      this.nextTurn = reply.nextTurnIndex ?? request.index + 1
      this.receive(token, reply)
    } catch (error) {
      if (token !== this.turnToken) return
      if (error instanceof TurnRejectedError) await this.rejected(token, error)
      else await this.recover(token, request)
    }
  }

  /** 서버가 받았는지 모르는 turn: 같은 요청 ID로만 다시 묻고, 받은 답을 아동에게 들려준 뒤 다음 발화를 받는다. */
  private async recover(token: number, request: TurnRequest) {
    this.unresolved = request
    this.enterRecovering(token)
    for (const delay of HOYA_RECOVERY_DELAYS_MS) {
      await new Promise<void>(resolve => { this.recoveryTimer = this.timers.set(resolve, delay) })
      this.recoveryTimer = undefined
      if (token !== this.turnToken) return
      try {
        const reply = await this.deps.requestReply(request)
        if (token !== this.turnToken) return
        this.unresolved = null
        this.nextTurn = reply.nextTurnIndex ?? request.index + 1
        this.receive(token, reply)
        return
      } catch (error) {
        if (token !== this.turnToken) return
        if (error instanceof TurnRejectedError) { this.unresolved = null; await this.rejected(token, error); return }
      }
    }
    // 끝없이 재시도하지 않는다. 대화를 끝내므로 아동이 듣지 못한 답 뒤로 새 발화가 이어지지 않는다.
    this.unresolved = null
    this.receive(token, { text: HOYA_DISCONNECTED_TEXT, sessionComplete: true })
  }

  private enterRecovering(token: number) {
    // "음..."을 말하는 중이면 그대로 두고, 끝난 뒤 RECOVERING으로 바꾼다(playFiller의 끝 처리).
    if (this.current !== 'PROCESSING') return
    this.clearFiller()
    this.setState('RECOVERING')
    this.action('THINKING')
    this.noticeSpeaking = true
    this.play(HOYA_RECOVERING_TEXT, () => {}, () => {
      this.noticeSpeaking = false
      if (token !== this.turnToken) return
      const waiting = this.pending
      this.pending = null
      if (waiting) this.answer(waiting)
      else this.action('THINKING')
    })
  }

  /** 서버가 이 발화를 받지 않았다(4xx). 서버 번호로 맞추고 다시 말해 달라고 한다(409 반복 방지). */
  private async rejected(token: number, error: TurnRejectedError) {
    // 로그인·CSRF가 만료되면(401/403) 다시 말해도 계속 거절된다. 저장됐을지 모르는 답 뒤로 새 발화를 잇지 않고 대화를 끝낸다.
    if (error.status === 401 || error.status === 403) {
      this.receive(token, { text: HOYA_DISCONNECTED_TEXT, sessionComplete: true })
      return
    }
    const state = await this.deps.resync?.().catch(() => null)
    if (token !== this.turnToken) return
    if (state && !state.active) { this.end(); this.deps.onComplete?.(); return }
    if (state) this.nextTurn = state.nextTurnIndex
    this.receive(token, { text: HOYA_OFFLINE_TEXT, sessionComplete: false })
  }

  private stopAll() {
    this.turnToken++
    this.speechToken++
    this.clearFiller()
    // 복구 대기 timer도 멈춘다. 기다리던 복구는 더 진행되지 않는다.
    if (this.recoveryTimer !== undefined) this.timers.clear(this.recoveryTimer)
    this.recoveryTimer = undefined
    this.pending = null
    this.noticeSpeaking = false
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
      else if (this.unresolved) this.enterRecoveringAfterFiller(token)
      else { this.setState('PROCESSING'); this.action('THINKING') }
    })
  }

  private enterRecoveringAfterFiller(token: number) {
    this.setState('PROCESSING')
    this.enterRecovering(token)
  }

  private receive(token: number, reply: ChatReply) {
    if (token !== this.turnToken || this.current === 'ENDED') return
    // "음..."이나 복구 안내를 말하는 중이면 끝날 때까지 기다린다. 두 음성을 겹쳐 재생하지 않는다.
    if (this.current === 'FILLER_SPEAKING' || this.noticeSpeaking) { this.pending = reply; return }
    if (this.current !== 'PROCESSING' && this.current !== 'RECOVERING') return
    this.clearFiller()
    this.answer(reply)
  }

  private answer(reply: ChatReply) {
    if (reply.nextActivity) this.deps.onNextActivity?.(reply.nextActivity)
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
    const open = () => { this.setState('LISTENING'); this.action('LISTENING') }
    if (!this.deps.beforeListen) { open(); return }
    const speech = this.speechToken, turn = this.turnToken
    this.deps.beforeListen(() => {
      if (speech === this.speechToken && turn === this.turnToken && this.current === 'RESPONSE_SPEAKING') open()
    })
  }

  private setState(state: HoyaChatState) {
    this.current = state
    if (!this.silent) this.deps.onState(state)
  }

  private action(action: HoyaAction) { if (!this.silent) this.deps.onAction(action) }
}
