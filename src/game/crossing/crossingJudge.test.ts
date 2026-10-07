import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityItem, ActivityResponse, ActivityRound, ActivityStart } from '../../api/activities'
import type { Acoustic } from '../../shared/types'
import type { CrossingResult } from './crossingFlow'

vi.mock('../../api/activities', () => ({ startActivity: vi.fn(), sendActivityUtterance: vi.fn(), nextCrossingLap: vi.fn() }))
vi.mock('../../api/client', () => ({ api: vi.fn(async () => ({})) }))

import { nextCrossingLap, sendActivityUtterance, startActivity } from '../../api/activities'
import { api } from '../../api/client'
import { previewJudge, serverJudge } from './crossingJudge'

/*
 * Codex 계약(src/api/daeguCrossing.ts, 10줄 = 5라운드 × 2줄)을 흉내 낸 가짜 서버.
 * 응답의 진행 번호는 '다음 항목' 기준이고, 끝나면 5/2/10에 머문다. 시도 번호는 서버가 정한다.
 */
const PLAN = [['사', '사'], ['사', '사'], ['소', '시'], ['사과', '수박'], ['수', '시소']]
const round = (index: number): ActivityRound => ({ index, id: `r${index}`, childTitle: `라운드 ${index}`, childPrompt: '', targetMs: 0, attempts: 3, elicitationType: 'imitation' })
const item = (stripe: number): ActivityItem => {
  const text = PLAN[Math.ceil(stripe / 2) - 1][(stripe - 1) % 2]
  return { itemId: `item-${stripe}`, displayText: text, level: text.length > 1 ? 'word' : 'syllable', game: 'daegu_crossing', pictureKey: '' }
}
const progress = (stripe: number, complete = false) => ({ roundIndex: Math.ceil(stripe / 2), itemIndexInRound: (stripe - 1) % 2 + 1, stripeIndex: stripe, triesLeft: complete ? 0 : 3, modelCue: !complete && stripe <= 2, sessionComplete: complete })

function fakeServer() {
  let stripe = 1, tries = 0, attempt = 1
  const sent: number[] = []
  vi.mocked(startActivity).mockResolvedValue({ sessionId: 's1', game: 'daegu_crossing', mode: 'demo', heroName: '바람용사', rounds: [1, 2, 3, 4, 5].map(round),
    currentRound: round(1), firstItem: item(1), nextAttemptIndex: attempt, leaseToken: 'lease-1', ...progress(1) } as ActivityStart)
  const reply = (result: CrossingResult) => vi.mocked(sendActivityUtterance).mockImplementationOnce(async (_session, _item, _round, attemptIndex) => {
    sent.push(attemptIndex)
    if (result === 'success') { stripe++; tries = 0 } else if (result === 'retry' && ++tries >= 3) { stripe++; tries = 0 }
    attempt += 2 // 클라이언트가 스스로 세지 않고 서버 번호를 쓰는지 보려고 일부러 건너뛴다.
    const complete = stripe > 10
    return { result, events: [], nextItem: complete ? null : item(stripe), nextAttemptIndex: attempt, currentRound: complete ? null : round(Math.ceil(stripe / 2)),
      ...progress(Math.min(stripe, 10), complete) } as ActivityResponse
  })
  return { reply, sent }
}

const acoustic = { source: 'mic', durationMs: 400, activeMs: 300 } as Acoustic

