import { describe, expect, it } from 'vitest'
import type { HoyaAction } from '../control/speechGameSignal'
import { ONE_SHOT, pickClip } from './duduClips'

const ACTIONS: HoyaAction[] = ['IDLE', 'LISTENING', 'TALKING', 'CHARGE', 'BEAM', 'RELEASE', 'FLY', 'LAND', 'CAST', 'ATTACK',
  'WALK_TO', 'PICK_UP', 'PUT_IN_BAG', 'WAVE', 'CHEER', 'ENCOURAGE', 'THINKING']

describe('두두 모델 파일 애니메이션 선택', () => {
  it('17개 동작 모두 클립을 하나 고르거나, 클립이 없으면 null이다', () => {
    const names = ['Idle_Breathing', 'Walking', 'Mage_Spell_Cast', 'Jump']
    for (const action of ACTIONS) expect(names).toContain(pickClip(action, names))
    for (const action of ACTIONS) expect(pickClip(action, [])).toBeNull()
  })
  it('이름이 맞는 클립을 우선하고, 없으면 idle로 돌아간다', () => {
    expect(pickClip('WALK_TO', ['Idle', 'Walking'])).toBe('Walking')
    expect(pickClip('BEAM', ['Idle', 'Mage_Spell_Cast_2'])).toBe('Mage_Spell_Cast_2')
    expect(pickClip('WAVE', ['Idle', 'Walking'])).toBe('Idle')
    expect(pickClip('RELEASE', ['Walking', 'Happy_Sway_Standing'])).toBe('Happy_Sway_Standing')
    expect(pickClip('WAVE', ['Walking'])).toBe('Walking')
  })
  it('실제 모델 파일의 클립 이름에 맞게 고르고, 몸을 돌리는 Idle_14는 쓰지 않는다', () => {
    const names = ['Walking', 'Collect_Object', 'Happy_Sway_Standing', 'Listening_Gesture', 'Motivational_Cheer',
      'Punch_Forward_with_Both_Fists', 'Regular_Jump', 'Talk_with_Left_Hand_on_Hip', 'Wave_One_Hand', 'happy_jump_m', 'mage_soell_cast_3']
    expect(pickClip('IDLE', names)).toBe('Happy_Sway_Standing')
    expect(pickClip('LISTENING', names)).toBe('Listening_Gesture')
    expect(pickClip('TALKING', names)).toBe('Talk_with_Left_Hand_on_Hip')
    expect(pickClip('BEAM', names)).toBe('mage_soell_cast_3')
    expect(pickClip('ATTACK', names)).toBe('Punch_Forward_with_Both_Fists')
    expect(pickClip('CHEER', names)).toBe('happy_jump_m')
    expect(pickClip('ENCOURAGE', names)).toBe('Motivational_Cheer')
    expect(pickClip('FLY', names)).toBe('Regular_Jump')
    expect(pickClip('RELEASE', names)).toBe('Happy_Sway_Standing')
    expect(pickClip('THINKING', names)).toBe('Listening_Gesture')
  })
  it('반복하지 않는 동작은 한 번만 재생한다', () => {
    expect(ONE_SHOT.has('ATTACK')).toBe(true)
    expect(ONE_SHOT.has('IDLE')).toBe(false)
  })
})
