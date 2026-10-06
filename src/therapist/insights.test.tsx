import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ObservationEvidence, RoundTimeline } from './ClinicalTimeline'
import GoalTrendChart, { GoalChart } from './charts/GoalTrendChart'
import { cueText, insightRate } from './insights'
import type { InsightObservation, InsightStats } from './insights'
import SessionNote from './SessionNote'

const stats: InsightStats = { observedN: 3, evaluableN: 2, successN: 1, excludedN: 1, successRate: 50, cueCounts: { VISUAL: 2 } }
const observation: InsightObservation = {
  id: 'o1', sessionId: 's1', roundIndex: 1, attemptNumber: 1, targetText: '사과', targetPhoneme: 'ㅅ', wordPosition: 'initial',
  level: 'word', activity: 'monster_adventure', cue: 'VISUAL', independence: 'INDEPENDENT', durationMs: 900,
  audioQuality: 'GOOD', aiResult: 'retry', result: 'success', source: 'REAL', verification: 'CORRECTED', provenance: 'THERAPIST',
  measurementSource: 'CLIENT_REPORTED', qualityFlags: [], excludedReasons: [], included: true, reviewNote: '직접 확인', acoustic: {},
}

describe('치료사 읽기 화면', () => {
  it('5개 띠, 시도당 버튼 하나, 모양별 출처와 키보드 선택 동작을 제공한다', () => {
    const html = renderToStaticMarkup(<RoundTimeline rows={[observation, { ...observation, id: 'o2', roundIndex: 2, provenance: 'AI' }, { ...observation, id: 'o3', roundIndex: 5, provenance: 'SYSTEM' }]} selectedId="o1" onSelect={() => {}} />)
    expect(html.match(/class="round-band"/g)).toHaveLength(5)
    expect(html.match(/aria-controls="selected-observation"/g)).toHaveLength(3)
    expect(html).toContain('aria-pressed="true"')
    for (const kind of ['SYSTEM', 'AI', 'THERAPIST']) expect(html).toContain(`data-provenance="${kind}"`)
    expect(html).toContain('Tab 키와 Enter')
    // 접근성 이름은 버튼에 보이는 번호로 시작한다(WCAG 2.5.3 보이는 글자가 이름에 포함, axe label-content-name-mismatch).
    for (const [, label, visible] of html.matchAll(/aria-label="([^"]*)"[^>]*>(?:<svg[\s\S]*?<\/svg>)<span>(\d+)<\/span>/g)) expect(label.startsWith(`${visible} · `), label).toBe(true)
    expect(html.match(/aria-label="\d+ · \d라운드 관찰/g)).toHaveLength(3)
  })

  it('원 AI 결과와 치료사 결과를 구분하고 품질 제외를 실패라고 하지 않는다', () => {
    const html = renderToStaticMarkup(<ObservationEvidence row={{ ...observation, result: 'uncertain', included: false, qualityFlags: ['UNCERTAIN', 'POOR', 'LOW_SNR'], excludedReasons: ['NOT_EVALUABLE', 'POOR'] }} />)
    expect(html).toContain('자동 추정: 재시도')
    expect(html).toContain('현재 검토 결과: 불확실')
    expect(html).toContain('성공률 분모 제외')
    expect(html).toContain('제외는 실패가 아닙니다')
    expect(html).toContain('잡음 대비 신호 부족')
    expect(html).not.toContain('<audio')
  })

  it('샘플과 DEMO를 임상 비교에 합치지 않는다', () => {
    const html = renderToStaticMarkup(<MemoryRouter><GoalTrendChart data={{ groups: [], sources: [{ source: 'REAL', sessionN: 0, observationN: 0 }, { source: 'DEMO', sessionN: 2, observationN: 4 }, { source: 'SAMPLE', sessionN: 3, observationN: 6 }], limitations: [], baselineRule: '첫 평가 가능 회기' }} /></MemoryRouter>)
    expect(html).toContain('실제 기준선으로 사용하지 않습니다')
    expect(html).toContain('2회기 · 관찰 4건')
    expect(html).toContain('3회기 · 관찰 6건')
    expect(html).not.toContain('<svg')
  })

  it('SVG와 대체 표에 같은 서버 수치·단서를 쓰고 null은 0%로 그리지 않는다', () => {
    const html = renderToStaticMarkup(<MemoryRouter><GoalChart group={{ targetPhoneme: 'ㅅ', wordPosition: 'initial', level: 'word', activity: 'monster_adventure', baseline: { ...stats, sessionId: 's1', startedAt: '2026-10-01' }, recent: [{ ...stats, sessionId: 's2', startedAt: '2026-10-02', successRate: null, evaluableN: 0, cueCounts: {} }], recentSummary: stats, delta: null }} /></MemoryRouter>)
    expect(html).toContain('role="img"')
    expect(html).toContain('50% (1/2건)')
    expect(html).toContain('시각 단서 2건')
    expect(html.match(/<circle/g)).toHaveLength(1)
    expect(html).toContain('자료 없음')
    expect(cueText({})).toBe('자료 없음')
    expect(insightRate({ ...stats, successRate: null })).toBe('자료 없음')
  })

  it('노트는 전달받은 서버 문장을 그대로 보여 주고 원음·LLM을 추가하지 않는다', () => {
    const html = renderToStaticMarkup(<SessionNote text="관찰 3건. 평가 가능 2건. 분모 제외 1건." />)
    expect(html).toContain('관찰 3건. 평가 가능 2건. 분모 제외 1건.')
    expect(html).toContain('readonly')
    expect(html).toContain('LLM을 사용하지 않습니다')
    expect(html).toContain('세션 노트 복사')
  })
})
