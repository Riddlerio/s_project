import { describe, expect, it } from 'vitest'
import { BEAM_CHAPTERS, beamChapter, beamVisualState } from './sceneState'

describe('빛의 마법의 시각 상태', () => {
  it('기존 다섯 라운드 순서에 맞는 장면만 고른다', () => {
    expect(BEAM_CHAPTERS).toHaveLength(5)
    expect(beamChapter(1).title).toContain('아침')
    expect(beamChapter(2).title).toContain('참새')
    expect(beamChapter(3).title).toContain('반딧불')
    expect(beamChapter(4).title).toContain('바람')
    expect(beamChapter(5).title).toContain('등불')
  })
  it.each([0, -2, NaN, Infinity])('잘못된 라운드 %s는 첫 장면으로 제한한다', index => {
    expect(beamChapter(index)).toBe(BEAM_CHAPTERS[0])
  })
  it('마지막 라운드를 넘어도 새 치료 과제를 만들지 않는다', () => {
    expect(beamChapter(99)).toBe(BEAM_CHAPTERS[4])
  })
  it('지속시간과 서버 목표시간으로만 빛의 길이를 정한다', () => {
    expect(beamVisualState('BEAM', { active: true, durationMs: 750 }, 1500).progress).toBe(0.5)
    expect(beamVisualState('BEAM', { active: true, durationMs: 3000 }, 1500).progress).toBe(1)
    expect(beamVisualState('BEAM', { active: true, durationMs: -10 }, 1500).progress).toBe(0)
    expect(beamVisualState('BEAM', { active: true, durationMs: NaN }, 1500).progress).toBe(0)
    expect(beamVisualState('BEAM', { active: true, durationMs: 500 }, 0).progress).toBe(1)
  })
  it.each(['LISTENING', 'CHARGE', 'BEAM'] as const)('%s 중에는 캐릭터와 환경 움직임을 멈춘다', action => {
    expect(beamVisualState(action, { active: false, durationMs: 500 }, 1500).quiet).toBe(true)
  })
  it('입력 중·일시정지·움직임 줄이기는 성공 동작보다 우선한다', () => {
    expect(beamVisualState('CHEER', { active: true, durationMs: 500 }, 1500).quiet).toBe(true)
    expect(beamVisualState('CHEER', { active: false, durationMs: 500 }, 1500, true).quiet).toBe(true)
    expect(beamVisualState('CHEER', { active: false, durationMs: 500 }, 1500, false, true).quiet).toBe(true)
  })
  it('빛의 길이가 가득 차도 성공·보상·임상 판정을 만들지 않는다', () => {
    const state = beamVisualState('BEAM', { active: true, durationMs: 5000 }, 1000)
    expect(Object.keys(state).sort()).toEqual(['progress', 'quiet', 'showBeam'])
  })
  it('새 시도·일시정지·재안내 때 이전 빛을 남기지 않는다', () => {
    expect(beamVisualState('LISTENING', { active: false, durationMs: 1000 }, 1500).showBeam).toBe(false)
    expect(beamVisualState('BEAM', { active: true, durationMs: 1000 }, 1500, false, true).showBeam).toBe(false)
    expect(beamVisualState('CHARGE', { active: true, durationMs: 0 }, 1500).showBeam).toBe(false)
  })
})
