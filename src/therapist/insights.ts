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
  automaticEvidence?: string[]
}
export interface CrossingSummary {
  attemptN: number; autoSuccessN: number; deferredN: number; confirmedN: number; reviewTotalN: number
  rhythm: { startBpm: number; allowFaster: boolean } | null
  /** 같은 회기에서 끝까지 건넌 판 수(판 반복, 2026-10-07). 이전 서버 응답에는 없다. */
  lapN?: number
}
export interface SessionInsights {
  sessionId: string; source: EvidenceSource; observations: InsightObservation[]
  rounds: (InsightStats & { roundIndex: number })[]; summary: InsightStats; note: string; limitations: string[]
  crossingSummary?: CrossingSummary
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
// 'AI' 출처는 학습 모델이 아니라 규칙·기준값으로 자동 추정한 결과다(감사: PRODUCT_REALITY_MATRIX 3절). 화면에는 '자동 추정'으로 보인다.
export const PROVENANCE_LABELS: Record<Provenance, string> = { SYSTEM: '시스템 측정', AI: '자동 추정', THERAPIST: '치료사 확인·교정' }
/** 활동별 자동 추정 방식. 관찰 카드에 한 줄로 보여 무엇으로 판단했는지 알린다(games/rounds.py의 규칙). */
export const JUDGMENT_METHODS: Record<string, string> = {
  magic_beam: '음향 근사 — 마찰음(바람 소리)의 길이·이어짐·끊어 내기',
  sky_climb: '음향 근사 — 소리를 낸 길이·크기 범위·쉬었다 다시 내기',
  daegu_crossing: '음향 근사 — 시작 마찰음과 그 뒤 유성 구간',
  monster_adventure: '음성 인식 근사 — 브라우저가 인식한 문장을 목표 낱말과 맞춤(인식 오류·자동 보정 가능)',
  conversation_quest: '음성 인식 근사 — 인식 문장에 목표 소리가 들어갔는지(시도 여부이며 발음 정확도 아님)',
  hoya_conversation: '음성 인식 근사 — 목표 낱말이 들어간 시도인지(발음 정확도 아님)',
}
export const RESULT_LABELS: Record<string, string> = { success: '성공', retry: '재시도', uncertain: '불확실', no_speech: '발화 없음', target_observed: '목표 관찰(정오 판정 아님)' }
export const FLAG_LABELS: Record<string, string> = {
  NO_SPEECH: 'NO_SPEECH · 발화 없음', UNCERTAIN: 'UNCERTAIN · 불확실', POOR: 'POOR · 음질 불량',
  LOW_SNR: '잡음 대비 신호 부족', NOISY_FLOOR: '주변 잡음', CLIPPING: '클리핑',
  TOO_SHORT: '너무 짧은 녹음', TOO_LONG: '너무 긴 녹음', INVALID_ACOUSTIC: '유효하지 않은 음향 자료',
  NO_NOISE_FLOOR: '잡음 기준 미측정', TARGET_OBSERVED: '목표 관찰',
  PENDING: '검토 대기', REJECTED: '치료사 거부', NOT_EVALUABLE: '정오 평가 보류', DEMO: 'DEMO', SAMPLE: '샘플',
}
export const INDEPENDENCE_LABELS: Record<string, string> = { MODELED: '시범 후', INDEPENDENT: '혼자', UNKNOWN: '미기록' }
export const QUALITY_LABELS: Record<string, string> = { GOOD: '좋음', FAIR: '보통', POOR: '나쁨', UNKNOWN: '미측정' }
export const MEASUREMENT_SOURCE_LABELS: Record<string, string> = { CLIENT_REPORTED: '아동 기기 측정값', SYSTEM_MEASURED: '서버 측정', UNKNOWN: '미상' }
export const CUE_NAMES: Record<string, string> = { NONE: '단서 없음', AUDITORY_MODEL: '소리 시범', PICTURE: '그림 단서', VISUAL: '시각 단서', AUDITORY: '청각 단서', MODEL: '모델 제시', COMBINED: '복합 단서', UNKNOWN: '단서 미기록' }
export const cueText = (counts: Record<string, number>) => Object.entries(counts).map(([cue, count]) => `${CUE_NAMES[cue] || cue} ${count}건`).join(' · ') || '자료 없음'
export const insightRate = (stats: InsightStats) => stats.successRate === null ? '자료 없음' : `${stats.successRate}% (${stats.successN}/${stats.evaluableN}건)`
