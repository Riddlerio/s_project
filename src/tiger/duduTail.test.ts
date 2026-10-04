import { Bone, Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { attachDuduTail, swayDuduTail } from './duduTail'

describe('두두 꼬리', () => {
  it('엉덩이 뼈에 붙고, 붙인 뒤에도 쉬는 자세의 뿌리 위치를 지킨다', () => {
    const root = new Group()
    const hips = new Bone(); hips.name = 'mixamorigHips'; hips.position.set(0, -1.07, 0); hips.scale.setScalar(0.01)
    root.add(hips)
    const tail = attachDuduTail(root)!
    expect(tail).not.toBeNull()
    const pivot = hips.children.find(child => child.name === 'dudu-tail')!
    expect(pivot).toBeDefined()
    root.updateMatrixWorld(true)
    const at = pivot.getWorldPosition(new Vector3())
    expect(at.x).toBeCloseTo(0.42, 5); expect(at.y).toBeCloseTo(-1.22, 5); expect(at.z).toBeCloseTo(-0.22, 5)
    // 엉덩이가 움직이면 꼬리도 따라간다.
    hips.position.x += 0.5
    root.updateMatrixWorld(true)
    expect(pivot.getWorldPosition(new Vector3()).x).toBeCloseTo(0.92, 5)
    tail.dispose()
    expect(hips.children).toHaveLength(0)
  })

  it('엉덩이 뼈가 없으면 붙이지 않는다', () => {
    expect(attachDuduTail(new Group())).toBeNull()
  })

  it('신나는 동작에서 더 크게 흔든다', () => {
    const root = new Group(); const hips = new Bone(); hips.name = 'Hips'; root.add(hips)
    const tail = attachDuduTail(root)!
    const swing = (lively: boolean) => Math.max(...[0.2, 0.4, 0.6, 0.8, 1].map(t => { swayDuduTail(tail, t, lively); return Math.abs(tail.swing.rotation.y) }))
    expect(swing(true)).toBeGreaterThan(swing(false))
    expect(swing(false)).toBeLessThanOrEqual(0.07)
  })
})
