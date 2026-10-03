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
