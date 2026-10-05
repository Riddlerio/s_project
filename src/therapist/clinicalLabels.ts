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

/** 회기 출처. 입력 모드(mode)와 대상(isSeed)은 다른 축이다. seed 아동의 회기는 모드와 관계없이 샘플이다. */
export function sessionSourceText(session: { mode?: string; isSeed?: boolean }): '샘플' | '실제' | 'DEMO' {
  return session.isSeed ? '샘플' : session.mode === 'real' ? '실제' : 'DEMO'
}

/** 회기 진행 상태. 서버 값(active·completed)을 화면에 영어로 보이지 않게 한다. */
export function sessionStatusText(status?: string | null): string {
  return status === 'completed' ? '완료' : status === 'active' ? '진행 중' : '상태 미상'
}

export type RecommendationProvenance = { sessionMode: string | null; sessionIsSeed: boolean; clinicalEligible: boolean; demoPractice: boolean }

/** legacy 추천 카드의 출처 표시. 임상 근거 회기에서 나온 추천에는 표시가 없다. */
export function recommendationBadges(provenance?: RecommendationProvenance): string[] {
  if (!provenance || provenance.clinicalEligible) return []
  if (provenance.sessionIsSeed) return ['샘플 회기 기반', '임상 근거 아님']
  return ['DEMO 연습 기반', '임상 근거 아님']
}
