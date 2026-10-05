import { api } from '../../api/client'
import { sendActivityUtterance, startActivity, type ActivityItem, type ActivityResponse, type ActivityRound, type ActivityStart } from '../../api/activities'
import type { Acoustic } from '../../shared/types'
import { CrossingProgress, ITEMS_PER_ROUND, MAX_QUIET, MAX_TRIES, judgeOnset, previewPlan, resultFromEvents, type CrossingItem, type CrossingResult } from './crossingFlow'
import { DEFAULT_RHYTHM, rhythmSetting, type RhythmSetting } from './rhythm'

/*
 * '대구대 건너기'의 판정·진행 공급자. 실제 화면은 서버(server)만 쓴다: 두두가 점프하는 것은 서버 결과를 따른다.
 * preview는 개발 검토 화면에서 서버 없이 장면을 확인할 때만 쓰고 화면에 '미리보기'로 표시한다.
 */
export interface CrossingTurn { result: CrossingResult; next: CrossingItem | null; complete: boolean }
export interface CrossingJudge {
  readonly kind: 'server' | 'preview'
  /** rhythm: 치료사가 정한 박자(시작·이어받기 응답의 선택 필드). 없으면 기본값(84BPM, 빨라지기 허용). */
  start(): Promise<{ first: CrossingItem; heroName: string; rhythm: RhythmSetting }>
  submit(item: CrossingItem, attempt: { transcript: string | null; acoustic: Acoustic }): Promise<CrossingTurn>
  finish(elapsedSec: number): Promise<void>
}

export function previewJudge(level: 'syllable' | 'word' = 'syllable', heroName = '두두친구'): CrossingJudge {
  const plan = previewPlan(level)
  const progress = new CrossingProgress(plan)
  return {
    kind: 'preview',
    start: async () => ({ first: plan[0], heroName, rhythm: DEFAULT_RHYTHM }),
    submit: async (_item, attempt) => {
      const result = judgeOnset(attempt.acoustic)
      const { next } = progress.record(result)
      return { result, next, complete: next === null }
    },
    finish: async () => undefined,
  }
}

/** 서버가 아직 줄 번호를 주지 않으면(구버전 응답) 화면에서 센다. 새 줄 여부는 결과와 시도 수로 정한다. */
type Extra = { result?: CrossingResult; itemIndexInRound?: number; stripeIndex?: number; modelCue?: boolean }

export function serverJudge(mode: 'real' | 'demo'): CrossingJudge {
  let session: ActivityStart | null = null
  let round: ActivityRound | null = null
  let activityItem: ActivityItem | null = null
  let stripe = 1, tries = 0, quiet = 0
  // 서버가 돌려준 시도 번호를 그대로 다음 요청에 쓴다(계약: src/api/daeguCrossing.ts).
  let attemptIndex = 1
  const toItem = (item: ActivityItem, currentRound: ActivityRound, extra: Extra = {}): CrossingItem => ({
    itemId: item.itemId, text: item.displayText, level: item.level === 'word' ? 'word' : 'syllable',
    roundIndex: currentRound.index, stripeIndex: extra.stripeIndex ?? stripe,
    itemIndexInRound: extra.itemIndexInRound ?? ((stripe - 1) % ITEMS_PER_ROUND) + 1,
    modelCue: extra.modelCue ?? currentRound.index === 1,
  })
  return {
    kind: 'server',
    async start() {
      session = await startActivity('daegu_crossing', mode)
      round = session.currentRound
      activityItem = session.firstItem
      attemptIndex = session.nextAttemptIndex ?? 1
      return { first: toItem(session.firstItem, session.currentRound, session as Extra), heroName: session.heroName,
        rhythm: rhythmSetting((session as ActivityStart & { rhythm?: unknown }).rhythm) }
    },
    async submit(item, attempt) {
      if (!session || !round || !activityItem) throw new Error('CROSSING_NOT_STARTED')
      const response = await sendActivityUtterance(session, activityItem, item.roundIndex, attemptIndex, attempt.transcript, attempt.acoustic)
      attemptIndex = response.nextAttemptIndex ?? attemptIndex + 1
      const extra = response as ActivityResponse & Extra
      const result = extra.result ?? resultFromEvents(response.events)
      if (result === 'retry') { tries++; quiet = 0 } else if (result !== 'success') quiet++
      const advanced = extra.stripeIndex !== undefined ? extra.stripeIndex !== item.stripeIndex
        : result === 'success' || tries >= MAX_TRIES || quiet >= MAX_QUIET || response.events.some(event => event.type === 'ITEM_ADVANCE' || event.type === 'ROUND_START')
      if (advanced) { stripe++; tries = 0; quiet = 0 }
      if (response.currentRound) round = response.currentRound
      if (response.nextItem) activityItem = response.nextItem
      const next = response.sessionComplete || !response.nextItem || !round ? null : toItem(response.nextItem, round, extra)
      return { result, next, complete: response.sessionComplete }
    },
    async finish(elapsedSec) {
      if (!session) return
      await api(`/play/sessions/${session.sessionId}/complete`, { method: 'POST', headers: { 'X-Activity-Lease': session.leaseToken ?? '' },
        body: JSON.stringify({ elapsedSec }) })
    },
  }
}
