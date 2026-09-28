import { api } from './client'
import type { Acoustic } from '../shared/types'
import type { GameKind } from '../control/speechGameSignal'

export interface ActivityRound { index: number; id: string; childTitle: string; childPrompt: string; targetMs: number; attempts: number; elicitationType: string; difficulty?: number; itemSource?: string; endHoldMs?: number }
export interface ActivityItem { itemId: string; displayText: string; level: string; game: GameKind; pictureKey: string; beamTargetMs?: number }
export interface ActivityStart { sessionId: string; game: GameKind; mode: 'real' | 'demo'; heroName: string; rounds: ActivityRound[]; currentRound: ActivityRound; firstItem: ActivityItem; nextAttemptIndex?: number; completedRounds?: number[] }
export interface ActivityResponse { events: { type: string; payload: Record<string, unknown> }[]; nextItem: ActivityItem | null; nextAttemptIndex: number; currentRound: ActivityRound | null; sessionComplete: boolean; dialogue?: { provider: string; text: string; hoyaActions: string[] } | null }

export const startActivity = (game: GameKind, mode: 'real' | 'demo') =>
  api<ActivityStart>('/activities', { method: 'POST', body: JSON.stringify({ game, mode }) })

export const resumeActivity = (sessionId: string) => api<ActivityStart>(`/activities/${sessionId}`)

export const sendActivityUtterance = (session: ActivityStart, item: ActivityItem, roundIndex: number, attemptIndex: number,
  transcript: string | null, acoustic: Acoustic) =>
  api<ActivityResponse>(`/activities/${session.sessionId}/utterances`, { method: 'POST', body: JSON.stringify({
    roundIndex, itemId: item.itemId, attemptIndex, transcript, acoustic,
    recognizer: session.mode === 'demo' ? 'demo_script' : 'web_speech',
  }) })
