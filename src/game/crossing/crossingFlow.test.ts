import { describe, expect, it } from 'vitest'
import { CrossingProgress, FASTEST_PACE, judgeOnset, nextPace, praiseLine, previewPlan, resultFromEvents, START_PACE, STRIPES, type PaceEvent } from './crossingFlow'

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
