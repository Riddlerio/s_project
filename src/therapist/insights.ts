export type EvidenceSource = 'REAL' | 'DEMO' | 'SAMPLE'
export type Provenance = 'SYSTEM' | 'AI' | 'THERAPIST'
export interface InsightStats {
  observedN: number; evaluableN: number; successN: number; excludedN: number
  successRate: number | null; cueCounts: Record<string, number>
}
export interface InsightObservation {
  id: string; sessionId: string; roundIndex: number; attemptNumber: number; targetText: string
  targetPhoneme: string; wordPosition: string; level: string; activity: string; cue: string; independence: string
  durationMs: number | null; audioQuality: string; aiResult: string; result: string; source: EvidenceSource
  verification: string; provenance: Provenance; measurementSource: string; qualityFlags: string[]
  excludedReasons: string[]; included: boolean; reviewNote: string; acoustic: Record<string, number>
}
export interface SessionInsights {
  sessionId: string; source: EvidenceSource; observations: InsightObservation[]
  rounds: (InsightStats & { roundIndex: number })[]; summary: InsightStats; note: string; limitations: string[]
}
export interface TrendPoint extends InsightStats { sessionId: string; startedAt: string }
export interface GoalTrend {
  targetPhoneme: string; wordPosition: string; level: string; activity: string
  baseline: TrendPoint | null; recent: TrendPoint[]; recentSummary: InsightStats; delta: number | null
}
export interface GoalTrends {
  groups: GoalTrend[]; sources: { source: EvidenceSource; sessionN: number; observationN: number }[]
  limitations: string[]; baselineRule: string
}
export const SOURCE_LABELS: Record<EvidenceSource, string> = { REAL: '실제', DEMO: 'DEMO', SAMPLE: '샘플' }
export const PROVENANCE_LABELS: Record<Provenance, string> = { SYSTEM: '시스템 측정', AI: 'AI 추정', THERAPIST: '치료사 확인·교정' }
export const RESULT_LABELS: Record<string, string> = { success: '성공', retry: '재시도', uncertain: '불확실', no_speech: '발화 없음', target_observed: '목표 관찰(정오 판정 아님)' }
export const FLAG_LABELS: Record<string, string> = {
  NO_SPEECH: 'NO_SPEECH · 발화 없음', UNCERTAIN: 'UNCERTAIN · 불확실', POOR: 'POOR · 음질 불량',
  LOW_SNR: '잡음 대비 신호 부족', NOISY_FLOOR: '주변 잡음', CLIPPING: '클리핑',
  TOO_SHORT: '너무 짧은 녹음', TOO_LONG: '너무 긴 녹음', INVALID_ACOUSTIC: '유효하지 않은 음향 자료',
  NO_NOISE_FLOOR: '잡음 기준 미측정', TARGET_OBSERVED: '목표 관찰',
  PENDING: '검토 대기', REJECTED: '치료사 거부', NOT_EVALUABLE: '정오 평가 보류', DEMO: 'DEMO', SAMPLE: '샘플',
}
export const CUE_NAMES: Record<string, string> = { NONE: '단서 없음', VISUAL: '시각 단서', AUDITORY: '청각 단서', MODEL: '모델 제시', COMBINED: '복합 단서', UNKNOWN: '단서 미기록' }
export const cueText = (counts: Record<string, number>) => Object.entries(counts).map(([cue, count]) => `${CUE_NAMES[cue] || cue} ${count}건`).join(' · ') || '자료 없음'
export const insightRate = (stats: InsightStats) => stats.successRate === null ? '자료 없음' : `${stats.successRate}% (${stats.successN}/${stats.evaluableN}건)`
