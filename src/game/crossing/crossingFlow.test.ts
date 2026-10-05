import { describe, expect, it } from 'vitest'
import { CrossingProgress, FASTEST_PACE, judgeOnset, nextPace, onsetReason, praiseLine, previewPlan, resultFromEvents, RETRY_LINE, retryLine, START_PACE, STRIPES, type PaceEvent } from './crossingFlow'

describe('대구대 건너기 진행', () => {
  it('미리보기 계획은 5라운드 × 2줄 = 10줄이고 1라운드만 두두가 먼저 들려준다', () => {
    const plan = previewPlan()
    expect(plan).toHaveLength(STRIPES)
    expect(plan.map(item => item.stripeIndex)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))
    expect(plan.map(item => item.itemIndexInRound)).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 1, 2])
    expect(plan.filter(item => item.modelCue).map(item => item.roundIndex)).toEqual([1, 1])
    expect(plan.filter(item => item.roundIndex === 4).every(item => item.level === 'word')).toBe(true)
    expect(previewPlan('word').slice(0, 6).every(item => item.level === 'word')).toBe(true)
  })

  it('성공이면 다음 줄, 다시는 3번까지, 불확실·무발화는 시도를 쓰지 않고 3번 연속이면 넘어간다', () => {
    const progress = new CrossingProgress(previewPlan())
    expect(progress.record('success')).toMatchObject({ advanced: true, next: { stripeIndex: 2 } })
    expect(progress.record('retry').advanced).toBe(false)
    expect(progress.triesLeft).toBe(2)
    expect(progress.record('uncertain').advanced).toBe(false)
    expect(progress.triesLeft).toBe(2)
    expect(progress.record('retry').advanced).toBe(false)
    expect(progress.record('retry')).toMatchObject({ advanced: true, next: { stripeIndex: 3 } })
    progress.record('no_speech'); progress.record('uncertain')
    expect(progress.record('no_speech')).toMatchObject({ advanced: true, next: { stripeIndex: 4 } })
  })

  it('끝까지 가면 다음 줄은 없다', () => {
    const progress = new CrossingProgress(previewPlan())
    for (let i = 0; i < 9; i++) progress.record('success')
    expect(progress.record('success')).toEqual({ advanced: true, next: null })
  })
})

describe('근사 판정과 서버 결과', () => {
  it('시작 마찰과 그 뒤 유성이 있으면 성공, 마찰 없이 시작하면 다시, 소리가 없거나 너무 짧으면 성공·실패가 아니다', () => {
    expect(judgeOnset({ activeMs: 400, durationMs: 450, onsetFricationMs: 150, voicedAfterFricationMs: 260 })).toBe('success')
    expect(judgeOnset({ activeMs: 400, durationMs: 450, onsetFricationMs: 0, voicedAfterFricationMs: 0 })).toBe('retry')
    expect(judgeOnset({ activeMs: 0 })).toBe('no_speech')
    expect(judgeOnset({ activeMs: 80, durationMs: 80 })).toBe('uncertain')
    expect(judgeOnset({ source: 'keyboard', durationMs: 400 })).toBe('success')
  })

  it('서버 사건 이름을 결과로 바꾼다', () => {
    expect(resultFromEvents([{ type: 'TARGET_SUCCESS' }, { type: 'REWARD' }])).toBe('success')
    expect(resultFromEvents([{ type: 'TARGET_RETRY' }])).toBe('retry')
    expect(resultFromEvents([{ type: 'NO_SPEECH' }, { type: 'LISTEN_AGAIN' }])).toBe('no_speech')
    expect(resultFromEvents([{ type: 'LISTEN_AGAIN' }])).toBe('uncertain')
  })
})

describe('속도', () => {
  it('최근 8번 중 7번 이상 성공하면 한 번에 하나씩 빨라지고, 가장 빠른 값에서 멈춘다', () => {
    const good: PaceEvent[] = Array(8).fill('success')
    let pace = START_PACE
    pace = nextPace(pace, good); expect(pace).toEqual({ approachMs: 4500, windowMs: 4000 })
    for (let i = 0; i < 20; i++) pace = nextPace(pace, good)
    expect(pace).toEqual(FASTEST_PACE)
  })
  it('2번 연속 어려우면 느려지고(시작값까지), 속도 올리기를 끄면 빨라지지 않는다', () => {
    expect(nextPace({ approachMs: 3000, windowMs: 2500 }, ['success', 'retry', 'miss'])).toEqual({ approachMs: 3500, windowMs: 3000 })
    expect(nextPace(START_PACE, ['retry', 'no_speech'])).toEqual(START_PACE)
    expect(nextPace(START_PACE, Array(8).fill('success'), false)).toEqual(START_PACE)
  })
  it('칭찬은 돌려 쓴다', () => {
    expect(new Set([0, 1, 2, 3].map(praiseLine)).size).toBe(4)
  })
})

