import { describe, expect, it } from 'vitest'
import RATIONALE from '../../../shared/daegu_crossing_rationale.json'
import { previewPlan, ROUND_TITLES } from './crossingFlow'
import { BPM, DEFAULT_RHYTHM } from './rhythm'

/* 치료사 화면에 보일 설계 근거(shared/daegu_crossing_rationale.json)가 실제 게임 구성과 어긋나지 않게 한다. */
const join = (texts: string[]) => texts.join(' · ')

describe('대구대 건너기 설계 근거', () => {
  it('라운드 이름·음절·낱말이 게임 구성과 같다(음절 단계·낱말 단계)', () => {
    const syllable = previewPlan('syllable'), word = previewPlan('word')
    expect(RATIONALE.rounds).toHaveLength(5)
    RATIONALE.rounds.forEach((round, i) => {
      expect(round.title).toBe(ROUND_TITLES[i])
      expect(round.items).toBe(join(syllable.filter(item => item.roundIndex === i + 1).map(item => item.text)))
      expect(round.wordLevelItems).toBe(join(word.filter(item => item.roundIndex === i + 1).map(item => item.text)))
    })
  })

  it('조절 값(시작 박자·빨라지기)이 박자 규칙과 같다', () => {
    const tempo = RATIONALE.adjustable.find(entry => entry.name === '시작 박자')!
    expect(tempo.values).toContain(String(BPM.settingMin))
    expect(tempo.values).toContain(String(BPM.settingMax))
    expect(tempo.values).toContain(String(DEFAULT_RHYTHM.startBpm))
    expect(RATIONALE.adjustable.some(entry => entry.name === '잘하면 조금씩 빨라지기')).toBe(true)
  })

  it('자동 판정의 한계와 치료사 확인이 들어 있다', () => {
    expect(RATIONALE.judgment.cannot.join(' ')).toContain('치간음화')
    expect(RATIONALE.judgment.therapistRole).toContain('치료사')
    expect(RATIONALE.limits.join(' ')).toContain('임상 자료가 아니다')
  })
})
