export type AudioQualityLevel = 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN'

export interface AudioQuality {
  level: AudioQualityLevel
  snrDb: number | null
  durationMs: number
  clippingRatio: number
  reasons: string[]
}

export function assessAudioQuality(noiseFloorDb: number | null, meanActiveRmsDb: number, durationMs: number, clippingRatio: number): AudioQuality {
  const reasons: string[] = []
  const snrDb = noiseFloorDb === null ? null : meanActiveRmsDb - noiseFloorDb
  if (noiseFloorDb === null) return { level: 'UNKNOWN', snrDb, durationMs, clippingRatio, reasons: ['NO_NOISE_FLOOR'] }
  if (clippingRatio >= 0.01) reasons.push('CLIPPING')
  if (durationMs < 300) reasons.push('TOO_SHORT')
  if (durationMs > 8000) reasons.push('TOO_LONG')
  if (snrDb !== null && snrDb < 8) reasons.push('LOW_SNR')
  if (reasons.length === 0 && noiseFloorDb > -35) reasons.push('NOISY_FLOOR')
  const level: AudioQualityLevel = reasons.some(reason => reason !== 'NOISY_FLOOR') ? 'POOR'
    : snrDb !== null && snrDb >= 15 && reasons.length === 0 ? 'GOOD' : 'FAIR'
  return { level, snrDb, durationMs, clippingRatio, reasons }
}
