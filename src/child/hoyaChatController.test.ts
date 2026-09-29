import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOYA_FILLER_TEXT, HOYA_OFFLINE_TEXT, HOYA_THINKING_FILLER_DELAY_MS, HoyaChatController, TurnRejectedError, type ChatDeps, type ChatReply, type HoyaChatState, type TurnRequest } from './hoyaChatController'
import type { HoyaAction } from '../control/speechGameSignal'

interface Spoken { text: string; onStart(): void; onEnd(): void; cancelled: boolean }

function setup(extra: Partial<ChatDeps> = {}) {
  const spoken: Spoken[] = []
  const states: HoyaChatState[] = []
  const actions: HoyaAction[] = []
  const texts: string[] = []
  const requests: { index: number; request: TurnRequest; resolve(reply: ChatReply): void; reject(error: Error): void }[] = []
  let ids = 0
  const controller = new HoyaChatController({
    speak: (text, events) => {
      const item = { text, ...events, cancelled: false }
      spoken.push(item)
      return { cancel: () => { item.cancelled = true } }
    },
    requestReply: request => new Promise<ChatReply>((resolve, reject) => { requests.push({ index: request.index, request, resolve, reject }) }),
    newRequestId: () => `request-${++ids}`,
    onState: state => states.push(state),
    onAction: action => actions.push(action),
    onText: text => texts.push(text),
    ...extra,
  })
  const utterance = { transcript: '학교 갔어', alternatives: [], acoustic: {}, recognizer: 'demo_script' as const }
  /** 첫 인사를 끝까지 말하고 LISTENING이 된 상태로 만든다. */
  const ready = () => { controller.start('안녕!'); spoken[0].onStart(); spoken[0].onEnd() }
  const reply = (text = '학교 다녀왔구나!', extra: Partial<ChatReply> = {}): ChatReply => ({ text, sessionComplete: false, ...extra })
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
  return { controller, spoken, states, actions, texts, requests, utterance, ready, reply, flush }
}

