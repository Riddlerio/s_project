import { api } from './client'
import type { Acoustic } from '../shared/types'

export interface DaeguCrossingRound {
  index: number
  id: string
  childTitle: string
  childPrompt: string
}
/** 응답 후 표시할 항목. 완료 시 5/4/20, 남은 시도 0, 시범 false. */
export interface DaeguCrossingProgress {
  roundIndex: number
  itemIndexInRound: number
  stripeIndex: number
  triesLeft: number
  modelCue: boolean
  sessionComplete: boolean
}
export interface DaeguCrossingItem {
  itemId: string
  displayText: string
  level: string
  game: 'daegu_crossing'
  pictureKey: string
}
export interface DaeguCrossingStart extends DaeguCrossingProgress {
  sessionId: string
  game: 'daegu_crossing'
  mode: 'real' | 'demo'
  heroName: string
  rounds: DaeguCrossingRound[]
  currentRound: DaeguCrossingRound
  firstItem: DaeguCrossingItem
  nextAttemptIndex: number
  completedRounds?: number[]
  leaseToken?: string
}
export type DaeguCrossingResult = 'success' | 'retry' | 'uncertain' | 'no_speech'
export interface DaeguCrossingResponse extends DaeguCrossingProgress {
  /** 방금 제출한 항목의 음향 근사 결과. 번호는 다음 항목 기준. */
  result: DaeguCrossingResult
  events: { type: string; payload: Record<string, unknown> }[]
  nextItem: DaeguCrossingItem | null
  nextAttemptIndex: number
  currentRound: DaeguCrossingRound | null
}
export const startDaeguCrossing = (mode: 'real' | 'demo') =>
  api<DaeguCrossingStart>('/activities', { method: 'POST', body: JSON.stringify({ game: 'daegu_crossing', mode }) })

export const getDaeguCrossing = (sessionId: string) =>
  api<DaeguCrossingStart>(`/activities/${sessionId}`)

export const sendDaeguCrossingUtterance = (
  session: DaeguCrossingStart, item: DaeguCrossingItem, roundIndex: number, attemptIndex: number,
  transcript: string | null, acoustic: Acoustic,
) => api<DaeguCrossingResponse>(`/activities/${session.sessionId}/utterances`, {
  method: 'POST',
  ...(session.leaseToken ? { headers: { 'X-Activity-Lease': session.leaseToken } } : {}),
  body: JSON.stringify({
    roundIndex, itemId: item.itemId, attemptIndex, transcript, acoustic, attack: 'basic',
    recognizer: session.mode === 'demo' ? 'demo_script' : 'web_speech',
  }),
})
