import { api } from './client'

export const getProfile = (code: string) => api<{ heroName: string; heroLevel: number; xp: number; badges: string[]; monsterCards: string[]; mapProgress: number; assignedActivity: string | null }>(`/play/children/${code}/profile`)
