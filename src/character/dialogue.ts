import type { GameEvent } from '../shared/events'
import { lines } from './lines.ko'

export type LineKey = keyof typeof lines
export class ScriptedDialogueProvider { private offset = 0; line(key: LineKey): string { const choices = lines[key]; return choices[this.offset++ % choices.length] } }
export function lineForEvent(event: GameEvent): LineKey {
  const map: Partial<Record<GameEvent['type'], LineKey>> = { SESSION_START: 'greeting', STAGE_START: 'stage_transition', TARGET_PRESENTED: 'mission', VOICE_START: 'listen', NO_SPEECH: 'no_speech', TARGET_SUCCESS: 'success', TARGET_RETRY: 'retry_shield', HINT_REQUIRED: 'hint', LEVEL_DOWN: 'charge_mode', LEVEL_UP: 'charge_full', ITEM_SKIPPED: 'item_skipped', SESSION_COMPLETE: 'celebrate' }
  return map[event.type] || 'encourage'
}
