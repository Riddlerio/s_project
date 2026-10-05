import type { GameType, TrainingLevel } from './levels'

export interface PlayItem { itemId: string; displayText: string; level: TrainingLevel; game: GameType; pictureKey: string; beamTargetMs?: number }
