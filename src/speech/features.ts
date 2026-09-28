import type { VadFrame } from './vad'

export function extractFeatures(timeData: Float32Array, spectrum: Float32Array, sampleRate: number, tMs: number): VadFrame {
  if (!timeData.length || !spectrum.length) return { tMs, rmsDb: -120, hfRatio: 0, spectralCentroidHz: 0, zcr: 0, clippingRatio: 0, peakDb: -120 }
  const rms = Math.sqrt(timeData.reduce((sum, sample) => sum + sample * sample, 0) / timeData.length)
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-6))
  const hzPerBin = sampleRate / (spectrum.length * 2)
  let total = 0, high = 0, weighted = 0, zeroCrossings = 0, clipping = 0, peak = 0
  spectrum.forEach((db, bin) => { const energy = Math.pow(10, db / 10); total += energy; weighted += energy * bin * hzPerBin; if (bin * hzPerBin >= 4000 && bin * hzPerBin <= 8000) high += energy })
  timeData.forEach((sample, index) => {
    peak = Math.max(peak, Math.abs(sample))
    if (Math.abs(sample) >= 0.99) clipping++
    if (index && (sample >= 0) !== (timeData[index - 1] >= 0)) zeroCrossings++
  })
  return { tMs, rmsDb, peakDb: 20 * Math.log10(Math.max(peak, 1e-6)), hfRatio: total ? high / total : 0,
    spectralCentroidHz: total ? weighted / total : 0, zcr: zeroCrossings / timeData.length, clippingRatio: clipping / timeData.length }
}
