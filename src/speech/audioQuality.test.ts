import { describe, expect, it } from 'vitest'
import cases from '../../shared/audio_quality_cases.json'
import { assessAudioQuality } from './audioQuality'

describe('공통 음질 경계', () => {
  it('브라우저 판정이 서버 규칙과 일치한다', () => {
    for (const sample of cases) {
      expect(assessAudioQuality(sample.noiseFloorDb, sample.meanRmsDb, sample.durationMs, sample.clippingRatio).level).toBe(sample.level)
    }
  })
})
