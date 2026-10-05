import { Bone, Group } from 'three'
import { describe, expect, it } from 'vitest'
import { applyHeadPerk, createPerkClock, findHeadBone, PERK_MS, perkLevel } from './duduPerk'

describe("두두 귀 쫑긋('네 차례')", () => {
  it('듣기 시작 뒤 한 번 올랐다 내려오고, 차임 동안(0.45초 안)에 끝난다', () => {
    expect(PERK_MS).toBeLessThan(450)
    expect(perkLevel(0)).toBe(0)
    expect(perkLevel(PERK_MS / 2)).toBeCloseTo(1)
    expect(perkLevel(PERK_MS)).toBe(0)
    for (const value of [-1, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) expect(perkLevel(value)).toBe(0)
  })

  it('LISTENING으로 바뀔 때만 시작하고, 움직임 줄이기에서는 하지 않는다', () => {
    let now = 0
    const perk = createPerkClock(() => now)
    expect(perk('TALKING', false)).toBe(0)
    expect(perk('LISTENING', false)).toBe(0)
    now = PERK_MS / 2
    expect(perk('LISTENING', false)).toBeCloseTo(1)
    now = PERK_MS + 10
    expect(perk('LISTENING', false)).toBe(0)
    // 다른 동작을 거쳐 다시 듣기로 오면 다시 쫑긋한다.
    perk('TALKING', false)
    expect(perk('LISTENING', false)).toBe(0)
    now += PERK_MS / 2
    expect(perk('LISTENING', false)).toBeCloseTo(1)
    const still = createPerkClock(() => now)
    still('IDLE', true)
    expect(still('LISTENING', true)).toBe(0)
    now += PERK_MS / 2
    expect(still('LISTENING', false)).toBe(0)
  })

  it('모델 파일의 머리 뼈를 찾아 위로 늘였다가 원래 크기로 돌린다', () => {
    const root = new Group()
    const hips = new Bone(); hips.name = 'mixamorig:Hips'
    const head = new Bone(); head.name = 'mixamorig:Head'
    const top = new Bone(); top.name = 'mixamorig:HeadTop_End'
    root.add(hips); hips.add(head); head.add(top)
    expect(findHeadBone(root)).toBe(head)
    applyHeadPerk(head, 1)
    expect(head.scale.y).toBeCloseTo(1.15)
    expect(head.scale.x).toBeLessThan(1)
    applyHeadPerk(head, 0)
    expect(head.scale.toArray()).toEqual([1, 1, 1])
    expect(() => applyHeadPerk(null, 1)).not.toThrow()
  })
})
