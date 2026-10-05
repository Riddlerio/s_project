import { Group } from 'three'
import { describe, expect, it } from 'vitest'
import type { HoyaAction } from '../control/speechGameSignal'
import { attachDuduFace, faceState } from './duduFace'

const ACTIONS: HoyaAction[] = ['IDLE', 'LISTENING', 'TALKING', 'CHARGE', 'BEAM', 'RELEASE', 'FLY', 'LAND', 'CAST', 'ATTACK',
  'WALK_TO', 'PICK_UP', 'PUT_IN_BAG', 'WAVE', 'CHEER', 'ENCOURAGE', 'THINKING']

describe('두두 표정', () => {
  it('평소에는 눈을 뜨고, 몇 초마다 짧게 깜박인다', () => {
    expect(faceState('IDLE', 1, true).eyes).toBe('open')
    expect(faceState('IDLE', 2.5, true).eyes).toBe('closed')
    expect(faceState('IDLE', 2.7, true).eyes).toBe('open')
    // 0~15초 중 감은 시간은 짧다(깜박임 4번 × 0.13초).
    let closed = 0
    for (let t = 0; t < 15.2; t += 0.01) if (faceState('IDLE', t, true).eyes === 'closed') closed++
    expect(closed * 0.01).toBeGreaterThan(0.4)
    expect(closed * 0.01).toBeLessThan(0.7)
  })

  it('정지 장면에서는 깜박이지 않고 말하는 입도 움직이지 않는다', () => {
    for (const action of ACTIONS) {
      for (const t of [0, 2.5, 6.6, 9.9]) expect(faceState(action, t, false).eyes).not.toBe('closed')
    }
    expect(faceState('TALKING', 1.3, false).mouth).toBe(0)
  })

  it('두두 음성 파일로 말하면 입이 소리 크기를 따르고, 문장 사이 쉼에서는 닫힌다', () => {
    expect(faceState('TALKING', 0.4, true, 0.9).mouth).toBeCloseTo(0.9)
    expect(faceState('TALKING', 0.4, true, 0).mouth).toBe(0)
    expect(faceState('THINKING', 0.4, true, 0.5).mouth).toBeCloseTo(0.5)
    expect(faceState('ENCOURAGE', 0.4, true, 0).mouth).toBeCloseTo(0.3)
    expect(faceState('CHEER', 0.4, true, 0).mouth).toBe(0.8)
    expect(faceState('TALKING', 0.4, false, 0.9).mouth).toBe(0)
  })

  it('말하기는 입을 여닫고, 신나는 동작은 웃는 입, 환호는 웃는 눈이다', () => {
    const mouths = [0.1, 0.3, 0.5, 0.7, 0.9].map(t => faceState('TALKING', t, true).mouth)
    expect(Math.max(...mouths) - Math.min(...mouths)).toBeGreaterThan(0.2)
    for (const action of ['WAVE', 'CHEER', 'ENCOURAGE'] as const) expect(faceState(action, 1, true).mouth).toBe(0.8)
    expect(faceState('CHEER', 1, true).eyes).toBe('happy')
    expect(faceState('CHEER', 1, false).eyes).toBe('happy')
    for (const action of ['IDLE', 'LISTENING', 'THINKING'] as const) expect(faceState(action, 1, true).mouth).toBe(0)
  })

  it('그릴 수 없는 환경(문서 없음)이나 머리 뼈가 없는 모델에는 붙이지 않는다', () => {
    expect(attachDuduFace(new Group())).toBeNull()
  })
})
