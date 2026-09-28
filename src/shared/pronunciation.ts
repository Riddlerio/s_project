import type { GameEvent } from './events'

export type ChildOutcome = 'SUCCESS' | 'RETRY' | 'UNCERTAIN' | 'NEUTRAL_CONTINUE' | 'NO_SPEECH'

export function toChildOutcome(events: Pick<GameEvent, 'type' | 'payload'>[]): ChildOutcome {
  if (events.some(event => event.type === 'ITEM_ADVANCE' && event.payload.reason === 'UNCERTAIN_SKIP')) return 'NEUTRAL_CONTINUE'
  if (events.some(event => event.type === 'LISTEN_AGAIN')) return 'UNCERTAIN'
  if (events.some(event => event.type === 'NO_SPEECH')) return 'NO_SPEECH'
  if (events.some(event => event.type === 'TARGET_SUCCESS')) return 'SUCCESS'
  return 'RETRY'
}
