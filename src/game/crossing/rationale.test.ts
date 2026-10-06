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

  it('대상별 빠른 설정은 박자 설정 범위 안이고 근거 문서의 권장(말더듬·마비말장애는 빨라지기 끔)과 같다', () => {
    const options = [76, 84, 92, 100]
    expect(new Set(RATIONALE.presets.map(preset => preset.id)).size).toBe(RATIONALE.presets.length)
    for (const preset of RATIONALE.presets) {
      expect(options).toContain(preset.startBpm)
      expect(preset.startBpm).toBeGreaterThanOrEqual(BPM.settingMin)
      expect(preset.startBpm).toBeLessThanOrEqual(BPM.settingMax)
      expect(preset.basis.length).toBeGreaterThan(10)
    }
    const byLabel = Object.fromEntries(RATIONALE.presets.map(preset => [preset.label, preset]))
    expect(byLabel['기능적 조음음운장애']).toMatchObject({ startBpm: DEFAULT_RHYTHM.startBpm, allowFaster: true })
    for (const label of ['말더듬', '마비말장애', '아동기 말실행증']) expect(byLabel[label]).toMatchObject({ startBpm: 76, allowFaster: false })
    // 대상 목록(forWhom·cautions)에 없는 대상의 빠른 설정을 만들지 않는다.
    const groups = [...RATIONALE.forWhom, ...RATIONALE.cautions].map(item => item.who).join(' ')
    for (const preset of RATIONALE.presets) expect(groups).toContain(preset.label.split('·')[0].replace('아동기 ', ''))
  })

  it('전문 정보의 발달 시기에는 출처가 있고, 오류 유형은 자동 판정 한계와 맞는다', () => {
    expect(RATIONALE.development.text).toContain('6;0~6;11세')
    expect(RATIONALE.development.sources.length).toBeGreaterThan(0)
    for (const source of RATIONALE.development.sources) expect(source.url).toMatch(/^https:\/\//)
    expect(RATIONALE.errorTypes.find(error => error.name === '치간음화·측음화')!.auto).toContain('가르지 못한다')
    expect(RATIONALE.homePractice.lines.join(' ')).toContain('{words}')
    expect(RATIONALE.homePractice.lines.join(' ')).not.toMatch(/틀렸|진단|정확도/)
  })

  it('자동 판정의 한계와 치료사 확인이 들어 있다', () => {
    expect(RATIONALE.judgment.cannot.join(' ')).toContain('치간음화')
    expect(RATIONALE.judgment.therapistRole).toContain('치료사')
    expect(RATIONALE.limits.join(' ')).toContain('임상 자료가 아니다')
  })
})
