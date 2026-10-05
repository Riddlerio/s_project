import { api } from './client'
import type { GoalTrends, SessionInsights } from '../therapist/insights'
import type { PlanForm, PlanningContext, ProposalResponse, SessionPlan } from '../therapist/planning'

export const login = (username: string, password: string) => api<{ csrfToken: string; role: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
/** 서버가 DEMO 모드일 때만 샘플 계정 세션을 만든다. 비밀번호를 주고받지 않는다. */
export const demoLogin = (role: 'THERAPIST' | 'STUDENT') => api<{ csrfToken: string; role: string; username: string }>('/auth/demo-login', { method: 'POST', body: JSON.stringify({ role }) })
export const overview = (token: string) => api<any>('/dashboard/overview', {}, token)
export const childDetail = (id: string, token: string) => api<any>(`/children/${id}`, {}, token)
export const goalTrends = (id: string, token: string) => api<GoalTrends>(`/children/${id}/goal-trends`, {}, token)
export const sessionInsights = (id: string) => api<SessionInsights>(`/sessions/${id}/insights`)
export const sessionDetail = (id: string, token: string) => api<any>(`/sessions/${id}`, {}, token)
export const saveGoal = (id: string, goal: Record<string, unknown>, token: string) => api<any>(`/children/${id}/goals`, { method: 'POST', body: JSON.stringify(goal) }, token)
export const decision = (id: string, body: Record<string, unknown>, token: string) => api<any>(`/recommendations/${id}/decision`, { method: 'POST', body: JSON.stringify(body) }, token)
export const feedback = (id: string, body: Record<string, unknown>, token: string) => api<any>(`/utterances/${id}/feedback`, { method: 'POST', body: JSON.stringify(body) }, token)

// 회기 계획(docs/therapist-workflow.md 6절). 경로 이름은 계약에 고정되어 있다.
export const planningContext = (childId: string) => api<PlanningContext>(`/children/${childId}/planning-context`)
export const sessionPlanProposal = (childId: string) => api<ProposalResponse>(`/children/${childId}/session-plan-proposal`, { method: 'POST' })
export const sessionPlans = (childId: string) => api<SessionPlan[]>(`/children/${childId}/session-plans`)
export const createSessionPlan = (childId: string, form: PlanForm) => api<SessionPlan>(`/children/${childId}/session-plans`, { method: 'POST', body: JSON.stringify(form) })
export const updateSessionPlan = (planId: string, form: PlanForm) => api<SessionPlan>(`/session-plans/${planId}`, { method: 'PATCH', body: JSON.stringify(form) })
export const approveSessionPlan = (planId: string) => api<SessionPlan>(`/session-plans/${planId}/approve`, { method: 'POST' })
export const cancelSessionPlan = (planId: string) => api<SessionPlan>(`/session-plans/${planId}/cancel`, { method: 'POST' })
export const cloneSessionPlan = (planId: string) => api<SessionPlan>(`/session-plans/${planId}/clone`, { method: 'POST' })

export interface ConversationSessionInsight {
  sessionId: string; startedAt: string; status: string; source: 'REAL' | 'DEMO' | 'SAMPLE'
  completedTurnN: number; targetObservedN: number; uncertainN: number; noSpeechN: number
}
export interface ConversationInsightsData { sessions: ConversationSessionInsight[]; limitation: string }
export const childConversationInsights = (childId: string) =>
  api<ConversationInsightsData>(`/children/${childId}/conversation-insights`)
export const gameChildConversationInsights = (sessionId: string) =>
  api<ConversationInsightsData>(`/sessions/${sessionId}/conversation-insights`)
