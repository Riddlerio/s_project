import { api } from './client'
import type { Acoustic } from '../shared/types'

export interface DaeguCrossingRhythm { startBpm: number; allowFaster: boolean }

export interface DaeguCrossingRound {
  index: number
  id: string
  childTitle: string
  childPrompt: string
}
/** 응답 후 표시할 항목. 완료 시 5/2/10, 남은 시도 0, 시범 false. */
export interface DaeguCrossingProgress {
  roundIndex: number
  /** 1~2 */
  itemIndexInRound: number
  /** 1~10 */
  stripeIndex: number
  triesLeft: number
  modelCue: boolean
  sessionComplete: boolean
  /** 같은 회기에서 몇 번째 판인지(1~maxLaps). 판을 마친 뒤 POST /activities/{id}/laps로 다음 판을 연다(2026-10-07). */
  lap?: number
  maxLaps?: number
  /** 연습을 마친 뒤 하는 새 낱말 확인. 확인 중에는 정오·점수를 보내지 않는다. */
  probeStarted?: boolean
  probeComplete?: boolean
  probeIndex?: number
  probeTotal?: number
}
export interface DaeguCrossingItem {
  itemId: string
  displayText: string
  level: string
  game: 'daegu_crossing'
  pictureKey: string
}
export interface DaeguCrossingSnapshot extends DaeguCrossingProgress {
  rhythm?: DaeguCrossingRhythm
  sessionId: string
  game: 'daegu_crossing'
  mode: 'real' | 'demo'
  heroName: string
  rounds: DaeguCrossingRound[]
  currentRound: DaeguCrossingRound | null
  firstItem: DaeguCrossingItem | null
  nextAttemptIndex: number
  completedRounds?: number[]
  leaseToken?: string
}
export interface DaeguCrossingStart extends DaeguCrossingSnapshot {
  sessionComplete: false
  currentRound: DaeguCrossingRound
  firstItem: DaeguCrossingItem
}
export type DaeguCrossingResult = 'success' | 'retry' | 'uncertain' | 'no_speech'
export interface DaeguCrossingResponse extends DaeguCrossingProgress {
  /** 방금 제출한 항목의 음향 근사 결과. 번호는 다음 항목 기준. */
  result?: DaeguCrossingResult
  events: { type: string; payload: Record<string, unknown> }[]
  nextItem: DaeguCrossingItem | null
  nextAttemptIndex: number
  currentRound: DaeguCrossingRound | null
}
export const startDaeguCrossing = (mode: 'real' | 'demo') =>
  api<DaeguCrossingStart>('/activities', { method: 'POST', body: JSON.stringify({ game: 'daegu_crossing', mode }) })

export const getDaeguCrossing = (sessionId: string) =>
  api<DaeguCrossingSnapshot>(`/activities/${sessionId}`)

/** 확인 낱말이 없으면 firstItem/currentRound는 null이고 그대로 마무리한다. */
export const startDaeguCrossingProbes = (session: Pick<DaeguCrossingSnapshot, 'sessionId' | 'leaseToken'>) =>
  api<DaeguCrossingSnapshot & { events: DaeguCrossingResponse['events'] }>(`/activities/${session.sessionId}/probes`, {
    method: 'POST', ...(session.leaseToken ? { headers: { 'X-Activity-Lease': session.leaseToken } } : {}),
  })

export const sendDaeguCrossingUtterance = (
  session: Pick<DaeguCrossingSnapshot, 'sessionId' | 'mode' | 'leaseToken'>, item: DaeguCrossingItem, roundIndex: number, attemptIndex: number,
  transcript: string | null, acoustic: Acoustic,
) => api<DaeguCrossingResponse>(`/activities/${session.sessionId}/utterances`, {
  method: 'POST',
  ...(session.leaseToken ? { headers: { 'X-Activity-Lease': session.leaseToken } } : {}),
  body: JSON.stringify({
    roundIndex, itemId: item.itemId, attemptIndex, transcript, acoustic, attack: 'basic',
    recognizer: session.mode === 'demo' ? 'demo_script' : 'web_speech',
  }),
})
