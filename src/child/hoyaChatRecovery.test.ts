import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HOYA_DISCONNECTED_TEXT, HOYA_FILLER_TEXT, HOYA_OFFLINE_TEXT, HOYA_RECOVERING_TEXT, HOYA_RECOVERY_DELAYS_MS,
  HOYA_THINKING_FILLER_DELAY_MS, HoyaChatController, TurnRejectedError, type ChatDeps, type ChatReply, type TurnRequest,
} from './hoyaChatController'
import type { HoyaAction } from '../control/speechGameSignal'

interface Spoken { text: string; onStart(): void; onEnd(): void }

function setup(extra: Partial<ChatDeps> = {}) {
  const spoken: Spoken[] = []
  const actions: HoyaAction[] = []
  const requests: { request: TurnRequest; resolve(reply: ChatReply): void; reject(error: Error): void }[] = []
  let ids = 0
  const controller = new HoyaChatController({
    speak: (text, events) => { spoken.push({ text, ...events }); return { cancel() {} } },
    requestReply: request => new Promise<ChatReply>((resolve, reject) => { requests.push({ request, resolve, reject }) }),
    newRequestId: () => `request-${++ids}`,
    onState: () => {}, onAction: action => actions.push(action), onText: () => {},
    ...extra,
  })
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
  const texts = () => spoken.map(item => item.text)
  const reply = (text: string, more: Partial<ChatReply> = {}): ChatReply => ({ text, sessionComplete: false, ...more })
  return { controller, spoken, actions, requests, flush, texts, reply }
}

const first = { transcript: '학교 갔어', alternatives: [], acoustic: {}, recognizer: 'demo_script' as const }
const second = { ...first, transcript: '축구했어' }

