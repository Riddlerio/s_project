import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { hasPicture, picturedWords, PICTURE_WORDS, WordPicture } from './WordPicture'

describe('목표 낱말 그림', () => {
  it('대화·건너기에 나오는 /ㅅ/ 낱말마다 그림이 있다', () => {
    for (const word of ['사과', '수박', '사자', '시소', '소리', '소풍']) expect(hasPicture(word)).toBe(true)
    expect(hasPicture('사')).toBe(false)
    expect(PICTURE_WORDS.length).toBe(6)
  })

  it('두두 말에 나온 순서대로 고르고 최대 3개', () => {
    expect(picturedWords('사과가 좋아, 수박이 좋아?')).toEqual(['사과', '수박'])
    expect(picturedWords('수박이 좋아, 사과가 좋아?')).toEqual(['수박', '사과'])
    expect(picturedWords('안녕~ 만나서 반가워!')).toEqual([])
    expect(picturedWords('사과 수박 사자 시소')).toHaveLength(3)
  })

  it('그림은 읽기 도구에 낱말 이름으로 알리고, 그림이 없으면 그리지 않는다', () => {
    expect(renderToStaticMarkup(<WordPicture word="사과" />)).toContain('aria-label="사과 그림"')
    expect(renderToStaticMarkup(<WordPicture word="사" />)).toBe('')
  })
})
