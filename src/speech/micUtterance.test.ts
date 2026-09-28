import { describe, expect, it } from 'vitest'
import fixture from '../../shared/re_onset_mic_cases.json'
import type { Acoustic } from '../shared/types'
import { assessAudioQuality } from './audioQuality'
import { MicUtterancePipeline } from './micUtterance'
import type { VadFrame } from './vad'

type Case = (typeof fixture.cases)[number]

function framesOf(segments: number[][]): VadFrame[] {
  const frames: VadFrame[] = []
  let t = 0
  for (const [ms, rmsDb] of segments) for (const end = t + ms; t < end; t += 20) frames.push({ tMs: t, rmsDb, hfRatio: 0.05, spectralCentroidHz: 1200 })
  return frames
}

function run(testCase: Case): Acoustic[] {
  const pipeline = new MicUtterancePipeline('any_sound', fixture.endHoldMs)
  return framesOf(testCase.segments).flatMap(frame => pipeline.process(frame).acoustic ?? [])
}

const byName = (name: string) => fixture.cases.find(testCase => testCase.name === name)!
const quality = (acoustic: Acoustic) => assessAudioQuality(acoustic.noiseFloorDb ?? null, acoustic.meanRmsDb, acoustic.durationMs, acoustic.clippingRatio ?? 0)

describe('실제 마이크 경로: 쉼 후 재개 frame 시나리오', () => {
  it.each(fixture.cases.map(testCase => [testCase.name, testCase] as const))('%s: 브라우저 요약이 서버 fixture와 같다', (_name, testCase) => {
    const acoustics = run(testCase)
    expect(acoustics).toHaveLength(testCase.utterances.length)
    expect(acoustics).toEqual(testCase.acoustics)
  })

  it('쉼과 후행 종료 유예의 무음이 신호 음량을 낮추지 않아 정상 재발성이 LOW_SNR이 되지 않는다', () => {
    const testCase = byName('natural_pause_restart')
    const [acoustic] = run(testCase)
    expect(acoustic.meanRmsDb).toBe(-40)
    expect(quality(acoustic).level).toBe('GOOD')
    // 이전 방식(발화 창 전체 frame 평균)이라면 약 2.2초 발성과 약 3.7초 무음이 섞여 LOW_SNR이 된다.
    const windowFrames = framesOf(testCase.segments).filter(frame => frame.tMs >= 1000 && frame.tMs < 1000 + 1100 + 1200 + 1100 + fixture.endHoldMs)
    const windowMean = windowFrames.reduce((sum, frame) => sum + frame.rmsDb, 0) / windowFrames.length
    expect(assessAudioQuality(-60, windowMean, 3400, 0).reasons).toContain('LOW_SNR')
  })

  it('발화 길이는 후행 종료 유예를 포함하지 않는다', () => {
    const [acoustic] = run(byName('no_restart'))
    expect(acoustic.durationMs).toBe(1100)
  })

  it('최대 인정 쉼은 발화 종료 유예보다 짧고, 그보다 긴 쉼은 발화를 나눈다', () => {
    const [low, high] = fixture.pauseRangeMs
    expect(high).toBeLessThan(fixture.endHoldMs)
    const [valid] = run(byName('max_valid_pause'))
    expect(valid.maxPauseMs).toBe(high)
    expect(valid.sustainSegmentsMs).toHaveLength(2)
    const [short] = run(byName('short_pause'))
    expect(short.maxPauseMs).toBeLessThan(low)
    const split = run(byName('pause_longer_than_grace'))
    expect(split).toHaveLength(2)
    expect(split.every(acoustic => acoustic.pauseCount === 0 && acoustic.sustainSegmentsMs?.length === 1)).toBe(true)
  })

  it('아주 짧은 소리는 음질 불량(평가 보류)이고, 무음만 있으면 발화를 보내지 않는다', () => {
    const [blip] = run(byName('short_blip_uncertain'))
    expect(quality(blip).reasons).toContain('TOO_SHORT')
    expect(run(byName('silence_no_utterance'))).toEqual([])
  })
})
