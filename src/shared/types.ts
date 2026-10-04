import type { SessionMode } from './levels'

export interface Acoustic { durationMs: number; voicedMs: number; meanRmsDb: number; peakRmsDb: number; meanHfRatio: number; onsetLatencyMs: number; source?: string; bestRunMs?: number; fricationMs?: number; activeMs?: number; meanCentroidHz?: number; clippingRatio?: number; noiseFloorDb?: number; snrDb?: number; sustainSegmentsMs?: number[]; pauseCount?: number; pauseTotalMs?: number; maxPauseMs?: number; interruptionCount?: number; energyMean01?: number; energyStd01?: number; onsetFricationMs?: number; voicedAfterFricationMs?: number }