describe('호야 대화 turn 흐름', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('Case 1: 응답이 빠르면 THINKING 뒤 바로 답하고 "음..."은 없다', async () => {
    const t = setup()
    t.ready()
    expect(t.controller.submit(t.utterance)).toBe(true)
    expect(t.controller.state).toBe('PROCESSING')
    expect(t.actions.at(-1)).toBe('THINKING')
    t.requests[0].resolve(t.reply())
    await t.flush()
    vi.advanceTimersByTime(HOYA_THINKING_FILLER_DELAY_MS * 3)
    expect(t.spoken.map(item => item.text)).toEqual(['안녕!', '학교 다녀왔구나!'])
    expect(t.controller.state).toBe('RESPONSE_SPEAKING')
    // 응답이 준비되면 인위적인 대기 없이 바로 말한다.
    t.spoken[1].onStart()
    expect(t.actions.at(-1)).toBe('TALKING')
  })

  it('Case 2: 응답이 늦으면 "음..."을 한 번 말한 뒤 답한다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    vi.advanceTimersByTime(HOYA_THINKING_FILLER_DELAY_MS)
    expect(t.spoken.at(-1)?.text).toBe(HOYA_FILLER_TEXT)
    expect(t.controller.state).toBe('FILLER_SPEAKING')
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.state).toBe('PROCESSING')
    expect(t.actions.at(-1)).toBe('THINKING')
    t.requests[0].resolve(t.reply())
    await t.flush()
    expect(t.spoken.map(item => item.text)).toEqual(['안녕!', HOYA_FILLER_TEXT, '학교 다녀왔구나!'])
  })

  it('Case 3: "음..." 재생 중에 응답이 오면 겹치지 않고 끝난 뒤 답한다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    vi.advanceTimersByTime(HOYA_THINKING_FILLER_DELAY_MS)
    t.requests[0].resolve(t.reply())
    await t.flush()
    expect(t.spoken.map(item => item.text)).toEqual(['안녕!', HOYA_FILLER_TEXT])
    expect(t.controller.state).toBe('FILLER_SPEAKING')
    t.spoken[1].onEnd()
    expect(t.spoken.map(item => item.text)).toEqual(['안녕!', HOYA_FILLER_TEXT, '학교 다녀왔구나!'])
    expect(t.controller.state).toBe('RESPONSE_SPEAKING')
  })

  it('Case 4: 서버가 DEMO로 대체한 응답(또는 연결 실패)도 TALKING을 거쳐 LISTENING으로 돌아간다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    vi.advanceTimersByTime(HOYA_THINKING_FILLER_DELAY_MS)
    t.spoken[1].onEnd()
    t.requests[0].reject(new Error('요청 실패 (500)'))
    await t.flush()
    const last = t.spoken.at(-1)!
    expect(last.text).toBe(HOYA_OFFLINE_TEXT)
    expect(t.texts.join(' ')).not.toMatch(/500|오류|Error|timeout|OpenAI/)
    last.onStart(); last.onEnd()
    expect(t.actions.slice(-2)).toEqual(['TALKING', 'LISTENING'])
    expect(t.controller.state).toBe('LISTENING')
    // 서버가 받지 못한 turn이므로 같은 번호로 다시 보낸다.
    expect(t.controller.turnIndex).toBe(1)
  })

  it('Case 5: 여러 초를 기다려도 "음..."은 한 번뿐이다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    vi.advanceTimersByTime(HOYA_THINKING_FILLER_DELAY_MS)
    t.spoken[1].onEnd()
    vi.advanceTimersByTime(10_000)
    expect(t.spoken.filter(item => item.text === HOYA_FILLER_TEXT)).toHaveLength(1)
    expect(t.controller.state).toBe('PROCESSING')
  })

  it('Case 6: 호야가 말하거나 생각하는 동안에는 아동 발화를 보내지 않는다', async () => {
    const t = setup()
    t.controller.start('안녕!')
    expect(t.controller.listening).toBe(false)
    expect(t.controller.submit(t.utterance)).toBe(false)
    t.spoken[0].onEnd()
    expect(t.controller.submit(t.utterance)).toBe(true)
    expect(t.controller.submit(t.utterance)).toBe(false)
    vi.advanceTimersByTime(HOYA_THINKING_FILLER_DELAY_MS)
    expect(t.controller.submit(t.utterance)).toBe(false)
    t.spoken[1].onEnd()
    t.requests[0].resolve(t.reply())
    await t.flush()
    expect(t.controller.submit(t.utterance)).toBe(false)
    expect(t.requests).toHaveLength(1)
  })

  it('Case 7: 답변 TTS가 끝나면 자동으로 LISTENING이 되고 다음 turn 번호를 쓴다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    t.requests[0].resolve(t.reply('좋아!', { nextTurnIndex: 2 }))
    await t.flush()
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.state).toBe('LISTENING')
    expect(t.actions.at(-1)).toBe('LISTENING')
    t.controller.submit(t.utterance)
    expect(t.requests[1].index).toBe(2)
  })

  it('Case 8: 화면이 사라지면 timer·TTS를 정리하고 상태를 더 바꾸지 않는다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    const before = { states: t.states.length, actions: t.actions.length, texts: t.texts.length }
    t.controller.dispose()
    vi.advanceTimersByTime(5_000)
    t.requests[0].resolve(t.reply())
    await t.flush()
    expect(t.spoken).toHaveLength(1)
    expect({ states: t.states.length, actions: t.actions.length, texts: t.texts.length }).toEqual(before)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('Case 8b: 말하는 중에 끝내면 TTS를 멈추고 이후 callback을 무시한다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    t.requests[0].resolve(t.reply())
    await t.flush()
    const speaking = t.spoken.at(-1)!
    t.controller.end()
    expect(speaking.cancelled).toBe(true)
    speaking.onEnd()
    expect(t.controller.state).toBe('ENDED')
    expect(t.controller.submit(t.utterance)).toBe(false)
  })

  it('Case 9: 늦게 온 이전 응답은 다음 turn의 화면·TTS를 덮어쓰지 않는다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    t.requests[0].resolve(t.reply('첫 번째'))
    await t.flush()
    t.spoken.at(-1)!.onEnd()
    t.controller.submit(t.utterance)
    // 같은 promise가 다시 풀려도(중복 callback) 반영하지 않는다.
    t.requests[0].resolve(t.reply('늦은 응답'))
    await t.flush()
    expect(t.spoken.map(item => item.text)).not.toContain('늦은 응답')
    expect(t.controller.state).toBe('PROCESSING')
    t.requests[1].resolve(t.reply('두 번째'))
    await t.flush()
    expect(t.texts.at(-1)).toBe('두 번째')
  })

  it('끝난 대화 뒤 도착한 응답은 무시한다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(t.utterance)
    t.controller.end()
    t.requests[0].resolve(t.reply('늦은 응답'))
    await t.flush()
    expect(t.texts).not.toContain('늦은 응답')
    expect(t.controller.state).toBe('ENDED')
  })

  it('마지막 turn 응답이 끝나면 대화를 끝낸다', async () => {
    const t = setup()
    const done = vi.fn()
    const controller = new HoyaChatController({ speak: (_text, events) => { setTimeout(events.onEnd, 10); return { cancel() {} } },
      requestReply: async () => t.reply('오늘은 여기까지!', { sessionComplete: true }),
      onState: () => {}, onAction: () => {}, onText: () => {}, onComplete: done })
    controller.start('안녕!')
    vi.advanceTimersByTime(10)
    controller.submit(t.utterance)
    await t.flush()
    vi.advanceTimersByTime(10)
    expect(controller.state).toBe('ENDED')
    expect(done).toHaveBeenCalledOnce()
  })
})

