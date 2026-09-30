/** 치료사 회기 계획 타입과 순수 함수. 계약은 docs/therapist-workflow.md 6절이다. */

export type StartLevel = 'phoneme' | 'syllable' | 'word' | 'short_sentence'
export type TargetLevel = 'syllable' | 'word' | 'short_sentence'
export type StepType = 'CONVERSATION' | 'GAME' | 'PRACTICE'
export type Activity = 'hoya_conversation' | 'magic_beam' | 'sky_climb' | 'monster_adventure' | 'conversation_quest'
export type PlanStatus = 'DRAFT' | 'APPROVED' | 'SUPERSEDED' | 'CANCELLED'

export interface PlanStep { stepType: StepType; activity: Activity; targetLevel?: StartLevel | null; parameters?: { trials?: number; durationMin?: number } }

export interface PlanForm {
  targetPhoneme: 'ㅅ' | 'ㅈ' | 'ㄹ'; wordPosition: 'initial' | 'medial' | 'final'
  startLevel: StartLevel; targetLevel: TargetLevel; durationMin: 5 | 10 | 15; repetitionTarget: number
  preferredCue: 'none' | 'visual_mouth' | 'auditory_model' | 'tactile_description'
  priorityTargets: string[]; excludedWords: string[]; conversationTheme: string; therapistNote: string; steps: PlanStep[]
}

export interface SessionPlan extends PlanForm {
  id: string; childId: string; goalId: string; goalVersion: number | null; parentPlanId: string | null; revision: number
  status: PlanStatus; createdAt: string; updatedAt: string; approvedAt: string | null; cancelledAt: string | null
  evidenceSnapshot: Record<string, unknown>; recommendationSnapshot: Record<string, unknown>
}

export interface LevelStats { level: string; verifiedN: number; evaluableN: number; successN: number; retryN: number; successRate: number | null; uncertainN: number; noSpeechN: number; targetObservedN: number }

export interface Metrics extends Omit<LevelStats, 'level'> {
  window: { realSessionN: number; maxSessions: number }; totalObservedN: number; poorAudioN: number
  pendingReviewN: number; rejectedN: number; retryRate: number | null; byLevel: LevelStats[]
  cueCounts: Record<string, number>; independenceCounts: Record<string, number>
  trend: { sessionId: string; startedAt: string | null; activity: string | null; evaluableN: number; successRate: number | null }[]
  sufficient: boolean
}

export interface GoalView { goalId: string; version: number; targetPhoneme: string; wordPosition: string; level: string; minLevel: string; sessionDurationMin: number; repetitionTarget: number; preferredCue: string; priorityTargets: string[]; excludedWords: string[] }

export interface PlanningContext {
  child: { childCode: string; alias: string; ageBand: string }; currentGoal: GoalView; metrics: Metrics
  evidenceAvailability: { verifiedN: number; pendingReviewN: number; demoExcludedN: number; rejectedN: number; sufficient: boolean }
  recentRealSessions: Metrics['trend']; latestPlan: { id: string; status: PlanStatus; revision: number } | null
}

export interface Summary { observationSummary: string; evidencePoints: string[]; nextSessionSuggestion: string; limitations: string[]; source: 'LLM' | 'TEMPLATE' }

export interface ProposalResponse {
  status: 'READY' | 'INSUFFICIENT_DATA'; summary: Summary; metrics: Metrics; goal: GoalView
  proposal: { status: string; form: PlanForm; rationale: { code: string; text: string }[]; activityHint: string | null }
}

