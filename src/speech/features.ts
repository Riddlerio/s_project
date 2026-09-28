import type { VadFrame } from './vad'

export function extractFeatures(timeData: Float32Array, spectrum: Float32Array, sampleRate: number, tMs: number): VadFrame {
  const rms = Math.sqrt(timeData.reduce((sum, sample) => sum + sample * sample, 0) / timeData.length)
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-6))
  const hzPerBin = sampleRate / (spectrum.length * 2)
  let total = 0, high = 0
  spectrum.forEach((db, bin) => { const energy = Math.pow(10, db / 10); total += energy; if (bin * hzPerBin >= 4000 && bin * hzPerBin <= 8000) high += energy })
  return { tMs, rmsDb, hfRatio: total ? high / total : 0 }
}
