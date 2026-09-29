import { isFrication } from './fricativeDetector'
export interface VadFrame { tMs: number; rmsDb: number; hfRatio: number; peakDb?: number; spectralCentroidHz?: number; zcr?: number; clippingRatio?: number }
export type VadEvent = { type: 'VOICE_START' | 'VOICE_CONTINUE' | 'VOICE_END'; tMs: number; rmsDb?: number; durationMs?: number; voicedMs?: number; meanRmsDb?: number; peakRmsDb?: number; meanHfRatio?: number; meanCentroidHz?: number; fricationMs?: number; clippingRatio?: number; noiseFloorDb?: number }
export interface VadConfig { startMarginDb: number; endMarginDb: number; minStartDbFloor: number; startHoldMs: number; endHoldMs: number; continueEveryMs: number; maxUtteranceMs: number }
export const DEFAULT_VAD: VadConfig = { startMarginDb: 12, endMarginDb: 6, minStartDbFloor: -50, startHoldMs: 60, endHoldMs: 700, continueEveryMs: 100, maxUtteranceMs: 8000 }

export class VadStateMachine {
  state: 'silence' | 'maybe_voice' | 'voice' | 'maybe_silence' = 'silence'
  noiseFloor = -60
  private candidateStart = 0
  private voiceStart = 0
  private silenceStart = 0
  private lastContinue = 0
  private frames: VadFrame[] = []
  constructor(public config: VadConfig = DEFAULT_VAD) {}
  reset() { this.state = 'silence'; this.candidateStart = 0; this.voiceStart = 0; this.silenceStart = 0; this.lastContinue = 0; this.frames = [] }
  calibrate(noiseFrames: number[]) { if (noiseFrames.length) this.noiseFloor = [...noiseFrames].sort((a, b) => a - b)[Math.floor(noiseFrames.length / 2)] }
  process(frame: VadFrame): VadEvent[] {
    const start = Math.max(this.noiseFloor + this.config.startMarginDb, this.config.minStartDbFloor)
    const end = this.noiseFloor + this.config.endMarginDb
    const result: VadEvent[] = []
    if (this.state === 'silence') {
      if (frame.rmsDb > start) { this.state = 'maybe_voice'; this.candidateStart = frame.tMs; this.frames = [frame] }
    } else if (this.state === 'maybe_voice') {
      if (frame.rmsDb <= start) { this.state = 'silence'; this.frames = [] }
      else { this.frames.push(frame); if (frame.tMs - this.candidateStart >= this.config.startHoldMs) { this.state = 'voice'; this.voiceStart = this.candidateStart; this.lastContinue = frame.tMs; result.push({ type: 'VOICE_START', tMs: this.voiceStart }) } }
    } else {
      this.frames.push(frame)
      if (frame.tMs - this.lastContinue >= this.config.continueEveryMs) { this.lastContinue = frame.tMs; result.push({ type: 'VOICE_CONTINUE', tMs: frame.tMs, rmsDb: frame.rmsDb }) }
      if (frame.rmsDb < end && this.state === 'voice') { this.state = 'maybe_silence'; this.silenceStart = frame.tMs }
      else if (frame.rmsDb >= end && this.state === 'maybe_silence') this.state = 'voice'
      if (frame.tMs - this.voiceStart >= this.config.maxUtteranceMs || (this.state === 'maybe_silence' && frame.tMs - this.silenceStart >= this.config.endHoldMs)) {
        // 신호 통계는 발성 frame으로만 계산한다. 쉼과 발화 종료 유예의 무음이 평균 음량·SNR을 낮추면 안 된다.
        // 잡음 기준(noiseFloorDb)은 시작 전 보정 구간의 무음에서 따로 구한다.
        const voiced = this.frames.filter(f => f.rmsDb >= end)
        const signal = voiced.length ? voiced : this.frames
        const mean = (value: (f: VadFrame) => number) => signal.reduce((n, f) => n + value(f), 0) / signal.length
        // 발화 길이는 마지막 발성 frame까지다. 후행 종료 유예는 포함하지 않는다.
        const lastVoicedMs = voiced.length ? voiced[voiced.length - 1].tMs + 20 : frame.tMs
        const durationMs = Math.max(0, lastVoicedMs - this.voiceStart)
        result.push({ type: 'VOICE_END', tMs: frame.tMs, durationMs, voicedMs: voiced.length * 20,
          meanRmsDb: mean(f => f.rmsDb),
          peakRmsDb: Math.max(...signal.map(f => f.peakDb ?? f.rmsDb)),
          meanHfRatio: mean(f => f.hfRatio),
          meanCentroidHz: mean(f => f.spectralCentroidHz ?? 0),
          fricationMs: this.frames.filter(f => isFrication(f, this.noiseFloor)).length * 20,
          clippingRatio: mean(f => f.clippingRatio ?? 0),
          noiseFloorDb: this.noiseFloor })
        this.state = 'silence'; this.frames = []
      }
    }
    return result
  }
}