export const LEVEL_LABELS: Record<string, string> = { phoneme: '음소', syllable: '음절', word: '단어', short_sentence: '짧은 문장', spontaneous: '자발 발화', unknown: '단계 미상' }
export const POSITION_LABELS: Record<string, string> = { initial: '어두', medial: '어중', final: '어말' }
export const CUE_LABELS: Record<string, string> = { none: '단서 없음', visual_mouth: '입 모양 보기', auditory_model: '소리 들려주기', tactile_description: '촉각 설명' }
export const ACTIVITY_LABELS: Record<Activity, string> = { hoya_conversation: '호야와 대화', magic_beam: '빛의 마법', sky_climb: '하늘 오르기', monster_adventure: '몬스터 모험', conversation_quest: '호야와 소풍' }
export const STEP_LABELS: Record<StepType, string> = { CONVERSATION: '대화', GAME: '게임', PRACTICE: '연습' }
export const STATUS_LABELS: Record<PlanStatus, string> = { DRAFT: '초안', APPROVED: '승인됨', SUPERSEDED: '새 계획으로 대체됨', CANCELLED: '취소됨' }
export const START_LEVELS: StartLevel[] = ['phoneme', 'syllable', 'word', 'short_sentence']
export const TARGET_LEVELS: TargetLevel[] = ['syllable', 'word', 'short_sentence']
export const STEP_ACTIVITIES: Record<StepType, Activity[]> = {
  CONVERSATION: ['hoya_conversation'],
  GAME: ['magic_beam', 'sky_climb', 'monster_adventure', 'conversation_quest'],
  PRACTICE: ['magic_beam', 'sky_climb', 'monster_adventure', 'conversation_quest'],
}

const FORM_KEYS: (keyof PlanForm)[] = ['targetPhoneme', 'wordPosition', 'startLevel', 'targetLevel', 'durationMin', 'repetitionTarget', 'preferredCue', 'priorityTargets', 'excludedWords', 'conversationTheme', 'therapistNote', 'steps']

/** 저장된 계획이나 제안에서 form 값만 꺼낸다. step의 id·순서는 서버가 정한다. */
export function toForm(source: PlanForm): PlanForm {
  const form = Object.fromEntries(FORM_KEYS.map(key => [key, source[key]])) as unknown as PlanForm
  return { ...form, priorityTargets: [...form.priorityTargets], excludedWords: [...form.excludedWords],
    steps: form.steps.map(step => ({ stepType: step.stepType, activity: step.activity, targetLevel: step.targetLevel ?? null, parameters: { ...(step.parameters || {}) } })) }
}

export const isEditable = (plan: Pick<SessionPlan, 'status'> | null | undefined) => !plan || plan.status === 'DRAFT'

export const parseWords = (text: string) => [...new Set(text.split(',').map(word => word.trim()).filter(Boolean))]

/** 서버 검증과 같은 규칙을 먼저 보여 준다. 최종 검증은 서버가 한다. */
export function validateForm(form: PlanForm): string[] {
  const errors: string[] = []
  if (START_LEVELS.indexOf(form.startLevel) > START_LEVELS.indexOf(form.targetLevel)) errors.push('시작 단계가 목표 단계보다 높습니다.')
  if (form.repetitionTarget < 10 || form.repetitionTarget > 60) errors.push('목표 시도 횟수는 10–60회입니다.')
  if (!form.steps.length || form.steps.length > 8) errors.push('활동은 1–8개입니다.')
  if (form.steps.some(step => !STEP_ACTIVITIES[step.stepType].includes(step.activity))) errors.push('활동 유형과 활동이 맞지 않습니다.')
  if (form.steps.some(step => step.targetLevel && START_LEVELS.indexOf(step.targetLevel) > START_LEVELS.indexOf(form.targetLevel))) errors.push('활동 단계가 목표 단계보다 높습니다.')
  if (form.priorityTargets.some(word => form.excludedWords.includes(word))) errors.push('우선 단어와 제외 단어가 겹칩니다.')
  if ([...form.priorityTargets, ...form.excludedWords].some(word => word.length > 20)) errors.push('단어는 20자 이하입니다.')
  if (form.priorityTargets.length > 20 || form.excludedWords.length > 20) errors.push('단어 목록은 20개 이하입니다.')
  if (form.conversationTheme.length > 100) errors.push('대화 주제는 100자 이하입니다.')
  if (form.therapistNote.length > 500) errors.push('치료사 메모는 500자 이하입니다.')
  return errors
}

/** 편집할 계획: 초안이 있으면 가장 최근 초안. 없으면 null(제안에서 새로 만든다). */
export const currentDraft = (plans: SessionPlan[]) => plans.find(plan => plan.status === 'DRAFT') || null
export const approvedPlan = (plans: SessionPlan[]) => plans.find(plan => plan.status === 'APPROVED') || null
