import { describe, expect, it } from 'vitest'
import { DEFAULT_VAD, VadStateMachine, type VadEvent } from './vad'

describe('발화 후 기다림', () => {
  it('짧은 쉼 뒤 재발화를 같은 발화에 합친다', () => {
    const vad = new VadStateMachine()
    vad.calibrate([-60])
    const frame = (tMs: number, rmsDb: number) => vad.process({ tMs, rmsDb, hfRatio: 0.4 })
    frame(0, -20); frame(20, -20); frame(40, -20); frame(60, -20)
    frame(80, -20)
    frame(100, -60)
    expect(frame(500, -60).some(event => event.type === 'VOICE_END')).toBe(false)
    frame(620, -20)
    frame(700, -60)
    expect(frame(1300, -60).some(event => event.type === 'VOICE_END')).toBe(false)
    expect(frame(1400, -60).some(event => event.type === 'VOICE_END')).toBe(true)
  })
})

describe('쉼 후 재개 라운드의 발화 종료 유예', () => {
  const feed = (vad: VadStateMachine, from: number, to: number, rmsDb: number) => {
    const events: VadEvent[] = []
    for (let t = from; t < to; t += 20) events.push(...vad.process({ tMs: t, rmsDb, hfRatio: 0.4 }))
    return events
  }
  const make = (endHoldMs: number) => {
    const vad = new VadStateMachine({ ...DEFAULT_VAD, endHoldMs })
    vad.calibrate([-60])
    return vad
  }

  it('기본 유예(700ms)에서는 1.2초 쉼이 발화를 끝낸다', () => {
    const vad = make(DEFAULT_VAD.endHoldMs)
    feed(vad, 0, 1100, -20)
    expect(feed(vad, 1100, 2300, -60).some(event => event.type === 'VOICE_END')).toBe(true)
  })

  it('2.5초 유예에서는 자연스러운 쉼(1.2초) 뒤 재개가 한 발화로 이어진다', () => {
    const vad = make(2500)
    feed(vad, 0, 1100, -20)
    expect(feed(vad, 1100, 2300, -60).some(event => event.type === 'VOICE_END')).toBe(false)
    expect(feed(vad, 2300, 3400, -20).some(event => event.type === 'VOICE_END')).toBe(false)
    const end = feed(vad, 3400, 6200, -60).find(event => event.type === 'VOICE_END')
    // 두 발성과 그 사이 쉼을 포함하고, 끝의 종료 유예 무음은 길이에 넣지 않는다.
    expect(end?.durationMs).toBe(3400)
    expect(end?.meanRmsDb).toBe(-20)
  })

  it('유예보다 긴 쉼은 발화를 끝내고, 이후 소리는 새 발화로 시작한다', () => {
    const vad = make(2500)
    feed(vad, 0, 1100, -20)
    expect(feed(vad, 1100, 3800, -60).some(event => event.type === 'VOICE_END')).toBe(true)
    expect(feed(vad, 3800, 4200, -20).some(event => event.type === 'VOICE_START')).toBe(true)
  })
})
