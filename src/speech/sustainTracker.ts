import type { VadFrame } from './vad'
import { isFrication, isVoicedLike } from './fricativeDetector'
import { SUSTAIN_GAP_MS } from './thresholds'

export type SustainMode = 'fricative' | 'any_sound'

export class SustainTracker {
  currentRunMs = 0
  bestRunMs = 0
  totalActiveMs = 0
  fricationMs = 0
  energy01 = 0
  segments: number[] = []
  pauseCount = 0
  pauseTotalMs = 0
  /** 한 발화 안에서 가장 긴 쉼. 쉼 후 재개 판정에 쓴다. */
  maxPauseMs = 0
  onsetFricationMs = 0
  voicedAfterFricationMs = 0
  private energySum = 0
  private energySumSquares = 0
  private energySamples = 0
  private onsetOpen = true
  private lastFrameMs: number | null = null
  private lastActiveMs: number | null = null

  constructor(public mode: SustainMode, private noiseFloorDb: number) {}

  get energyMean01(): number { return this.energySamples ? this.energySum / this.energySamples : 0 }
  get energyStd01(): number { return this.energySamples ? Math.sqrt(Math.max(0, this.energySumSquares / this.energySamples - this.energyMean01 ** 2)) : 0 }
  get interruptionCount(): number { return this.pauseCount }

  reset(noiseFloorDb = this.noiseFloorDb): void {
    this.noiseFloorDb = noiseFloorDb
    this.currentRunMs = 0
    this.bestRunMs = 0
    this.totalActiveMs = 0
    this.fricationMs = 0
    this.energy01 = 0
    this.segments = []
    this.pauseCount = 0
    this.pauseTotalMs = 0
    this.maxPauseMs = 0
    this.onsetFricationMs = 0
    this.voicedAfterFricationMs = 0
    this.energySum = 0
    this.energySumSquares = 0
    this.energySamples = 0
    this.onsetOpen = true
    this.lastFrameMs = null
    this.lastActiveMs = null
  }

  process(frame: VadFrame): void {
    const frameMs = this.lastFrameMs === null ? 20 : Math.max(0, Math.min(20, frame.tMs - this.lastFrameMs))
    this.lastFrameMs = frame.tMs
    const frication = isFrication(frame, this.noiseFloorDb)
    const audible = frame.rmsDb > this.noiseFloorDb + 6
    const active = this.mode === 'fricative' ? frication : audible
    this.energy01 = 0.75 * this.energy01 + 0.25 * Math.max(0, Math.min(1, (frame.rmsDb - this.noiseFloorDb) / 30))
    this.energySum += this.energy01
    this.energySumSquares += this.energy01 ** 2
    this.energySamples += 1
    if (audible) this.totalActiveMs += frameMs
    if (frication) this.fricationMs += frameMs
    if (this.onsetOpen && frication) this.onsetFricationMs += frameMs
    else if (this.onsetOpen && audible && !frication) this.onsetOpen = false
    if (this.onsetFricationMs > 0 && !frication && isVoicedLike(frame, this.noiseFloorDb)) {
      this.onsetOpen = false
      this.voicedAfterFricationMs += frameMs
    } else if (this.onsetFricationMs > 0 && !frication) this.onsetOpen = false
    if (active) {
      const continues = this.lastActiveMs !== null && frame.tMs - this.lastActiveMs <= SUSTAIN_GAP_MS
      if (!continues && this.lastActiveMs !== null) {
        const pauseMs = Math.max(0, frame.tMs - this.lastActiveMs - 20)
        this.pauseCount += 1
        this.pauseTotalMs += pauseMs
        this.maxPauseMs = Math.max(this.maxPauseMs, pauseMs)
      }
      this.currentRunMs = continues ? this.currentRunMs + frameMs : frameMs
      if (continues && this.segments.length) this.segments[this.segments.length - 1] = this.currentRunMs
      else if (this.segments.length < 30) this.segments.push(frameMs)
      this.lastActiveMs = frame.tMs
      this.bestRunMs = Math.max(this.bestRunMs, this.currentRunMs)
    } else if (this.lastActiveMs !== null && frame.tMs - this.lastActiveMs > SUSTAIN_GAP_MS) {
      this.currentRunMs = 0
    }
  }
}
