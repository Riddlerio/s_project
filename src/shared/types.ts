import type { GameEvent, PlayItem } from './events'
import type { SessionMode } from './levels'

export interface PlayStart { sessionId: string; heroName: string; mode: SessionMode; plan: { stages: { game: string; itemCount: number }[] }; firstItem: PlayItem; events: GameEvent[] }
export interface PlayResponse { events: GameEvent[]; nextItem: PlayItem | null; nextAttemptIndex: number; sessionComplete: boolean }
export interface Acoustic { durationMs: number; voicedMs: number; meanRmsDb: number; peakRmsDb: number; meanHfRatio: number; onsetLatencyMs: number; source?: string; bestRunMs?: number; fricationMs?: number; activeMs?: number; meanCentroidHz?: number; clippingRatio?: number; noiseFloorDb?: number; snrDb?: number; sustainSegmentsMs?: number[]; pauseCount?: number; pauseTotalMs?: number; maxPauseMs?: number; interruptionCount?: number; energyMean01?: number; energyStd01?: number; onsetFricationMs?: number; voicedAfterFricationMs?: number }
