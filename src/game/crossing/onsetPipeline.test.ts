import { describe, expect, it } from 'vitest'
import { MicUtterancePipeline } from '../../speech/micUtterance'
import type { Acoustic } from '../../shared/types'
import type { VadFrame } from '../../speech/vad'
import { OnsetPipeline, preRollFrames } from './onsetPipeline'

// 잡음 -60dB. 조용한 /ㅅ/(잡음+9dB, 고주파): 마찰음 판정(6dB)은 되지만 발화 감지(12dB) 전. 모음은 크고 저주파.
const silence = (t: number): VadFrame => ({ tMs: t, rmsDb: -60, hfRatio: 0.1, spectralCentroidHz: 800 })
const s = (t: number): VadFrame => ({ tMs: t, rmsDb: -51, hfRatio: 0.55, spectralCentroidHz: 5000 })
const vowel = (t: number): VadFrame => ({ tMs: t, rmsDb: -32, hfRatio: 0.08, spectralCentroidHz: 900 })

/** 보정 1초 + 쉼 + '사'(ㅅ 160ms, 아 300ms) + 쉼 */
function sa(): VadFrame[] {
  const frames: VadFrame[] = []
  let t = 0
  const add = (make: (t: number) => VadFrame, ms: number) => { for (let i = 0; i < ms; i += 20) { frames.push(make(t)); t += 20 } }
  add(silence, 1300); add(s, 160); add(vowel, 300); add(silence, 1200)
  return frames
}

function run(pipeline: { process(frame: VadFrame): { acoustic?: Acoustic } }, frames: VadFrame[]) {
  let acoustic: Acoustic | undefined
  for (const frame of frames) acoustic = pipeline.process(frame).acoustic ?? acoustic
  return acoustic
}

describe('대구대 건너기 발화 요약', () => {
  it('조용한 /ㅅ/로 시작한 "사"에서 공용 경로는 시작 마찰을 놓치지만, 이 경로는 되살린다', () => {
    const shared = run(new MicUtterancePipeline('any_sound'), sa())
    const onset = run(new OnsetPipeline(), sa())
    expect(shared?.onsetFricationMs ?? 0).toBe(0)
    expect(onset?.onsetFricationMs).toBeGreaterThanOrEqual(140)
    expect(onset?.voicedAfterFricationMs).toBeGreaterThanOrEqual(240)
  })

  it('마찰 없이 시작한 "다"(모음만)는 시작 마찰이 0이다', () => {
    const frames = sa().map(frame => frame.hfRatio === 0.55 ? silence(frame.tMs) : frame)
    const onset = run(new OnsetPipeline(), frames)
    expect(onset?.onsetFricationMs ?? 0).toBe(0)
    expect(onset?.activeMs).toBeGreaterThan(0)
  })

  it("조용한 '스~'(잡음+10dB 마찰만)는 공용 기준으로는 시작조차 안 되지만 이 경로는 잡는다", () => {
    const frames: VadFrame[] = []
    let t = 0
    const add = (make: (t: number) => VadFrame, ms: number) => { for (let i = 0; i < ms; i += 20) { frames.push(make(t)); t += 20 } }
    const quietS = (time: number): VadFrame => ({ tMs: time, rmsDb: -50, hfRatio: 0.55, spectralCentroidHz: 5200 })
    add(silence, 1300); add(quietS, 600); add(silence, 1200)
    expect(run(new MicUtterancePipeline('any_sound'), frames)).toBeUndefined()
    const onset = run(new OnsetPipeline(), frames)
    expect(onset?.onsetFricationMs).toBeGreaterThanOrEqual(500)
  })

  it('앞부분은 연속된 마찰과 감지 대기 구간만, 최대 0.4초까지 가져온다', () => {
    const history = [silence(0), s(20), silence(40), silence(60), s(80), s(100), silence(120), s(140), s(160)]
    expect(preRollFrames(history, 180, -60).map(frame => frame.tMs)).toEqual([80, 100, 120, 140, 160])
    const long = Array.from({ length: 40 }, (_, i) => s(i * 20))
    const kept = preRollFrames(long, 2000, -60)
    expect(kept.at(-1)!.tMs - kept[0].tMs).toBeLessThanOrEqual(400)
  })
})
