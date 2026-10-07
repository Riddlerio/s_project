import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { CrossingSessionSummary, ObservationEvidence, RoundTimeline } from './ClinicalTimeline'
import type { InsightObservation } from './insights'
import { CrossingAnalyticsView } from './analytics/CrossingAnalyticsPanel'
import { childCrossingAnalyticsWithProbe, soapDraft } from './analytics/crossingAnalytics'
import type { CrossingAnalytics, CrossingSession } from './analytics/crossingAnalytics'
import { crossingData, crossingSession } from './analytics/testFixtures'
import TrendChart from './analytics/TrendChart'

const observation: InsightObservation = {
  id: 'practice', sessionId: 's1', roundIndex: 1, attemptNumber: 1, targetText: '사과',
  targetPhoneme: 'ㅅ', wordPosition: 'initial', level: 'word', activity: 'daegu_crossing', cue: 'NONE',
  independence: 'INDEPENDENT', durationMs: 700, audioQuality: 'GOOD', aiResult: 'success', result: 'success',
  source: 'REAL', verification: 'CONFIRMED', provenance: 'THERAPIST', measurementSource: 'CLIENT_REPORTED',
  qualityFlags: [], excludedReasons: [], included: true, reviewNote: '', acoustic: {},
}
const probe: InsightObservation = { ...observation, id: 'probe', roundIndex: 6, targetText: '수건', cue: 'PICTURE_PROMPT', isProbe: true }
const session = (over: Partial<CrossingSession> = {}): CrossingSession => crossingSession({
  confirmedRate: .5, confirmedSuccessN: 2, reviewedN: 4,
  probe: { reviewedN: 4, confirmedSuccessN: 3, confirmedRate: .75 }, ...over,
})
const view = (sessions: CrossingSession[]) => renderToStaticMarkup(<MemoryRouter><CrossingAnalyticsView
  data={crossingData(sessions)} goal={null} selectedId={null} onSelect={() => undefined}
  proposal={{ state: 'idle' }} onLoadProposal={() => undefined} /></MemoryRouter>)

afterEach(() => vi.unstubAllGlobals())

