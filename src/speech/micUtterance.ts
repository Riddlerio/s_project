import type { Acoustic } from '../shared/types'
import { SustainTracker, type SustainMode } from './sustainTracker'
import { DEFAULT_VAD, VadStateMachine, type VadEvent, type VadFrame } from './vad'

export const CALIBRATION_MS = 1000

/**
 * 실제 마이크 frame을 발화 요약(Acoustic)으로 바꾸는 브라우저 경로.
 * 시작 전 1초 무음으로 잡음 기준을 잡고, VAD가 발화 구간을 정하며, SustainTracker가 지속·쉼을 측정한다.
 * ActivitySession과 테스트가 같은 코드를 쓴다.
 */
export class MicUtterancePipeline {
  readonly vad: VadStateMachine
  readonly tracker: SustainTracker
  onsetLatencyMs = 0
  private calibration: number[] = []
  private calibrationStart: number | null = null

  constructor(mode: SustainMode, endHoldMs = DEFAULT_VAD.endHoldMs) {
    this.vad = new VadStateMachine({ ...DEFAULT_VAD, endHoldMs })
    this.tracker = new SustainTracker(mode, -60)
  }

  get calibrated(): boolean { return this.calibrationStart !== null && this.calibration.length === 0 }

  /** frame 하나를 처리한다. 발화가 끝나면 서버에 보낼 요약을 함께 돌려준다. */
  process(frame: VadFrame): { events: VadEvent[]; acoustic?: Acoustic } {
    if (this.calibrationStart === null) this.calibrationStart = frame.tMs
    if (frame.tMs - this.calibrationStart < CALIBRATION_MS) { this.calibration.push(frame.rmsDb); return { events: [] } }
    if (this.calibration.length) { this.vad.calibrate(this.calibration); this.tracker.reset(this.vad.noiseFloor); this.calibration = [] }
    const active = this.vad.state === 'voice' || this.vad.state === 'maybe_silence'
    const events = this.vad.process(frame)
    if (events.some(event => event.type === 'VOICE_START')) this.tracker.reset(this.vad.noiseFloor)
    if (active || events.some(event => event.type === 'VOICE_START')) this.tracker.process(frame)
    const end = events.find(event => event.type === 'VOICE_END')
    return end ? { events, acoustic: this.summary(end) } : { events }
  }

  private summary(event: VadEvent): Acoustic {
    const tracker = this.tracker
    return { durationMs: event.durationMs ?? 0, voicedMs: event.voicedMs ?? 0,
      activeMs: tracker.totalActiveMs, bestRunMs: tracker.bestRunMs, fricationMs: tracker.fricationMs,
      meanRmsDb: event.meanRmsDb ?? -60, peakRmsDb: event.peakRmsDb ?? -60,
      meanHfRatio: event.meanHfRatio ?? 0, meanCentroidHz: event.meanCentroidHz ?? 0,
      noiseFloorDb: event.noiseFloorDb, clippingRatio: event.clippingRatio,
      onsetLatencyMs: this.onsetLatencyMs, source: 'microphone', sustainSegmentsMs: [...tracker.segments],
      pauseCount: tracker.pauseCount, pauseTotalMs: tracker.pauseTotalMs, maxPauseMs: tracker.maxPauseMs,
      interruptionCount: tracker.interruptionCount, energyMean01: tracker.energyMean01, energyStd01: tracker.energyStd01,
      onsetFricationMs: tracker.onsetFricationMs, voicedAfterFricationMs: tracker.voicedAfterFricationMs }
  }
}
