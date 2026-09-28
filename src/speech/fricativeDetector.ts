import type { VadFrame } from './vad'
import { FRICATION_CENTROID_HZ, FRICATION_ENERGY_MARGIN_DB, FRICATION_HF_RATIO } from './thresholds'

export function isFrication(frame: VadFrame, noiseFloorDb: number): boolean {
  return frame.rmsDb > noiseFloorDb + FRICATION_ENERGY_MARGIN_DB &&
    (frame.hfRatio >= FRICATION_HF_RATIO || (frame.spectralCentroidHz ?? 0) >= FRICATION_CENTROID_HZ)
}

export function isVoicedLike(frame: VadFrame, noiseFloorDb: number): boolean {
  return frame.rmsDb > noiseFloorDb + FRICATION_ENERGY_MARGIN_DB && (frame.spectralCentroidHz ?? 0) < 2000
}
