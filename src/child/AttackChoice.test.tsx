import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AttackChoice } from './AttackChoice'

const render = (magicBeam: boolean, value: 'basic' | 'magic_beam' = 'basic') =>
  renderToStaticMarkup(<AttackChoice value={value} magicBeam={magicBeam} disabled={false} onChange={() => undefined} />)

describe('몬스터 모험 공격 선택 카드', () => {
  it('이번 라운드에 쓸 수 없는 매직빔은 고를 수 없고 벌처럼 표현하지 않는다', () => {
    const html = render(false)
    expect(html.match(/disabled=""/g)).toHaveLength(1)
    expect(html).toContain('선생님과 함께 열어요')
    expect(html).toContain('기본 공격으로도 끝까지 갈 수 있어요')
    expect(html).not.toMatch(/실패|벌|못 해/)
  })
  it('쓸 수 있으면 두 카드를 모두 고를 수 있고 선택 상태를 표시한다', () => {
    const html = render(true, 'magic_beam')
    expect(html).not.toContain('disabled=""')
    expect(html).toContain('dudu-tool-beam selected')
    expect(html).toContain('선생님이 열어 준 힘')
  })
})
