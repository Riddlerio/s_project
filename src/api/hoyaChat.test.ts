import { describe, expect, it } from 'vitest'
import { sendHoyaTurn } from './hoyaChat'
import { TurnRejectedError, type TurnRequest } from '../child/hoyaChatController'

const request: TurnRequest = { index: 3, requestId: 'b7b1b8f2-4d7e-4a41-9f2e-0c1f9a3e5d11',
  utterance: { transcript: '학교 갔어', alternatives: [], acoustic: {}, recognizer: 'demo_script' } }
const done = { status: 'COMPLETED', turnIndex: 3, clientRequestId: request.requestId, text: '학교 다녀왔구나!', nextTurnIndex: 4, sessionComplete: false }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** 순서대로 응답(또는 연결 오류)을 돌려주는 가짜 fetch. 보낸 본문을 기록한다. */
function fakeFetch(steps: (Response | Error)[]) {
  const bodies: Record<string, unknown>[] = []
  const fetcher = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    const step = steps.shift()
    if (!step) throw new Error('더 이상 응답 없음')
    if (step instanceof Error) throw step
    return step
  }) as unknown as typeof fetch
  return { fetcher, bodies }
}
const sleeps: number[] = []
const sleep = async (ms: number) => { sleeps.push(ms) }

describe('호야 turn 전송과 복구', () => {
  it('연결 오류 뒤에는 같은 요청 ID·번호·발화로 다시 묻고 저장된 답을 받는다', async () => {
    const { fetcher, bodies } = fakeFetch([new TypeError('Failed to fetch'), json(502, {}), json(200, done)])
    expect(await sendHoyaTurn('s1', request, { fetcher, sleep })).toEqual(done)
    expect(bodies).toHaveLength(3)
    for (const body of bodies) expect(body).toMatchObject({ turnIndex: 3, clientRequestId: request.requestId, transcript: '학교 갔어' })
  })

  it('서버가 처리 중(202)이면 제공자를 새로 부르지 않는 같은 요청으로 잠시 뒤 다시 묻는다', async () => {
    const processing = { status: 'PROCESSING', turnIndex: 3, clientRequestId: request.requestId, retryAfterMs: 500 }
    const { fetcher, bodies } = fakeFetch([json(202, processing), json(202, processing), json(200, done)])
    sleeps.length = 0
    expect(await sendHoyaTurn('s1', request, { fetcher, sleep })).toEqual(done)
    expect(sleeps).toEqual([500, 500])
    expect(new Set(bodies.map(body => body.clientRequestId))).toEqual(new Set([request.requestId]))
  })

  it('4xx 거절은 다시 보내지 않는다', async () => {
    const { fetcher, bodies } = fakeFetch([json(409, { detail: '대화 순서가 맞지 않습니다' })])
    await expect(sendHoyaTurn('s1', request, { fetcher, sleep })).rejects.toBeInstanceOf(TurnRejectedError)
    expect(bodies).toHaveLength(1)
  })

  it('끝없이 재시도하지 않는다', async () => {
    const { fetcher, bodies } = fakeFetch(Array.from({ length: 20 }, () => new TypeError('Failed to fetch')))
    await expect(sendHoyaTurn('s1', request, { fetcher, sleep, networkAttempts: 3 })).rejects.toThrow('HOYA_TURN_UNRESOLVED')
    expect(bodies).toHaveLength(4)
    const polling = fakeFetch(Array.from({ length: 20 }, () => json(202, { retryAfterMs: 500 })))
    await expect(sendHoyaTurn('s1', request, { fetcher: polling.fetcher, sleep, processingPolls: 5 })).rejects.toThrow('HOYA_TURN_UNRESOLVED')
    expect(polling.bodies).toHaveLength(6)
  })
})
