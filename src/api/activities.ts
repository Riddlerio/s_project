import { api } from './client'
import type { Acoustic } from '../shared/types'
import type { GameKind } from '../control/speechGameSignal'

export interface ActivityRound { index: number; id: string; childTitle: string; childPrompt: string; targetMs: number; attempts: number; elicitationType: string; difficulty?: number; itemSource?: string; endHoldMs?: number }
export interface ActivityItem { itemId: string; displayText: string; level: string; game: GameKind; pictureKey: string; beamTargetMs?: number }
export interface ActivityStart { sessionId: string; game: GameKind; mode: 'real' | 'demo'; heroName: string; rounds: ActivityRound[]; currentRound: ActivityRound; firstItem: ActivityItem; nextAttemptIndex?: number; completedRounds?: number[]; leaseToken?: string; sessionComplete?: boolean; magicBeamAvailable?: boolean }
export interface ActivityResponse { events: { type: string; payload: Record<string, unknown> }[]; nextItem: ActivityItem | null; nextAttemptIndex: number; currentRound: ActivityRound | null; sessionComplete: boolean; magicBeamAvailable?: boolean; dialogue?: { provider: string; text: string; hoyaActions: string[] } | null }

export const startActivity = (game: GameKind, mode: 'real' | 'demo') =>
  api<ActivityStart>('/activities', { method: 'POST', body: JSON.stringify({ game, mode }) })


/** 대구대 건너기: 한 판을 마친 같은 회기에서 첫 줄부터 한 판 더 건넌다. 최대 판 수는 서버가 막는다(409). */
export const nextCrossingLap = (session: ActivityStart) =>
  api<ActivityStart & { events: ActivityResponse['events']; lap?: number; maxLaps?: number }>(`/activities/${session.sessionId}/laps`, {
    method: 'POST', ...(session.leaseToken ? { headers: { 'X-Activity-Lease': session.leaseToken } } : {}) })

export const sendActivityUtterance = (session: ActivityStart, item: ActivityItem, roundIndex: number, attemptIndex: number,
  transcript: string | null, acoustic: Acoustic, attack: 'basic' | 'magic_beam' = 'basic') =>
  api<ActivityResponse>(`/activities/${session.sessionId}/utterances`, { method: 'POST', ...(session.leaseToken ? { headers: { 'X-Activity-Lease': session.leaseToken } } : {}), body: JSON.stringify({
    roundIndex, itemId: item.itemId, attemptIndex, transcript, acoustic, attack,
    recognizer: session.mode === 'demo' ? 'demo_script' : 'web_speech',
  }) })
