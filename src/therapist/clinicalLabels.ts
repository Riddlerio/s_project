export type SummaryRow = {
  roundIndex: number; clinicalFocus: string; totalObservedN: number; evaluableN: number; demoN: number
  aiSupportedSuccesses: number; uncertainN: number; noSpeechN: number; targetObservedN: number
  verifiedN: number; verifiedEvaluatedN: number; verifiedObservedN: number; verifiedRate: number | null; limitedData: boolean
}

/** DEMO 관찰 카드에 붙는 표시. 실제 음성 관찰에는 표시가 없다. */
export function evidenceBadges(observation: { is_demo?: boolean }): string[] {
  return observation.is_demo ? ['DEMO', '실제 음성 자료 아님', '임상 검증 통계 제외'] : []
}

const STATE_TEXT: Record<string, string> = { PENDING: '검토 전', CONFIRMED: '확인', CORRECTED: '교정', REJECTED: '거부' }

export function verificationText(state: string): string {
  if (state.startsWith('DEMO_')) return `DEMO 검토: ${STATE_TEXT[state.slice(5)] || state} (임상 검증 아님)`
  return STATE_TEXT[state] || state
}

/** 평가 가능한 실제 표본 수. 불확실·무발화는 포함하지 않는다. 자료 없음은 0점이 아니다. */
export function sampleText(row: SummaryRow): string {
  if (row.totalObservedN === 0) return '자료 없음'
  return `${row.evaluableN}${row.limitedData ? ' · 적은 자료' : ''} (전체 관찰 ${row.totalObservedN})`
}

export function rateText(row: SummaryRow): string {
  return row.verifiedRate === null ? '자료 없음' : `${row.verifiedRate}% (${row.verifiedEvaluatedN}건)`
}
