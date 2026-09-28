import type { GameType, TrainingLevel } from './levels'

export interface PlayItem { itemId: string; displayText: string; level: TrainingLevel; game: GameType; pictureKey: string; beamTargetMs?: number }
export type GameEventType = 'SESSION_START' | 'STAGE_START' | 'TARGET_PRESENTED' | 'VOICE_START' | 'VOICE_CONTINUE' | 'VOICE_END' | 'NO_SPEECH' | 'TARGET_SUCCESS' | 'TARGET_RETRY' | 'HINT_REQUIRED' | 'LEVEL_UP' | 'LEVEL_DOWN' | 'REWARD' | 'ITEM_SKIPPED' | 'SESSION_COMPLETE'
export interface GameEvent { id: string; type: GameEventType; at: string; payload: Record<string, unknown> }
