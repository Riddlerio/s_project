import type { PlayItem } from '../shared/events'
export interface RecognitionResult { transcript: string | null; alternatives: string[]; confidence: number | null; recognizer: 'web_speech' | 'demo_script' }
export interface SpeechRecognizer { readonly id: 'web_speech' | 'demo_script'; isAvailable(): boolean; start(expected: PlayItem): void; stop(): Promise<RecognitionResult> }
