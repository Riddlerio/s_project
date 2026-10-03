import { api } from './client'
import type { ActivityStart } from './activities'
import type { GameKind } from '../control/speechGameSignal'

export type SkillEvidence = 'APP_OBSERVATION' | 'DIRECT_OBSERVATION'
export interface SkillDecision { evidenceKind: SkillEvidence; note: string }
export interface SkillHistory { action: 'GRANT' | 'REVOKE'; therapistName: string; at: string; evidenceKind: SkillEvidence; note: string }
export interface SkillStatus {
  skill: 'magic_beam'
  granted: boolean
  therapistName: string | null
  grantedAt: string | null
  evidenceKind: SkillEvidence | null
  note: string
  history: SkillHistory[]
}

export const getMagicBeamGrant = (childId: string) => api<SkillStatus>(`/children/${childId}/skills/magic_beam`)
export const decideMagicBeam = (childId: string, action: 'grant' | 'revoke', decision: SkillDecision) =>
  api<SkillStatus>(`/children/${childId}/skills/magic_beam/${action}`, { method: 'POST', body: JSON.stringify(decision) })

export interface AdventureInventory { inventory: { rice: number; tuna: number }; crafted: { tunaSushi: number } }
export interface ActiveActivity { sessionId: string; game: GameKind; mode: 'real' | 'demo'; roundIndex: number; completedRounds: number[]; paused: boolean }
export const getMyAdventure = () => api<AdventureInventory>('/me/adventure')
export const getActiveActivities = () => api<{ activities: ActiveActivity[] }>('/me/activities/active')
export const claimActivity = (sessionId: string, takeover = false, leaseToken?: string) =>
  api<ActivityStart>(`/activities/${sessionId}/claim`, { method: 'POST',
    ...(leaseToken ? { headers: { 'X-Activity-Lease': leaseToken } } : {}), body: JSON.stringify({ takeover }) })
export const heartbeatActivity = (session: ActivityStart) => api<{ ok: boolean }>(`/activities/${session.sessionId}/heartbeat`, {
  method: 'POST', headers: { 'X-Activity-Lease': session.leaseToken ?? '' } })
export const pauseActivity = (session: ActivityStart) => api<{ ok: boolean }>(`/activities/${session.sessionId}/pause`, {
  method: 'POST', headers: { 'X-Activity-Lease': session.leaseToken ?? '' }, keepalive: true })
export const craftTunaSushi = (requestId: string) => api<AdventureInventory>('/me/adventure/craft', {
  method: 'POST', body: JSON.stringify({ requestId, recipe: 'tuna_sushi' }) })
