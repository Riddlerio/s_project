import { describe, expect, it } from 'vitest'
import { goodbyeLines } from './DuduGoodbye'

describe('두두 마무리 인사', () => {
  it('시도 횟수만 말하고, 받침에 맞춰 집 연습 낱말을 권하고, 고맙다고 인사한다', () => {
    const lines = goodbyeLines({ attempts: 18, word: '사과' })
    expect(lines[0]).toContain("'사' 소리를 18번")
    expect(lines[1]).toBe("집에서도 '사과'라고 말해 볼까?")
    expect(goodbyeLines({ word: '수박' })[1]).toBe("집에서도 '수박'이라고 말해 볼까?")
    expect(lines[2]).toContain('고마워')
    expect(lines.join(' ')).not.toMatch(/점수|정확|틀렸/)
  })
  it('시도가 없으면 횟수를 말하지 않는다', () => {
    expect(goodbyeLines({ attempts: 0 })[0]).toBe('오늘 나랑 대구대까지 건넜지!')
  })
})
