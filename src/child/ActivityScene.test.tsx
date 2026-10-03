import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('../tiger/Hoya3D', () => ({ Hoya3D: () => <span>두두 시제품</span> }))
import { ActivityScene, RoundFeedback } from './ActivityScene'

describe('승인된 첫 소풍 데모 장면', () => {
  it('음식 두 장면에만 해당 재료를 안내한다', () => {
    expect(renderToStaticMarkup(<ActivityScene game="magic_beam" action="IDLE" />)).toContain('2·4라운드에 밥')
    expect(renderToStaticMarkup(<ActivityScene game="monster_adventure" action="IDLE" />)).toContain('2·4라운드에 참치')
    expect(renderToStaticMarkup(<ActivityScene game="sky_climb" action="IDLE" />)).not.toContain('라운드에')
    expect(renderToStaticMarkup(<ActivityScene game="conversation_quest" action="IDLE" />)).not.toContain('라운드에')
  })
  it('기본 선택에는 승인 매직빔 효과를 표시하지 않는다', () => {
    expect(renderToStaticMarkup(<ActivityScene game="monster_adventure" action="ATTACK" />)).not.toContain('승인된 매직빔')
    expect(renderToStaticMarkup(<ActivityScene game="monster_adventure" action="ATTACK" magicBeam />)).toContain('승인된 매직빔')
  })
  it('서버의 별·칭찬·재료를 표시하고 발음 정확도로 표현하지 않는다', () => {
    const html = renderToStaticMarkup(<RoundFeedback stars={1} praise="조금만 더 노력해보자!" material="rice" />)
    expect(html).toContain('참여 별 1개')
    expect(html).toContain('조금만 더 노력해보자!')
    expect(html).toContain('밥 1개')
    expect(html).not.toContain('정확도')
  })
})

describe('장면 효과와 공격 선택', () => {
  it('서버 결과의 공격 종류에 맞는 효과만 보여 준다', () => {
    const beam = renderToStaticMarkup(<ActivityScene game="monster_adventure" action="ATTACK" fx={{ id: 1, result: 'hit', attack: 'magic_beam', stars: 3, material: 'tuna' }} />)
    expect(beam).toContain('fx-beam')
    expect(beam).toContain('반짝!')
    expect(beam).toContain('fx-loot')
    const basic = renderToStaticMarkup(<ActivityScene game="monster_adventure" action="ATTACK" fx={{ id: 2, result: 'hit', attack: 'basic' }} />)
    expect(basic).toContain('첨벙!')
    expect(basic).not.toContain('fx-beam')
    expect(basic).not.toContain('fx-loot')
  })
  it('다시 해보기는 실패 표시 없이 잔잔한 물결만 보여 준다', () => {
    const html = renderToStaticMarkup(<ActivityScene game="monster_adventure" action="ENCOURAGE" fx={{ id: 3, result: 'retry', attack: 'basic' }} />)
    expect(html).toContain('fx-ripple')
    expect(html).not.toMatch(/실패|틀렸|fx-word/)
  })
})
