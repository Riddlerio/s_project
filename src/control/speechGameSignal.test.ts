import { describe, expect, it } from 'vitest'
import { HoyaActionController } from './HoyaActionController'
import { mapSignalToHoya } from './speechGameSignal'

describe('음성 신호와 호야 행동', () => {
  it('마법 빔의 시작, 지속, 종료를 호야가 직접 수행한다', () => {
    const actions: string[] = []
    const controller = new HoyaActionController(action => actions.push(action))
    controller.dispatch('magic_beam', { type: 'VOICE_START' })
    controller.dispatch('magic_beam', { type: 'VOICE_CONTINUE', energy01: 0.8 })
    controller.dispatch('magic_beam', { type: 'VOICE_END' })
    expect(actions).toEqual(['CHARGE', 'BEAM', 'RELEASE'])
  })

  it('불확실한 음성은 모든 게임에서 공격 실패로 표시하지 않는다', () => {
    for (const game of ['magic_beam', 'sky_climb', 'monster_adventure', 'conversation_quest'] as const) {
      expect(mapSignalToHoya(game, { type: 'UNCERTAIN' })).toBe('LISTENING')
    }
  })
})