describe('새 낱말 확인 기록', () => {
  it('확인 낱말·발화 수를 연습 시도와 별도로 표시한다', () => {
    const html = renderToStaticMarkup(<CrossingSessionSummary summary={{
      attemptN: 18, autoSuccessN: 10, deferredN: 2, confirmedN: 8, reviewTotalN: 18,
      lapN: 1, rhythm: null, probeN: 4, probeAttemptN: 4,
    }} />)
    expect(html).toContain('<dt>연습 시도 수</dt><dd>18회</dd>')
    expect(html).toContain('<dt>새 낱말 확인</dt><dd>4개 · 발화 4회</dd>')
    expect(html).toContain('1~5라운드 집계에서 따로 셉니다')
  })

  it('확인 관찰을 6라운드나 기존 라운드에 섞지 않고 선택 가능한 별도 띠로 보여 준다', () => {
    const html = renderToStaticMarkup(<RoundTimeline rows={[observation, probe]} selectedId="probe" onSelect={() => undefined} />)
    expect(html.match(/class="round-band"/g)).toHaveLength(5)
    expect(html).not.toContain('6라운드')
    expect(html).toContain('aria-label="1 · 새 낱말 확인(피드백 없음) · 수건')
    expect(html.match(/aria-label="\d+ · \d라운드 관찰/g)).toHaveLength(1)
    expect(html).toContain('aria-pressed="true"')
    const sameRound = renderToStaticMarkup(<RoundTimeline rows={[observation, { ...probe, roundIndex: 1 }]} selectedId="probe" onSelect={() => undefined} />)
    expect(sameRound.match(/aria-label="\d+ · 1라운드 관찰/g)).toHaveLength(1)
  })

  it('관찰 제목·분모 안내에 피드백 없는 확인임을 표시하고 DEMO 제외 원칙을 유지한다', () => {
    const html = renderToStaticMarkup(<ObservationEvidence row={probe} />)
    expect(html).toContain('새 낱말 확인(피드백 없음)')
    expect(html).not.toContain('6라운드')
    expect(html).toContain('새 낱말 확인 비율의 분모에 포함')
    expect(html).toContain('단서 그림 단서')
    expect(html).not.toContain('PICTURE_PROMPT')
    const demo = renderToStaticMarkup(<ObservationEvidence row={{ ...probe, source: 'DEMO', included: false, excludedReasons: ['DEMO'] }} />)
    expect(demo).toContain('실제 음성 임상 자료가 아닙니다')
    expect(demo).toContain('새 낱말 확인 비율 분모 제외: DEMO')
    expect(demo).toContain('제외는 실패가 아닙니다')
  })
})

describe('연습과 새 낱말 확인 비율 비교', () => {
  it('서버의 서로 다른 비율을 별도 요약·표·그래프에 표시하고 해석 문구를 제공한다', () => {
    const html = view([session()])
    expect(html).toContain('<dt>최근 실제 회기 확인 비율(연습)</dt><dd><strong>50%</strong>')
    expect(html).toContain('<dt>새 낱말 확인 비율</dt><dd><strong>75%</strong>')
    expect(html).toContain('연습하지 않은 낱말로 일반화를 보는 값이며, 치료사가 확인한 기록만 셉니다')
    expect(html).toContain('<th scope="col">새 낱말 확인 비율</th>')
    expect(html).toContain('새 낱말 확인 비율: 10.1 75%')
    expect(html.match(/class="ca-probe-point"/g)).toHaveLength(1)
    expect(html).toContain('숙달선은 연습 비율에만 적용합니다')
    expect(html).toContain('음질 불량은 분모에서 뺍니다')
  })

  it.each(['DEMO', 'SAMPLE'] as const)('%s의 확인 값을 비율·그래프에 쓰지 않는다', source => {
    const html = view([session({ source, confirmedRate: .99, probe: { reviewedN: 4, confirmedSuccessN: 4, confirmedRate: .99 } })])
    expect(html).not.toContain('99%')
    expect(html).not.toContain('class="ca-probe-point"')
    expect(html).toContain('DEMO·샘플 1회는 비교 제외')
    const table = html.match(/<table class="ca-session-table">[\s\S]*?<\/table>/)?.[0]
    expect(table?.match(/비교 제외<\/span>/g)).toHaveLength(2)
  })

  it.each([undefined, { reviewedN: 0, confirmedSuccessN: 0, confirmedRate: null }])('과거·미확인 자료 %j를 0%%로 지어내지 않는다', metrics => {
    const html = view([session({ probe: metrics })])
    expect(html).toContain('<dt>새 낱말 확인 비율</dt><dd><strong>자료 없음</strong>')
    expect(html).not.toContain('class="ca-probe-point"')
    expect(html).toContain('확인 자료가 없으면 ‘자료 없음’')
  })

  it('실제로 확인한 실패 기록의 0%와 자료 없음을 구분한다', () => {
    const html = view([session({ probe: { reviewedN: 1, confirmedSuccessN: 0, confirmedRate: 0 } })])
    expect(html).toContain('<dt>새 낱말 확인 비율</dt><dd><strong>0%</strong>')
    expect(html).toContain('class="ca-probe-point"')
  })

  it('확인 자료 없는 실제 회기가 끼면 새 낱말 확인 추이의 연결선을 끊는다', () => {
    const sessions = [
      session({ sessionId: 'first' }),
      session({ sessionId: 'missing', probe: { reviewedN: 0, confirmedSuccessN: 0, confirmedRate: null } }),
      session({ sessionId: 'last' }),
    ]
    const html = renderToStaticMarkup(<TrendChart data={crossingData(sessions)} />)
    expect(html.match(/class="ca-probe-point"/g)).toHaveLength(2)
    expect(html).not.toContain('class="ca-probe-line"')
    const complete = renderToStaticMarkup(<TrendChart data={crossingData(sessions.map(row => session({ sessionId: row.sessionId })))} />)
    expect(complete.match(/class="ca-probe-line"/g)).toHaveLength(2)
  })

  it('치료사 내부 API 래퍼가 새 확인 값과 기존 값을 재계산 없이 받는다', async () => {
    const data: CrossingAnalytics = crossingData([session()])
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('sessionStorage', { getItem: () => null })
    expect(await childCrossingAnalyticsWithProbe('child')).toEqual(data)
    expect(fetcher.mock.calls[0][0]).toBe('/api/therapist/children/child/crossing-analytics')
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin' })
  })

  it('복사할 기록에도 연습과 피드백 없는 새 낱말 확인 수치를 구분한다', () => {
    const current = session()
    const draft = soapDraft(current, crossingData([current]), null)
    expect(draft).toContain('치료사 확인 4회 중 성공 2회(50%)')
    expect(draft).toContain('새 낱말 확인(피드백 없음): 치료사 확인 4회 중 성공 3회(75%), 연습 집계에서 제외')
    const demo = session({ source: 'DEMO' })
    expect(soapDraft(demo, crossingData([demo]), null)).toContain('새 낱말 확인(피드백 없음): DEMO·샘플 비교 제외')
  })
})
