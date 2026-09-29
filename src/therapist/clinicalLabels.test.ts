import { describe, expect, it } from 'vitest'
import { evidenceBadges, rateText, sampleText, verificationText, type SummaryRow } from './clinicalLabels'

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
