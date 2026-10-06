import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentProps } from 'react'
import { CrossingAnalyticsView } from './CrossingAnalyticsPanel'
import CrossingRationalePanel from './CrossingRationalePanel'
import { crossingData, crossingSession } from './testFixtures'

type ViewProps = ComponentProps<typeof CrossingAnalyticsView>
const goal = { level: 'syllable', excluded_words: [], preferred_cue: 'auditory_model' }
const render = (over: Partial<ViewProps> = {}) => renderToStaticMarkup(<MemoryRouter><CrossingAnalyticsView
  data={crossingData([])} goal={goal} selectedId={null} onSelect={() => undefined}
  proposal={{ state: 'idle' }} onLoadProposal={() => undefined} {...over} /></MemoryRouter>)

const mixed = crossingData([
  crossingSession({ sessionId: 'r1', startedAt: '2026-10-01T01:00:00', confirmedRate: .6, confirmedSuccessN: 6, reviewedN: 10 }),
  crossingSession({ sessionId: 'sample', startedAt: '2026-10-02T01:00:00', source: 'SAMPLE', reviewedN: 0, confirmedSuccessN: 0, confirmedRate: null }),
  crossingSession({ sessionId: 'r2', startedAt: '2026-10-03T01:00:00', confirmedRate: .85, rhythm: { startBpm: 76, allowFaster: false } }),
  crossingSession({ sessionId: 'r3', startedAt: '2026-10-04T01:00:00', confirmedRate: .9 }),
])

describe('대구대 건너기 분석 화면', () => {
  it('확인 비율 추이·숙달선·자동 추정·박자를 SVG로 그리고 같은 수치를 글로도 준다', () => {
    const html = render({ data: mixed })
    expect(html.match(/role="img"/g)).toHaveLength(3)
    expect(html).toContain('숙달선 80%')
    expect(html).toContain('실제 회기 3개의 확인 비율: 10.1 60%, 10.3 85%, 10.4 90%')
    expect(html).toContain('샘플 제외')
    expect(html).toContain('DEMO·샘플 1회는 비교 제외')
    expect(html).toContain('최근 실제 3회기 각 80% 이상 · 60% → 85% → 90%')
    expect(html).toContain('회기 간 변화는 치료 효과의 증명이 아닙니다')
  })

  it('단계 × 위치 표는 최근 실제 회기의 확인 기록만 쓰고, 다루지 않는 위치는 비워 두지 않고 알린다', () => {
    const html = render({ data: mixed })
    expect(html).toContain('최근 실제 3회기 · 치료사 확인 기록')
    expect(html.match(/75%<\/strong> <span class="small">9\/12<\/span>/g)).toHaveLength(2)
    expect(html.match(/다루지 않음/g)).toHaveLength(4)
    expect(html).toContain('음절<span class="small"> · 현재 목표</span>')
  })

  it('오류 유형은 자동 추정 의심으로 보이고 고른 회기의 치료사 확인 수를 같이 보인다', () => {
    const html = render({ data: mixed })
    expect(html).toContain('파열음화·생략 의심')
    expect(html).toContain('파찰음화 의심')
    expect(html).toContain('판단 보류')
    expect(html).toContain('치료사 확인</strong> 8건 중 성공 6건(90%)')
    expect(html.match(/<option /g)).toHaveLength(4)
    const sample = render({ data: mixed, selectedId: 'sample' })
    expect(sample).toContain('샘플·시연 회기라 확인 비율과 숙달 계산에서 뺍니다')
    expect(sample).toContain('자료: 샘플·시연')
  })

  it('기록이 없으면 빈 상태를 알리고 전문 정보와 집계 규칙은 그대로 보인다', () => {
    const html = render()
    expect(html).toContain('대구대 건너기 기록이 아직 없습니다')
    expect(html).not.toContain('role="img"')
    expect(html).toContain('6;0~6;11세')
    expect(html).toContain('집계 규칙과 해석 한계(서버)')
  })

  it('숙달 표시는 서버 값만 따른다', () => {
    expect(render({ data: { ...mixed, mastery: { ...mixed.mastery, met: true } } })).toContain('기준 충족')
    expect(render({ data: mixed })).toContain('아직 아님')
  })

  it('다음 회기 제안은 누를 때 서버에서 불러오고, 자료 부족이면 그렇게 알린다', () => {
    expect(render({ data: mixed })).toContain('서버 제안 불러오기')
    const ready = render({ data: mixed, proposal: { state: 'ready', suggestion: '현재 목표 단계를 유지하는 구성을 제안합니다.', reasons: ['현재 목표 단계를 유지하는 구성을 제안합니다.', '녹음 환경 확인을 권합니다.'], insufficient: true } })
    expect(ready).toContain('서버 제안:</strong> 현재 목표 단계를 유지하는 구성을 제안합니다.')
    expect(ready).toContain('<li>녹음 환경 확인을 권합니다.</li>')
    expect(ready).toContain('자료가 부족합니다')
    expect(ready).toContain('P(계획): 서버 제안: 현재 목표 단계를 유지하는 구성을 제안합니다.')
    expect(render({ data: mixed, proposal: { state: 'error' } })).toContain('role="alert"')
  })

  it('전문 정보: 출처가 있는 발달 시기, 오류와 자동 추정, 단서 종류(순위 아님)와 게임의 단서 줄이기, 복사할 초안', () => {
    const html = render({ data: mixed })
    expect(html).toContain('href="https://www.e-csd.org/journal/view.php?doi=10.12963%2Fcsd.19609"')
    expect(html).toContain('치간음화·측음화')
    expect(html).toContain('소리 들려주기<span class="small"> · 현재 목표</span>')
    expect(html).toContain('1라운드 두두 따라 건너기')
    expect(html).toContain('가정 연습 안내(초안)')
    expect(html).toContain('회기 기록(SOAP) 초안')
  })
})

describe('대구대 건너기 설계 근거 패널', () => {
  it('왜 /ㅅ/·누구에게·무슨 연습인지와 판정 한계를 근거 데이터 그대로 보인다', () => {
    const html = renderToStaticMarkup(<CrossingRationalePanel level="syllable" />)
    expect(html).toContain('/ㅅ/(치조 마찰음, 예사소리)')
    expect(html).toContain('만 4~7세 기능적 조음음운장애 아동')
    expect(html).toContain('말더듬 아동')
    expect(html.match(/<li><p class="cr-round-title">/g)).toHaveLength(5)
    expect(html).toContain('<span>사 · 사</span>')
    expect(html).toContain('치간음화·측음화')
    expect(html).toContain('href="#crossing-settings"')
  })

  it('목표가 낱말 단계면 라운드 낱말도 낱말 단계로 보인다', () => {
    const html = renderToStaticMarkup(<CrossingRationalePanel level="word" />)
    expect(html).toContain('5라운드(낱말 단계)')
    expect(html).toContain('<span>사과 · 사과</span>')
  })
})