describe('응답을 못 받은 turn 복구(RECOVERING)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  /** 첫 발화의 응답을 연결 오류로 잃은 상태(RECOVERING, 복구 안내를 말하는 중)를 만든다. */
  async function lost(t: ReturnType<typeof setup>) {
    t.controller.start('안녕!')
    t.spoken[0].onEnd()
    t.controller.submit(first)
    t.requests[0].reject(new TypeError('Failed to fetch'))
    await t.flush()
    expect(t.controller.state).toBe('RECOVERING')
    expect(t.texts().at(-1)).toBe(HOYA_RECOVERING_TEXT)
  }
  async function nextAttempt(t: ReturnType<typeof setup>, ms = HOYA_RECOVERY_DELAYS_MS[0]) {
    vi.advanceTimersByTime(ms)
    await t.flush()
  }

  it('1: 같은 요청 ID로 복구한 호야 답을 실제로 말한 뒤 LISTENING이 되고, 그 뒤에야 새 발화를 보낸다', async () => {
    const t = setup()
    await lost(t)
    t.spoken.at(-1)!.onEnd()
    await nextAttempt(t)
    expect(t.requests[1].request).toEqual(t.requests[0].request)
    t.requests[1].resolve(t.reply('학교 다녀왔구나! 무슨 수업 했어?', { nextTurnIndex: 2 }))
    await t.flush()
    const recovered = t.spoken.at(-1)!
    expect(recovered.text).toBe('학교 다녀왔구나! 무슨 수업 했어?')
    expect(t.controller.state).toBe('RESPONSE_SPEAKING')
    recovered.onStart()
    expect(t.actions.at(-1)).toBe('TALKING')
    recovered.onEnd()
    expect(t.controller.state).toBe('LISTENING')
    expect(t.controller.listening).toBe(true)
    t.controller.submit(second)
    expect(t.requests[2].request).toMatchObject({ index: 2, requestId: 'request-2' })
    expect(t.requests[2].request.utterance.transcript).toBe('축구했어')
  })

  it('2·3: 복구 중에는 listening=false이고 새 발화를 받지 않는다', async () => {
    const t = setup()
    await lost(t)
    expect(t.controller.listening).toBe(false)
    expect(t.controller.submit(second)).toBe(false)
    t.spoken.at(-1)!.onEnd()
    // 안내가 끝나도 LISTENING으로 돌아가지 않는다.
    expect(t.controller.state).toBe('RECOVERING')
    expect(t.actions.at(-1)).toBe('THINKING')
    expect(t.controller.submit(second)).toBe(false)
    await nextAttempt(t)
    expect(t.controller.submit(second)).toBe(false)
    expect(t.requests.every(item => item.request.requestId === 'request-1')).toBe(true)
  })

  it('복구 안내를 말하는 중에 답이 오면 겹치지 않고 안내가 끝난 뒤 말한다', async () => {
    const t = setup()
    await lost(t)
    await nextAttempt(t)
    t.requests[1].resolve(t.reply('저장된 답', { nextTurnIndex: 2 }))
    await t.flush()
    expect(t.texts().at(-1)).toBe(HOYA_RECOVERING_TEXT)
    t.spoken.at(-1)!.onEnd()
    expect(t.texts().at(-1)).toBe('저장된 답')
  })

  it('4: 복구한 답이 마지막 turn이면 그 답을 말한 뒤 ENDED', async () => {
    const done = vi.fn()
    const t = setup({ onComplete: done })
    await lost(t)
    t.spoken.at(-1)!.onEnd()
    await nextAttempt(t)
    t.requests[1].resolve(t.reply('오늘은 여기까지!', { nextTurnIndex: 3, sessionComplete: true }))
    await t.flush()
    expect(t.texts().at(-1)).toBe('오늘은 여기까지!')
    expect(t.controller.state).toBe('RESPONSE_SPEAKING')
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.state).toBe('ENDED')
    expect(done).toHaveBeenCalledOnce()
  })

  it('5: 복구가 오래 걸려도 "음..."은 logical turn당 한 번뿐이다', async () => {
    const t = setup()
    t.controller.start('안녕!')
    t.spoken[0].onEnd()
    t.controller.submit(first)
    vi.advanceTimersByTime(HOYA_THINKING_FILLER_DELAY_MS)
    expect(t.texts().at(-1)).toBe(HOYA_FILLER_TEXT)
    t.requests[0].reject(new TypeError('Failed to fetch'))
    await t.flush()
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.state).toBe('RECOVERING')
    expect(t.texts().at(-1)).toBe(HOYA_RECOVERING_TEXT)
    t.spoken.at(-1)!.onEnd()
    for (const delay of HOYA_RECOVERY_DELAYS_MS.slice(0, 2)) {
      await nextAttempt(t, delay)
      t.requests.at(-1)!.reject(new TypeError('Failed to fetch'))
      await t.flush()
    }
    expect(t.texts().filter(text => text.startsWith('음'))).toHaveLength(1)
  })

  it('6: 복구 중에 끝내면 timer를 정리하고 늦은 답은 무시한다', async () => {
    const t = setup()
    await lost(t)
    await nextAttempt(t)
    t.controller.end()
    t.requests[1].resolve(t.reply('늦은 답', { nextTurnIndex: 2 }))
    await t.flush()
    vi.advanceTimersByTime(10_000)
    await t.flush()
    expect(t.texts()).not.toContain('늦은 답')
    expect(t.requests).toHaveLength(2)
    expect(t.controller.state).toBe('ENDED')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('화면이 사라지면 복구 대기 timer도 남지 않는다', async () => {
    const t = setup()
    await lost(t)
    t.controller.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('끝까지 복구하지 못하면 새 발화를 받지 않고 인사한 뒤 대화를 끝낸다(무한 재시도 없음)', async () => {
    const done = vi.fn()
    const t = setup({ onComplete: done })
    await lost(t)
    t.spoken.at(-1)!.onEnd()
    for (const delay of HOYA_RECOVERY_DELAYS_MS) {
      await nextAttempt(t, delay)
      expect(t.controller.listening).toBe(false)
      t.requests.at(-1)!.reject(new TypeError('Failed to fetch'))
      await t.flush()
    }
    expect(t.requests).toHaveLength(1 + HOYA_RECOVERY_DELAYS_MS.length)
    expect(t.texts().at(-1)).toBe(HOYA_DISCONNECTED_TEXT)
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.state).toBe('ENDED')
    expect(done).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(60_000)
    expect(t.requests).toHaveLength(1 + HOYA_RECOVERY_DELAYS_MS.length)
  })

  it('복구 중 서버가 거절(409)하면 서버 번호로 맞추고 다시 말해 달라고 한다(409 반복 없음)', async () => {
    const resync = vi.fn(async () => ({ nextTurnIndex: 4, active: true }))
    const t = setup({ resync })
    await lost(t)
    t.spoken.at(-1)!.onEnd()
    await nextAttempt(t)
    t.requests[1].reject(new TurnRejectedError(409, 'REQUEST_ID_REUSED'))
    await t.flush()
    expect(resync).toHaveBeenCalledOnce()
    expect(t.texts().at(-1)).toBe(HOYA_OFFLINE_TEXT)
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.state).toBe('LISTENING')
    t.controller.submit(second)
    expect(t.requests[2].request).toMatchObject({ index: 4, requestId: 'request-2' })
  })

  it('복구 중 로그인이 만료되면(401/403) 다시 듣지 않고 인사한 뒤 대화를 끝낸다', async () => {
    for (const status of [401, 403]) {
      const done = vi.fn()
      const resync = vi.fn(async () => ({ nextTurnIndex: 2, active: true }))
      const t = setup({ onComplete: done, resync })
      await lost(t)
      t.spoken.at(-1)!.onEnd()
      await nextAttempt(t)
      t.requests[1].reject(new TurnRejectedError(status, '로그인이 필요합니다'))
      await t.flush()
      expect(t.texts().at(-1)).toBe(HOYA_DISCONNECTED_TEXT)
      expect(t.controller.listening).toBe(false)
      t.spoken.at(-1)!.onEnd()
      expect(t.controller.state).toBe('ENDED')
      expect(done).toHaveBeenCalledOnce()
      expect(resync).not.toHaveBeenCalled()
    }
  })

  it('처음부터 거절됐고 서버 대화가 끝나 있으면 대화를 끝낸다', async () => {
    const done = vi.fn()
    const t = setup({ resync: async () => ({ nextTurnIndex: 3, active: false }), onComplete: done })
    t.controller.start('안녕!')
    t.spoken[0].onEnd()
    t.controller.submit(first)
    t.requests[0].reject(new TurnRejectedError(409, '끝난 대화입니다'))
    await t.flush()
    expect(t.controller.state).toBe('ENDED')
    expect(done).toHaveBeenCalledOnce()
  })
})
