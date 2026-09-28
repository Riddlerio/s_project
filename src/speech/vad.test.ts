import { describe, expect, it } from 'vitest'
import { VadStateMachine } from './vad'

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
