import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MagicBeamScene } from './MagicBeamScene'

describe('빛의 마법 장면의 대체 화면', () => {
  it.each([1, 2, 3, 4, 5])('WebGL 없는 환경에서도 %s라운드와 재료 안내를 유지한다', roundIndex => {
    const html = renderToStaticMarkup(<MagicBeamScene action="LISTENING" roundIndex={roundIndex} />)
    expect(html).toContain(`data-beam-round="${roundIndex}"`)
    expect(html).toContain('data-hoya-fallback="true"')
    expect(html).toContain('게임은 그대로 할 수 있어요')
    expect(html).toContain('2·4라운드에 밥')
    expect(html).toContain('발음 점수가 아니에요')
    expect(html).not.toContain('<canvas')
  })
  it('불확실·무발화 안내 때 실패·보상 연출을 만들지 않는다', () => {
    const html = renderToStaticMarkup(<MagicBeamScene action="LISTENING" fx={{ id: 1, result: 'none', attack: 'basic' }} />)
    expect(html).not.toMatch(/실패|틀렸|fx-stars|fx-grains/)
  })
})
