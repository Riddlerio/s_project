import { describe, expect, it } from 'vitest'
import { INDEPENDENCE_LABELS, MEASUREMENT_SOURCE_LABELS, QUALITY_LABELS } from './insights'
import { evidenceBadges, rateText, recommendationBadges, sampleText, sessionSourceText, sessionStatusText, verificationText, type SummaryRow } from './clinicalLabels'

const row = (values: Partial<SummaryRow>): SummaryRow => ({
  roundIndex: 1, clinicalFocus: '', totalObservedN: 0, evaluableN: 0, demoN: 0, aiSupportedSuccesses: 0,
  uncertainN: 0, noSpeechN: 0, targetObservedN: 0, verifiedN: 0, verifiedEvaluatedN: 0, verifiedObservedN: 0,
  verifiedRate: null, limitedData: true, ...values,
})

describe('치료사 근거 표시', () => {
  it('DEMO 관찰 카드에는 실제 자료가 아니고 통계에서 빠진다고 표시한다', () => {
    expect(evidenceBadges({ is_demo: true })).toEqual(['DEMO', '실제 음성 자료 아님', '임상 검증 통계 제외'])
    expect(evidenceBadges({ is_demo: false })).toEqual([])
  })

  it('DEMO 검토 상태를 임상 검증으로 표시하지 않는다', () => {
    expect(verificationText('DEMO_CONFIRMED')).toBe('DEMO 검토: 확인 (임상 검증 아님)')
    expect(verificationText('CONFIRMED')).toBe('확인')
  })

  it('자료 없음은 0%가 아니고, 불확실만 있으면 평가 가능 표본은 0이다', () => {
    expect(sampleText(row({}))).toBe('자료 없음')
    expect(rateText(row({}))).toBe('자료 없음')
    expect(sampleText(row({ totalObservedN: 3, evaluableN: 0 }))).toBe('0 · 적은 자료 (전체 관찰 3)')
    expect(rateText(row({ verifiedRate: 50, verifiedEvaluatedN: 2 }))).toBe('50% (2건)')
  })
})

describe('회기·추천 출처 표시', () => {
  it('seed 아동의 회기는 실제 마이크를 써도 샘플이다', () => {
    expect(sessionSourceText({ mode: 'real', isSeed: true })).toBe('샘플')
    expect(sessionSourceText({ mode: 'demo', isSeed: true })).toBe('샘플')
    expect(sessionSourceText({ mode: 'real', isSeed: false })).toBe('실제')
    expect(sessionSourceText({ mode: 'demo', isSeed: false })).toBe('DEMO')
  })

  it('임상 근거가 아닌 회기에서 나온 legacy 추천에만 표시를 붙인다', () => {
    expect(recommendationBadges({ sessionMode: 'real', sessionIsSeed: false, clinicalEligible: true, demoPractice: false })).toEqual([])
    expect(recommendationBadges({ sessionMode: 'demo', sessionIsSeed: false, clinicalEligible: false, demoPractice: true })).toContain('DEMO 연습 기반')
    expect(recommendationBadges({ sessionMode: 'real', sessionIsSeed: true, clinicalEligible: false, demoPractice: false })).toContain('샘플 회기 기반')
    expect(recommendationBadges(undefined)).toEqual([])
  })


})

describe('회기 상태 이름표', () => {
  it('서버 상태 값을 한국어로 보인다', () => {
    expect(sessionStatusText('completed')).toBe('완료')
    expect(sessionStatusText('active')).toBe('진행 중')
    expect(sessionStatusText(undefined)).toBe('상태 미상')
  })
})

describe('관찰 카드 이름표', () => {
  it('독립성·음질·음향 출처를 영어 코드 대신 한국어로 보인다', () => {
    expect([INDEPENDENCE_LABELS.MODELED, INDEPENDENCE_LABELS.INDEPENDENT, INDEPENDENCE_LABELS.UNKNOWN]).toEqual(['시범 후', '혼자', '미기록'])
    expect(QUALITY_LABELS.UNKNOWN).toBe('미측정')
    expect(MEASUREMENT_SOURCE_LABELS.CLIENT_REPORTED).toBe('아동 기기 측정값')
  })
})
