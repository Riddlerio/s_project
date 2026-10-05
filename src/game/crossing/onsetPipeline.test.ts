import { describe, expect, it } from 'vitest'
import { MicUtterancePipeline } from '../../speech/micUtterance'
import type { Acoustic } from '../../shared/types'
import type { VadFrame } from '../../speech/vad'
import { SustainTracker } from '../../speech/sustainTracker'
import { judgeOnset, onsetReason } from './crossingFlow'
import { ONSET_TOLERANCE, OnsetPipeline, preRollFrames } from './onsetPipeline'

// 잡음 -60dB. 조용한 /ㅅ/(잡음+9dB, 고주파): 마찰음 판정(6dB)은 되지만 발화 감지(12dB) 전. 모음은 크고 저주파.
const silence = (t: number): VadFrame => ({ tMs: t, rmsDb: -60, hfRatio: 0.1, spectralCentroidHz: 800 })
const s = (t: number): VadFrame => ({ tMs: t, rmsDb: -51, hfRatio: 0.55, spectralCentroidHz: 5000 })
const vowel = (t: number): VadFrame => ({ tMs: t, rmsDb: -32, hfRatio: 0.08, spectralCentroidHz: 900 })
// 마찰 직전의 숨·입술 소리(마찰도 유성도 아님)와 크게 낸 /ㅅ/.
const breath = (t: number): VadFrame => ({ tMs: t, rmsDb: -45, hfRatio: 0.15, spectralCentroidHz: 2500 })
const loudS = (t: number): VadFrame => ({ tMs: t, rmsDb: -40, hfRatio: 0.55, spectralCentroidHz: 6000 })

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

  it('마찰 직전 숨소리 한 프레임 때문에 길게 낸 스~의 시작 마찰이 0이 되던 문제(실측)를 이 게임에서만 봐준다', () => {
    const frames = [breath(0), ...Array.from({ length: 75 }, (_, i) => loudS((i + 1) * 20))]
    const strict = new SustainTracker('any_sound', -60)
    const tolerant = new SustainTracker('any_sound', -60, ONSET_TOLERANCE)
    for (const frame of frames) { strict.process(frame); tolerant.process(frame) }
    expect(strict.onsetFricationMs).toBe(0)
    expect(tolerant.onsetFricationMs).toBeGreaterThanOrEqual(1400)
    // 모음이 없으니 '사'로는 맞음이 아니다(바람 소리만).
    expect(tolerant.voicedAfterFricationMs).toBe(0)
  })

  it('봐주는 범위는 앞 40ms·도중 20ms뿐이다: 다(터짐+모음)는 여전히 0, 마찰 도중 한 프레임 꺼짐은 이어서 센다', () => {
    const da = new SustainTracker('any_sound', -60, ONSET_TOLERANCE)
    for (const frame of [breath(0), ...Array.from({ length: 15 }, (_, i) => vowel((i + 1) * 20))]) da.process(frame)
    expect(da.onsetFricationMs).toBe(0)
    const dip = (t: number): VadFrame => ({ tMs: t, rmsDb: -52, hfRatio: 0.2, spectralCentroidHz: 2500 })
    const frames = [loudS(0), loudS(20), loudS(40), dip(60), loudS(80), loudS(100), vowel(120), vowel(140)]
    const strict = new SustainTracker('any_sound', -60)
    const tolerant = new SustainTracker('any_sound', -60, ONSET_TOLERANCE)
    for (const frame of frames) { strict.process(frame); tolerant.process(frame) }
    expect(strict.onsetFricationMs).toBe(60)
    expect(tolerant.onsetFricationMs).toBe(100)
    expect(tolerant.voicedAfterFricationMs).toBe(40)
  })

  it('바른 사(숨소리 뒤 마찰 160ms + 모음)는 맞음, 차처럼 짧은 마찰(40ms) 뒤 모음은 다시, 작게 말한 소리는 판단하지 않는다', () => {
    const utterance = (...parts: [(t: number) => VadFrame, number][]) => {
      const frames: VadFrame[] = []
      let t = 0
      for (const [make, ms] of [[silence, 1300], ...parts, [silence, 1200]] as [(t: number) => VadFrame, number][]) for (let i = 0; i < ms; i += 20) { frames.push(make(t)); t += 20 }
      return run(new OnsetPipeline(), frames)!
    }
    const sa = utterance([breath, 20], [loudS, 160], [vowel, 300])
    expect(judgeOnset(sa)).toBe('success')
    const cha = utterance([breath, 20], [loudS, 40], [vowel, 300])
    expect(onsetReason(cha)).toBe('short_frication')
    expect(judgeOnset(cha)).toBe('retry')
    const quiet = utterance([(t: number) => ({ tMs: t, rmsDb: -50, hfRatio: 0.08, spectralCentroidHz: 900 }), 400])
    expect(onsetReason(quiet)).toBe('quiet')
    expect(judgeOnset(quiet)).toBe('uncertain')
  })
})
