import { describe, expect, it } from 'vitest'
import { initialTowerState, towerTransition } from './monsterTower/machine'
import { beamTransition, initialBeamState } from './magicBeam/machine'
import { DemoRecognizer } from '../speech/demoRecognizer'
import { VadStateMachine } from '../speech/vad'
import type { PlayItem } from '../shared/events'

const event = (type: Parameters<typeof towerTransition>[1]['type'], payload = {}) => ({ type, payload })

describe('몬스터 타워', () => {
  it('소개부터 발성·분석·재시도·힌트·성공·다음 목표·완료로 이동한다', () => {
    let state = initialTowerState
    for (const [type, phase] of [['SESSION_START', 'MISSION'], ['TARGET_PRESENTED', 'SHOW_TARGET'], ['VOICE_START', 'LISTENING'], ['VOICE_END', 'ANALYZING'], ['TARGET_RETRY', 'RETRY'], ['HINT_REQUIRED', 'HINT']] as const) {
      state = towerTransition(state, event(type)); expect(state.phase).toBe(phase)
    }
    expect(state.shield).toBe(true)
    expect(state.xp).toBe(1)
    state = towerTransition(state, event('TARGET_SUCCESS', { power: 3 }))
    expect(state.health).toBe(5); expect(state.shield).toBe(false)
    state = towerTransition(state, event('ITEM_SKIPPED')); expect(state.phase).toBe('NEXT_TARGET')
    state = towerTransition(state, event('SESSION_COMPLETE')); expect(state.phase).toBe('COMPLETE')
  })
  it('난이도 조정과 보상이 목표를 벗어나지 않고 상태에 반영된다', () => {
    let state = towerTransition(initialTowerState, event('LEVEL_DOWN'))
    expect(state.charge).toBe(true)
    state = towerTransition(state, event('REWARD', { xp: 4 }))
    expect(state.xp).toBe(4)
    state = towerTransition(state, event('LEVEL_UP'))
    expect(state.charge).toBe(false)
  })
})

describe('마법 빔과 음성 입력', () => {
  it('발성 지속시간과 결과를 순서대로 반영한다', () => {
    let state = initialBeamState(1500)
    state = beamTransition(state, { type: 'LISTEN' }); expect(state.phase).toBe('LISTENING')
    state = beamTransition(state, { type: 'VOICE_START' }); expect(state.phase).toBe('VOICE_DETECTED')
    state = beamTransition(state, { type: 'VOICE_CONTINUE', voicedMs: 900 }); expect(state.phase).toBe('BEAM_ACTIVE')
    state = beamTransition(state, { type: 'VOICE_END', voicedMs: 1700 }); expect(state.voicedMs).toBe(1700)
    state = beamTransition(state, { type: 'RESULT', outcome: 'SUCCESS' }); expect(state.success).toBe(true)
    state = beamTransition(state, { type: 'RESULT', outcome: 'UNCERTAIN' }); expect(state.phase).toBe('READY')
  })
  it('데모 인식기는 첫 단어를 재시도하고 이후 성공시킨다', async () => {
    const recognizer = new DemoRecognizer()
    const item: PlayItem = { itemId: 'apple', displayText: '사과', game: 'monster_tower', level: 'word', pictureKey: 'apple' }
    recognizer.start(item)
    for (let attempt = 0; attempt < 3; attempt++) expect((await recognizer.stop()).transcript).toBe('따과')
    expect((await recognizer.stop()).transcript).toBe('사과')
  })
  it('VAD는 짧은 소음을 무시하고 충분한 발성을 감지한다', () => {
    const vad = new VadStateMachine()
    const frame = (tMs: number, rmsDb: number) => vad.process({ tMs, rmsDb, hfRatio: 0.1 })
    frame(0, -20); frame(20, -60); expect(vad.state).toBe('silence')
    frame(100, -20); expect(frame(180, -20).some(e => e.type === 'VOICE_START')).toBe(true)
    expect(frame(300, -20).some(e => e.type === 'VOICE_CONTINUE')).toBe(true)
    frame(320, -60); expect(frame(600, -60).some(e => e.type === 'VOICE_END')).toBe(false)
    expect(frame(1020, -60).some(e => e.type === 'VOICE_END')).toBe(true)
  })
})
