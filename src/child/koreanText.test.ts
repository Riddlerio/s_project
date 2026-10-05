import { describe, expect, it } from 'vitest'
import { callName, hasFinalConsonant, isName } from './koreanText'

describe('이름 조사', () => {
  it('받침이 있으면 아/이야, 없으면 야/야', () => {
    expect(hasFinalConsonant('민준')).toBe(true)
    expect(hasFinalConsonant('두두친구')).toBe(false)
    expect(callName('민준')).toBe('민준아')
    expect(callName('바람용사')).toBe('바람용사야')
    expect(isName('민준')).toBe('민준이야')
    expect(isName('두두친구')).toBe('두두친구야')
  })
  it('한글이 아니거나 비어 있으면 받침이 없는 것으로 본다', () => {
    expect(hasFinalConsonant('Leo')).toBe(false)
    expect(hasFinalConsonant('')).toBe(false)
  })
})
