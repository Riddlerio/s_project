import { api } from './client'
import type { Progress } from '../shared/types'

export const login = (username: string, password: string) => api<{ token: string; therapist: { id: string; displayName: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
export const overview = (token: string) => api<any>('/dashboard/overview', {}, token)
export const childDetail = (id: string, token: string) => api<any>(`/children/${id}`, {}, token)
export const progress = (id: string, token: string) => api<Progress>(`/children/${id}/progress`, {}, token)
export const sessionDetail = (id: string, token: string) => api<any>(`/sessions/${id}`, {}, token)
export const saveGoal = (id: string, goal: Record<string, unknown>, token: string) => api<any>(`/children/${id}/goals`, { method: 'POST', body: JSON.stringify(goal) }, token)
export const decision = (id: string, body: Record<string, unknown>, token: string) => api<any>(`/recommendations/${id}/decision`, { method: 'POST', body: JSON.stringify(body) }, token)
export const feedback = (id: string, body: Record<string, unknown>, token: string) => api<any>(`/utterances/${id}/feedback`, { method: 'POST', body: JSON.stringify(body) }, token)
