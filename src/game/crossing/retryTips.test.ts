import { describe, expect, it } from 'vitest'
import { firstVowel, MISS_TIP, retryTip } from './retryTips'

describe('틀렸을 때 도움말', () => {
  it('첫 글자의 모음에 맞춰 입 모양을 안내한다', () => {
    expect(firstVowel('사과')).toMatchObject({ syllable: '사', name: '아', mouth: 'a' })
    expect(firstVowel('소리')).toMatchObject({ syllable: '소', name: '오', mouth: 'o' })
    expect(firstVowel('수박')).toMatchObject({ syllable: '수', name: '우', mouth: 'u' })
    expect(firstVowel('시소')).toMatchObject({ syllable: '시', name: '이', mouth: 'i' })
    expect(firstVowel('해')).toMatchObject({ name: '모음' })
  })

  it('이유마다 다른 도움말을 준다', () => {
    expect(retryTip('no_frication', '사과')?.mouth).toBe('teeth')
    expect(retryTip('short_frication', '사과')?.body).toContain('스~아 → 사')
    expect(retryTip('no_vowel', '수박')?.body).toContain("입술을 앞으로 쭉 내밀어 '우'까지")
    expect(retryTip('quiet', '사')?.body).toContain('틀린 게 아니에요')
  })

  it('맞음·무발화·이유를 모를 때는 도움말이 없다', () => {
    expect(retryTip('ok', '사')).toBeNull()
    expect(retryTip('no_speech', '사')).toBeNull()
    expect(retryTip(null, '사')).toBeNull()
  })

  it('도움말은 실패를 말하지 않는다', () => {
    const tips = ['no_frication', 'short_frication', 'no_vowel', 'quiet', 'too_short', 'poor_audio'].map(reason => retryTip(reason as never, '사과'))
    for (const tip of [...tips, MISS_TIP]) expect(`${tip?.title} ${tip?.body}`).not.toMatch(/틀렸|실패|못했/)
  })
})