/*
 * 사용자 실측(2026-10-05, Edge·PC 마이크) 중 판정 기준을 정한 줄. [표시, 길이, 시작 마찰, 마찰 뒤 유성, 평균 크기, 잡음]
 * 표시는 사용자가 고른 것이고, 일부는 일부러 틀리게 낸 소리다(docs/handoff/MIC_MEASUREMENT_2026-10-05.md).
 */
const MEASURED: [string, number, number, number, number, number, string][] = [
  ['#2 사', 880, 80, 357, -41.8, -67.2, 'success'],
  ['#8 사', 840, 78.8, 534, -43.3, -67.2, 'success'],
  ['#1 사(마찰 없음)', 2480, 0, 0, -38.1, -67.2, 'retry'],
  ['#3 사(마찰 없음)', 440, 0, 0, -34.9, -67.2, 'retry'],
  ['#6 사(바람 소리만)', 1659, 0, 0, -35.1, -67.2, 'retry'],
  ['#7 사(작음)', 1556, 0, 0, -57.9, -67.2, 'uncertain'],
  ['#9 다', 522, 0, 0, -32.6, -67.2, 'retry'],
  ['#10 다', 3479, 0, 0, -46.1, -67.2, 'retry'],
  ['#11 다', 758, 0, 0, -35.5, -67.2, 'retry'],
  ['#12 다', 440, 0, 0, -35.9, -67.2, 'retry'],
  ['#13 다', 401, 0, 0, -35.0, -67.2, 'retry'],
  ['#14 다', 1239, 0, 0, -43.6, -67.2, 'retry'],
  ['#15 스~ 뒤 모음', 5138, 1304, 276, -33.8, -67.2, 'success'],
  ['#20 스~(작음)', 1480, 0, 0, -58.5, -67.2, 'uncertain'],
  ['#21 스(마찰 60ms)', 360, 60, 218, -34.0, -63.5, 'retry'],
  ['#22 스(마찰 80ms)', 399, 79.9, 217, -35.5, -63.5, 'success'],
  ['#23 스(마찰 40ms)', 382, 40, 238, -37.3, -63.5, 'retry'],
  ['#27 스(마찰 99ms)', 460, 98.9, 297, -37.1, -63.5, 'success'],
  ['#30 스~(작음)', 279, 0, 0, -51.7, -63.5, 'uncertain'],
]

describe('실측 기준(2026-10-05)', () => {
  it.each(MEASURED)('%s → %s', (_label, durationMs, onsetFricationMs, voicedAfterFricationMs, meanRmsDb, noiseFloorDb, expected) => {
    expect(judgeOnset({ activeMs: durationMs, durationMs, onsetFricationMs, voicedAfterFricationMs, meanRmsDb, noiseFloorDb })).toBe(expected)
  })

  it('다·마찰 없음은 하나도 맞음이 되지 않고, 작게 말한 것은 틀림이 아니라 판단하지 않음이다', () => {
    const results = MEASURED.map(([label, durationMs, onset, voiced, rms, noise]) => ({ label, result: judgeOnset({ activeMs: durationMs, durationMs, onsetFricationMs: onset, voicedAfterFricationMs: voiced, meanRmsDb: rms, noiseFloorDb: noise }) }))
    expect(results.filter(entry => entry.label.includes('다') && entry.result === 'success')).toEqual([])
    expect(results.filter(entry => entry.label.includes('작음')).every(entry => entry.result === 'uncertain')).toBe(true)
  })

  it('다시일 때 단서는 무엇이 달랐는지에 맞춘다', () => {
    expect(onsetReason({ activeMs: 360, durationMs: 360, onsetFricationMs: 40, voicedAfterFricationMs: 200 })).toBe('short_frication')
    expect(retryLine('short_frication', '사')).toContain('길게')
    expect(retryLine('no_vowel', '사')).toContain('사')
    expect(retryLine('no_frication', '사')).toBe(RETRY_LINE)
    expect(retryLine(null, '사')).toBe(RETRY_LINE)
  })
})