describe('응답을 못 받은 turn 복구', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  const first = { transcript: '학교 갔어', alternatives: [], acoustic: {}, recognizer: 'demo_script' as const }
  const second = { ...first, transcript: '수박 먹었어' }

  /** 첫 발화의 응답을 연결 오류로 잃고, 안내 말이 끝나 다시 듣는 상태를 만든다. */
  async function lost(t: ReturnType<typeof setup>) {
    t.ready()
    t.controller.submit(first)
    t.requests[0].reject(new TypeError('Failed to fetch'))
    await t.flush()
    expect(t.spoken.at(-1)!.text).toBe(HOYA_OFFLINE_TEXT)
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.state).toBe('LISTENING')
    expect(t.controller.hasUnresolvedTurn).toBe(true)
  }

  it('다음 발화 전에 이전 발화를 같은 요청 ID로 먼저 확인하고, 새 발화는 새 ID와 다음 번호로 보낸다', async () => {
    const t = setup()
    await lost(t)
    t.controller.submit(second)
    expect(t.requests[1].request).toEqual(t.requests[0].request)
    expect(t.requests[1].request.utterance.transcript).toBe('학교 갔어')
    // 서버는 이미 turn 1을 끝냈었다(응답만 유실). 저장된 결과로 번호를 맞춘다.
    t.requests[1].resolve(t.reply('저장된 답', { nextTurnIndex: 2 }))
    await t.flush()
    expect(t.requests[2].request).toMatchObject({ index: 2, requestId: 'request-2' })
    expect(t.requests[2].request.utterance.transcript).toBe('수박 먹었어')
    t.requests[2].resolve(t.reply('수박 맛있지!', { nextTurnIndex: 3 }))
    await t.flush()
    expect(t.texts.at(-1)).toBe('수박 맛있지!')
    expect(t.controller.turnIndex).toBe(3)
    expect(t.controller.hasUnresolvedTurn).toBe(false)
  })

  it('확인하는 동안에는 새 발화를 받지 않는다', async () => {
    const t = setup()
    await lost(t)
    t.controller.submit(second)
    expect(t.controller.state).toBe('PROCESSING')
    expect(t.controller.submit(second)).toBe(false)
    expect(t.requests).toHaveLength(2)
  })

  it('이전 발화를 여전히 확인할 수 없으면 새 발화를 보내지 않고 같은 요청을 계속 기억한다', async () => {
    const t = setup()
    await lost(t)
    t.controller.submit(second)
    t.requests[1].reject(new Error('HOYA_TURN_UNRESOLVED'))
    await t.flush()
    expect(t.requests).toHaveLength(2)
    expect(t.spoken.at(-1)!.text).toBe(HOYA_OFFLINE_TEXT)
    t.spoken.at(-1)!.onEnd()
    t.controller.submit(second)
    expect(t.requests[2].request).toEqual(t.requests[0].request)
  })

  it('서버가 거절(409)하면 미해결 turn을 버리고 서버 번호로 맞춘다(409 반복 없음)', async () => {
    const resync = vi.fn(async () => ({ nextTurnIndex: 4, active: true }))
    const t = setup({ resync })
    await lost(t)
    t.controller.submit(second)
    t.requests[1].reject(new TurnRejectedError(409, '대화 순서가 맞지 않습니다'))
    await t.flush()
    expect(resync).toHaveBeenCalledOnce()
    expect(t.controller.hasUnresolvedTurn).toBe(false)
    expect(t.controller.turnIndex).toBe(4)
    t.spoken.at(-1)!.onEnd()
    t.controller.submit(second)
    expect(t.requests[2].request).toMatchObject({ index: 4, requestId: 'request-2' })
  })

  it('거절 뒤 서버 대화가 끝나 있으면 대화를 끝낸다', async () => {
    const done = vi.fn()
    const t = setup({ resync: async () => ({ nextTurnIndex: 3, active: false }), onComplete: done })
    t.ready()
    t.controller.submit(first)
    t.requests[0].reject(new TurnRejectedError(409, '끝난 대화입니다'))
    await t.flush()
    expect(t.controller.state).toBe('ENDED')
    expect(done).toHaveBeenCalledOnce()
  })

  it('확인한 이전 turn이 마지막 turn이었으면 그 답을 말하고 끝낸다(새 발화는 보내지 않음)', async () => {
    const done = vi.fn()
    const t = setup({ onComplete: done })
    await lost(t)
    t.controller.submit(second)
    t.requests[1].resolve(t.reply('오늘은 여기까지!', { nextTurnIndex: 3, sessionComplete: true }))
    await t.flush()
    expect(t.requests).toHaveLength(2)
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.state).toBe('ENDED')
    expect(done).toHaveBeenCalledOnce()
  })

  it('확인 중에 대화를 끝내면 늦은 결과가 새 요청을 만들지 않는다', async () => {
    const t = setup()
    await lost(t)
    t.controller.submit(second)
    t.controller.end()
    t.requests[1].resolve(t.reply('늦은 답', { nextTurnIndex: 2 }))
    await t.flush()
    expect(t.requests).toHaveLength(2)
    expect(t.texts).not.toContain('늦은 답')
  })

  it('정상 응답(서버의 DEMO 대체 포함) 뒤에는 같은 turn을 다시 보내지 않는다', async () => {
    const t = setup()
    t.ready()
    t.controller.submit(first)
    t.requests[0].resolve(t.reply('DEMO 대체 답', { nextTurnIndex: 2 }))
    await t.flush()
    t.spoken.at(-1)!.onEnd()
    expect(t.controller.hasUnresolvedTurn).toBe(false)
    t.controller.submit(second)
    expect(t.requests[1].request).toMatchObject({ index: 2, requestId: 'request-2' })
  })
})
