import { describe, expect, it } from 'vitest'
import { isFrication } from './fricativeDetector'
import { SustainTracker } from './sustainTracker'
import { assessAudioQuality } from './audioQuality'

describe('마찰음 발성 근거', () => {
  it('고주파 비율 또는 스펙트럼 중심으로 마찰음을 찾는다', () => {
    expect(isFrication({ tMs: 0, rmsDb: -20, hfRatio: 0.4, spectralCentroidHz: 1800 }, -60)).toBe(true)
    expect(isFrication({ tMs: 0, rmsDb: -20, hfRatio: 0.1, spectralCentroidHz: 3500 }, -60)).toBe(true)
    expect(isFrication({ tMs: 0, rmsDb: -20, hfRatio: 0.1, spectralCentroidHz: 1200 }, -60)).toBe(false)
  })

  it('유성 소리만으로 마찰음 연속 발성을 인정하지 않는다', () => {
    const tracker = new SustainTracker('fricative', -60)
    for (let i = 0; i < 60; i++) tracker.process({ tMs: i * 20, rmsDb: -20, hfRatio: 0.05, spectralCentroidHz: 1200 })
    expect(tracker.bestRunMs).toBe(0)
    expect(tracker.fricationMs).toBe(0)
    expect(tracker.totalActiveMs).toBeGreaterThan(0)
  })

  it('같은 크기의 마찰 발성은 activeMs와 fricationMs가 함께 증가한다', () => {
    const tracker = new SustainTracker('fricative', -60)
    for (let i = 0; i < 60; i++) tracker.process({ tMs: i * 20, rmsDb: -20, hfRatio: 0.5, spectralCentroidHz: 5000 })
    expect(tracker.totalActiveMs).toBe(1200)
    expect(tracker.fricationMs).toBe(1200)
    expect(tracker.bestRunMs).toBe(1200)
  })

  it('120ms 이하 간격은 하나의 연속 구간으로 잇는다', () => {
    const tracker = new SustainTracker('fricative', -60)
    tracker.process({ tMs: 0, rmsDb: -20, hfRatio: 0.5 })
    tracker.process({ tMs: 20, rmsDb: -20, hfRatio: 0.5 })
    tracker.process({ tMs: 40, rmsDb: -70, hfRatio: 0 })
    tracker.process({ tMs: 100, rmsDb: -20, hfRatio: 0.5 })
    expect(tracker.bestRunMs).toBe(60)
  })

  it('짧거나 신호 대 잡음비가 낮은 발화는 음질 불량으로 표시한다', () => {
    expect(assessAudioQuality(-60, -50, 200, 0).level).toBe('POOR')
    expect(assessAudioQuality(-60, -40, 900, 0).level).toBe('GOOD')
  })
})

describe('쉼 후 재개 측정', () => {
  const run = (tracker: SustainTracker, from: number, to: number, rmsDb: number) => {
    for (let t = from; t < to; t += 20) tracker.process({ tMs: t, rmsDb, hfRatio: 0.05, spectralCentroidHz: 1200 })
  }

  it('자연스러운 쉼 뒤 재개하면 두 구간과 쉼 길이를 남긴다', () => {
    const tracker = new SustainTracker('any_sound', -60)
    run(tracker, 0, 1100, -20); run(tracker, 1100, 2300, -70); run(tracker, 2300, 3400, -20)
    expect(tracker.segments.filter(ms => ms >= 1000)).toHaveLength(2)
    expect(tracker.pauseCount).toBe(1)
    expect(tracker.pauseTotalMs).toBeGreaterThanOrEqual(1100)
    expect(tracker.pauseTotalMs).toBeLessThanOrEqual(1300)
  })

  it('120ms 이하의 짧은 끊김은 쉼으로 세지 않는다', () => {
    const tracker = new SustainTracker('any_sound', -60)
    run(tracker, 0, 1000, -20); run(tracker, 1000, 1080, -70); run(tracker, 1080, 2000, -20)
    expect(tracker.pauseCount).toBe(0)
    expect(tracker.segments).toHaveLength(1)
  })

  it('다시 시작하지 않으면 구간은 하나다', () => {
    const tracker = new SustainTracker('any_sound', -60)
    run(tracker, 0, 1100, -20); run(tracker, 1100, 2300, -70)
    expect(tracker.segments).toHaveLength(1)
    expect(tracker.pauseCount).toBe(0)
  })

  it('소리가 없으면 활동 시간이 0이다', () => {
    const tracker = new SustainTracker('any_sound', -60)
    run(tracker, 0, 1000, -70)
    expect(tracker.totalActiveMs).toBe(0)
    expect(tracker.segments).toHaveLength(0)
  })
})
