import type { GameEvent } from '../../shared/events'

export type TowerPhase = 'INTRO' | 'MISSION' | 'SHOW_TARGET' | 'LISTENING' | 'ANALYZING' | 'SUCCESS' | 'RETRY' | 'HINT' | 'ANIMATION' | 'NEXT_TARGET' | 'COMPLETE'
export interface TowerState { phase: TowerPhase; health: number; shield: boolean; charge: boolean; xp: number }
export const initialTowerState: TowerState = { phase: 'INTRO', health: 8, shield: false, charge: false, xp: 0 }

export function towerTransition(state: TowerState, event: Pick<GameEvent, 'type' | 'payload'>): TowerState {
  switch (event.type) {
    case 'SESSION_START': return { ...initialTowerState, phase: 'MISSION' }
    case 'STAGE_START': return { ...state, phase: 'MISSION', health: 8, shield: false }
    case 'TARGET_PRESENTED': return { ...state, phase: 'SHOW_TARGET' }
    case 'VOICE_START': return { ...state, phase: 'LISTENING' }
    case 'VOICE_END': return { ...state, phase: 'ANALYZING' }
    case 'TARGET_SUCCESS': return { ...state, phase: 'SUCCESS', health: Math.max(0, state.health - Number(event.payload.power || 1)), shield: false }
    case 'TARGET_RETRY': return { ...state, phase: 'RETRY', shield: true, xp: state.xp + 1 }
    case 'HINT_REQUIRED': return { ...state, phase: 'HINT' }
    case 'LEVEL_DOWN': return { ...state, phase: 'ANIMATION', charge: true }
    case 'LEVEL_UP': return { ...state, phase: 'ANIMATION', charge: false }
    case 'REWARD': return { ...state, phase: 'ANIMATION', xp: state.xp + Number(event.payload.xp || 0) }
    case 'ITEM_SKIPPED': return { ...state, phase: 'NEXT_TARGET' }
    case 'SESSION_COMPLETE': return { ...state, phase: 'COMPLETE' }
    default: return state
  }
}
