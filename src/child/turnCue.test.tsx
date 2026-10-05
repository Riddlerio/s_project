import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TURN_CUE_MS, turnCueWait } from './demoFx'
import { TurnCue } from './turnCue'

describe("'네 차례' 신호(2026-10-05 Phase 4)", () => {
  it('듣기가 열리면 가장자리 빛과 배지를 켜고, 배지는 읽기 도구에 알린다', () => {
    const html = renderToStaticMarkup(<TurnCue on />)
    expect(html).toContain('turn-glow on')
    expect(html).toContain('turn-badge on')
    expect(html).toContain('role="status"')
    expect(html).toContain('네 차례!')
    // 마이크 그림은 읽지 않는다.
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  it('듣기 전에는 빛·배지가 꺼져 있고 알림 자리만 남는다', () => {
    const html = renderToStaticMarkup(<TurnCue on={false} />)
    expect(html).not.toContain(' on"')
    expect(html).not.toContain('네 차례')
    expect(html).toContain('role="status"')
  })

  it('차임이 다 들린 뒤에 듣기를 연다: 기본 0.45초, 출력 지연만큼 더, 1초를 넘기지 않음', () => {
    expect(TURN_CUE_MS).toBe(450)
    for (const latency of [undefined, 0, -1, Number.NaN]) expect(turnCueWait(latency)).toBe(TURN_CUE_MS)
    expect(turnCueWait(0.2)).toBe(650)
    expect(turnCueWait(5)).toBe(1000)
  })
})
