import { api } from './client'
import type { Acoustic, PlayResponse, PlayStart } from '../shared/types'
import type { SessionMode } from '../shared/levels'

export const startPlay = (playCode: string, mode: SessionMode) => api<PlayStart>('/play/start', { method: 'POST', body: JSON.stringify({ playCode, mode }) })
export const sendUtterance = (session: PlayStart, itemId: string, attemptIndex: number, transcript: string | null, recognizer: string, acoustic: Acoustic, elapsedSec: number) => api<PlayResponse>(`/play/sessions/${session.sessionId}/utterances`, { method: 'POST', headers: { 'X-Play-Token': session.playToken }, body: JSON.stringify({ itemId, attemptIndex, transcript, recognizer, acoustic, elapsedSec }) })
export const completePlay = (session: PlayStart, elapsedSec: number) => api<{ totalXp: number; heroLevel: number; badges: string[]; monsterCards: string[]; newBadges: string[]; newMonsterCards: string[] }>(`/play/sessions/${session.sessionId}/complete`, { method: 'POST', headers: { 'X-Play-Token': session.playToken }, body: JSON.stringify({ elapsedSec }) })
export const getProfile = (code: string) => api<{ heroName: string; heroLevel: number; xp: number; badges: string[]; monsterCards: string[]; mapProgress: number }>(`/play/children/${code}/profile`)
