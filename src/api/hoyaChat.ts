import { api } from './client'
import type { HoyaAction } from '../control/speechGameSignal'
import type { ChatReply, ChatUtterance } from '../child/hoyaChatController'

export interface HoyaChatSession { sessionId: string; mode: 'real' | 'demo'; status: string; turnCount: number; maxTurns: number; openingText: string; lastHoyaText: string | null; hoyaActions?: HoyaAction[] }
export interface HoyaChatTurnReply extends ChatReply { turnIndex: number; hoyaActions: HoyaAction[] }

export const startHoyaChat = (mode: 'real' | 'demo') =>
  api<HoyaChatSession>('/hoya/chat/sessions', { method: 'POST', body: JSON.stringify({ mode }) })

export const sendHoyaTurn = (sessionId: string, turnIndex: number, utterance: ChatUtterance) =>
  api<HoyaChatTurnReply>(`/hoya/chat/sessions/${sessionId}/turns`, { method: 'POST', body: JSON.stringify({ turnIndex, ...utterance }) })

export const completeHoyaChat = (sessionId: string) =>
  api<HoyaChatSession>(`/hoya/chat/sessions/${sessionId}/complete`, { method: 'POST' })
