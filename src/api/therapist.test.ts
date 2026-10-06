import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './client'
import { childCrossingAnalytics, type CrossingAnalytics } from './therapist'

afterEach(() => vi.unstubAllGlobals())

describe('치료사 대구대 건너기 집계 API', () => {
  it('아동별 집계를 세션 쿠키로 조회하고 확인 기록 없는 비율을 null로 유지한다', async () => {
    const analytics: CrossingAnalytics = {
      sessions: [{
        sessionId: 'session-1', startedAt: '2026-10-06T01:00:00', source: 'REAL', rhythm: null,
        attemptN: 2, deferredN: 1, reviewedN: 0, confirmedSuccessN: 0, confirmedRate: null,
        byLevel: {}, autoReasons: { ok: 1, noFrication: 1, shortFrication: 0, noVowel: 0 },
      }],
      mastery: { threshold: 0.8, consecutiveSessions: 3, met: false },
      notes: ['회기 간 변화는 치료 효과를 증명하지 않습니다.'],
    }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(analytics), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('sessionStorage', { getItem: () => 'csrf-test' })

    expect(await childCrossingAnalytics('child-1')).toEqual(analytics)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/therapist/children/child-1/crossing-analytics')
    expect(request.method ?? 'GET').toBe('GET')
    expect(request.body).toBeUndefined()
    expect(request).toMatchObject({ credentials: 'same-origin', headers: { 'X-CSRF-Token': 'csrf-test' } })
  })

  it('다른 치료사의 아동에 대한 404를 화면이 구분할 수 있는 오류로 전달한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: '아동을 찾을 수 없습니다' }), { status: 404 })))
    vi.stubGlobal('sessionStorage', { getItem: () => null })

    const response = childCrossingAnalytics('other-child')
    await expect(response).rejects.toBeInstanceOf(ApiError)
    await expect(response).rejects.toMatchObject({ status: 404, message: '아동을 찾을 수 없습니다' })
  })
})
