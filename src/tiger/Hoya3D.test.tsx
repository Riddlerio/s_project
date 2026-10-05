import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { canUseWebGL, Hoya3D, HoyaErrorBoundary, HoyaFallback } from './Hoya3D'
import type { HoyaAction } from '../control/speechGameSignal'

const doc = (getContext: (kind: string) => unknown) => ({ createElement: () => ({ getContext }) })

describe('두두 3D 대체 화면', () => {
  it.each<HoyaAction>(['IDLE', 'LISTENING', 'TALKING', 'CHARGE', 'BEAM', 'RELEASE', 'FLY', 'LAND',
    'CAST', 'ATTACK', 'WALK_TO', 'PICK_UP', 'PUT_IN_BAG', 'WAVE', 'CHEER', 'ENCOURAGE', 'THINKING'])(
    '%s 대체 화면은 두두 이름으로 안내한다', action => {
      const html = renderToStaticMarkup(<HoyaFallback action={action} />)
      expect(html).toContain('두두')
      expect(html).not.toContain('호야')
      expect(html).not.toContain('루미')
      expect(html).not.toContain('3D')
    })

  it('WebGL 컨텍스트를 만들 수 없으면 사용할 수 없다고 판단한다', () => {
    expect(canUseWebGL(doc(() => null))).toBe(false)
    expect(canUseWebGL(doc(() => { throw new Error('GPU') }))).toBe(false)
    expect(canUseWebGL(doc(kind => kind === 'webgl' ? {} : null))).toBe(true)
    expect(canUseWebGL(undefined)).toBe(false)
  })

  it('대체 화면은 3D라고 표시하지 않고 게임을 계속할 수 있다고 안내한다', () => {
    const html = renderToStaticMarkup(<HoyaFallback action="BEAM" />)
    expect(html).toContain('간단한 대체 화면')
    expect(html).toContain('게임은 그대로 할 수 있어요')
    expect(html).toContain('빛을 쏘고')
    expect(html).not.toContain('3D')
  })

  it('WebGL이 없는 환경에서는 Canvas 대신 대체 화면을 그린다', () => {
    expect(renderToStaticMarkup(<Hoya3D action="IDLE" />)).toContain('data-hoya-fallback="true"')
  })

  it('3D 장면 오류가 나면 경계가 대체 화면으로 바꾼다', () => {
    expect(HoyaErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true })
    const boundary = new HoyaErrorBoundary({ fallback: <HoyaFallback />, children: <span>3D</span> })
    boundary.state = { failed: true }
    expect(renderToStaticMarkup(<>{boundary.render()}</>)).toContain('data-hoya-fallback="true"')
    boundary.state = { failed: false }
    expect(renderToStaticMarkup(<>{boundary.render()}</>)).toBe('<span>3D</span>')
  })

  it('Case 10: WebGL이 없어도 THINKING은 "두두가 생각하고 있어요"로 보여 준다', () => {
    const html = renderToStaticMarkup(<Hoya3D action="THINKING" />)
    expect(html).toContain('data-hoya-fallback="true"')
    expect(html).toContain('두두가 생각하고 있어요')
  })
})
