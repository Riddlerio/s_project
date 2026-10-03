import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
vi.mock('../tiger/Hoya3D', () => ({ Hoya3D: () => <span>두두 시제품</span> }))
import { PantryView } from './CharacterHome'
import { AdventureRewardDetails } from './RewardScreen'

describe('한 가지 초밥 제작과 회기 보상', () => {
  it('가방을 읽기 전에는 보유량을 만들거나 제작 버튼을 열지 않는다', () => {
    const html = renderToStaticMarkup(<PantryView bag={null} busy={false} onCraft={() => undefined} />)
    expect(html).not.toContain('<button')
    expect(html).toContain('소풍 가방을 확인')
  })
  it.each([[0, 1, true], [1, 0, true], [1, 1, false]] as const)('밥%d 참치%d일 때 제작 차단=%s', (rice, tuna, disabled) => {
    const html = renderToStaticMarkup(<PantryView bag={{ inventory: { rice, tuna }, crafted: { tunaSushi: 0 } }} busy={false} onCraft={() => undefined} />)
    expect(html.includes('disabled=""')).toBe(disabled)
    expect(html).toContain('밥 1개 + 참치 1개')
  })
  it('이번 회기 재료와 게임 별을 임상 점수로 표시하지 않는다', () => {
    const html = renderToStaticMarkup(<MemoryRouter><AdventureRewardDetails result={{ totalXp: 10, heroLevel: 1, badges: [], monsterCards: [],
      roundStars: [{ index: 1, stars: 1, praise: '조금만 더 노력해보자!', successRate: null }], materialsEarned: { rice: 2, tuna: 0 } }} /></MemoryRouter>)
    expect(html).toContain('이번 모험에서 모은 재료')
    expect(html).toContain('밥 2개')
    expect(html).not.toContain('참치 0개')
    expect(html).not.toContain('정확도')
    expect(html).toContain('별은 임상 평가와 별도')
  })
})
