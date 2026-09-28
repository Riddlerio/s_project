import type { GameEvent, PlayItem } from './events'
import type { SessionMode } from './levels'

export interface PlayStart { sessionId: string; playToken: string; heroName: string; mode: SessionMode; plan: { stages: { game: string; itemCount: number }[] }; firstItem: PlayItem; events: GameEvent[] }
export interface PlayResponse { events: GameEvent[]; nextItem: PlayItem | null; nextAttemptIndex: number; sessionComplete: boolean }
export interface Acoustic { durationMs: number; voicedMs: number; meanRmsDb: number; peakRmsDb: number; meanHfRatio: number; onsetLatencyMs: number; source?: string }
export interface SessionPoint { sessionId: string; index: number; date: string; mode: SessionMode; isSeed: boolean; goalVersion: number; phoneme: string; firstTrySuccessRate: number; successRate: number; meanScore: number; aiMeanScore: number; retryRate: number; hintRate: number; noSpeechRate: number; levelMix: Record<string, number>; durationSec: number }
export interface Progress { sessions: SessionPoint[]; phonemeSeries: { phoneme: string; points: { sessionIndex: number; successRate: number }[] }[]; wordPerformance: { text: string; phoneme: string; meanScore: number; attempts: number; retries: number; patternTags: string[] }[]; interventions: { goalVersion: number; at: string; source: string; summary: string; before: number | null; after: number | null; delta: number | null }[] }