describe('대구대 건너기 서버 판정(Codex 계약)', () => {
  beforeEach(() => { vi.mocked(sendActivityUtterance).mockReset(); vi.mocked(api).mockClear() })

  it('치료사가 정한 박자(시작 응답의 선택 필드 rhythm)를 쓰고, 없으면 기본값(84BPM·빨라지기 허용)', async () => {
    fakeServer()
    expect((await serverJudge('demo').start()).rhythm).toEqual({ startBpm: 84, allowFaster: true })
    const base = await vi.mocked(startActivity)('daegu_crossing', 'demo')
    vi.mocked(startActivity).mockResolvedValueOnce({ ...base, rhythm: { startBpm: 76, allowFaster: false } } as ActivityStart)
    expect((await serverJudge('demo').start()).rhythm).toEqual({ startBpm: 76, allowFaster: false })
  })

  it('서버 결과와 다음 항목 번호를 그대로 따르고, 다시면 같은 줄에 머문다', async () => {
    const server = fakeServer()
    const judge = serverJudge('demo')
    const { first, heroName } = await judge.start()
    expect(first).toMatchObject({ text: '사', stripeIndex: 1, itemIndexInRound: 1, roundIndex: 1, modelCue: true })
    expect(heroName).toBe('바람용사')

    server.reply('success')
    const one = await judge.submit(first, { transcript: null, acoustic })
    expect(one).toMatchObject({ result: 'success', complete: false, next: { stripeIndex: 2, itemIndexInRound: 2, roundIndex: 1 } })

    server.reply('retry')
    const two = await judge.submit(one.next!, { transcript: null, acoustic })
    expect(two).toMatchObject({ result: 'retry', next: { stripeIndex: 2 } })

    server.reply('uncertain')
    const three = await judge.submit(two.next!, { transcript: null, acoustic })
    expect(three).toMatchObject({ result: 'uncertain', next: { stripeIndex: 2 } })
    expect(server.sent).toEqual([1, 3, 5])
  })

  it('10줄을 다 하면 끝나고, 마칠 때 활동 임대 토큰을 보낸다', async () => {
    const server = fakeServer()
    const judge = serverJudge('demo')
    let current = (await judge.start()).first
    const seen: string[] = []
    for (let i = 0; i < 10; i++) {
      seen.push(`${current.roundIndex}/${current.itemIndexInRound}/${current.stripeIndex}:${current.text}`)
      server.reply('success')
      const turn = await judge.submit(current, { transcript: null, acoustic })
      if (i < 9) { expect(turn.complete).toBe(false); current = turn.next! } else expect(turn).toMatchObject({ complete: true, next: null })
    }
    expect(seen).toEqual(['1/1/1:사', '1/2/2:사', '2/1/3:사', '2/2/4:사', '3/1/5:소', '3/2/6:시', '4/1/7:사과', '4/2/8:수박', '5/1/9:수', '5/2/10:시소'])
    await judge.finish(42)
    expect(api).toHaveBeenCalledWith('/play/sessions/s1/complete', expect.objectContaining({ method: 'POST', headers: { 'X-Activity-Lease': 'lease-1' } }))
  })

  it('한 판을 마친 뒤 다음 판은 같은 회기에서 서버가 준 첫 항목·시도 번호로 첫 줄부터 센다', async () => {
    const server = fakeServer()
    const judge = serverJudge('demo')
    let current = (await judge.start()).first
    for (let i = 0; i < 10; i++) {
      server.reply('success')
      const turn = await judge.submit(current, { transcript: null, acoustic })
      if (turn.next) current = turn.next
    }
    vi.mocked(nextCrossingLap).mockResolvedValueOnce({ sessionId: 's1', game: 'daegu_crossing', mode: 'demo', heroName: '바람용사', rounds: [1, 2, 3, 4, 5].map(round),
      currentRound: round(1), firstItem: { ...item(1), itemId: 'lap2-1' }, nextAttemptIndex: 1, events: [], lap: 2, maxLaps: 3, ...progress(1) } as never)
    const { first } = await judge.nextLap()
    expect(nextCrossingLap).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1', leaseToken: 'lease-1' }))
    expect(first).toMatchObject({ itemId: 'lap2-1', stripeIndex: 1, itemIndexInRound: 1, roundIndex: 1, modelCue: true })
    // 다음 판의 첫 발화는 새 항목과 서버가 준 시도 번호(1)로 보낸다.
    vi.mocked(sendActivityUtterance).mockResolvedValueOnce({ result: 'success', events: [], nextItem: item(2), nextAttemptIndex: 1, currentRound: round(1), ...progress(2) } as ActivityResponse)
    const turn = await judge.submit(first, { transcript: null, acoustic })
    expect(vi.mocked(sendActivityUtterance).mock.lastCall?.slice(1, 4)).toEqual([expect.objectContaining({ itemId: 'lap2-1' }), 1, 1])
    expect(turn.next).toMatchObject({ stripeIndex: 2 })
  })

  it('미리보기 판정도 다음 판에서 첫 줄부터 다시 센다', async () => {
    const judge = previewJudge()
    const { first } = await judge.start()
    const again = await judge.nextLap()
    expect(again.first).toEqual(first)
  })
})
