import { describe, expect, it } from 'vitest'
import { homePracticeDraft, levelTotals, masteryWindow, percent, practiceItems, shortDate, soapDraft } from './crossingAnalytics'
import { crossingData, crossingSession } from './testFixtures'

describe('건너기 분석 계산(서버 집계를 다시 판정하지 않음)', () => {
  it('비율은 반올림한 %로, 자료 없음은 0%가 아니라 자료 없음으로 보인다', () => {
    expect(percent(.755)).toBe('76%')
    expect(percent(0)).toBe('0%')
    expect(percent(null)).toBe('자료 없음')
  })

  it('숙달 판단 범위는 서버와 같이 최신 실제 회기 3개다(DEMO·샘플은 건너뛰고, 자료 없는 실제 회기는 건너뛰지 않음)', () => {
    const sessions = [
      crossingSession({ sessionId: 'a' }), crossingSession({ sessionId: 'b' }), crossingSession({ sessionId: 'sample', source: 'SAMPLE', confirmedRate: null }),
      crossingSession({ sessionId: 'c', reviewedN: 0, confirmedSuccessN: 0, confirmedRate: null }), crossingSession({ sessionId: 'demo', source: 'DEMO', confirmedRate: null }),
      crossingSession({ sessionId: 'd' }),
    ]
    expect(masteryWindow(crossingData(sessions)).map(session => session.sessionId)).toEqual(['b', 'c', 'd'])
  })

  it('단계별 합계는 실제 회기의 치료사 확인 기록만 더한다', () => {
    const totals = levelTotals([crossingSession(), crossingSession({ source: 'SAMPLE', byLevel: { syllable: { reviewedN: 9, confirmedSuccessN: 9 } } })])
    expect(totals).toEqual({ syllable: { reviewedN: 4, confirmedSuccessN: 3 }, word: { reviewedN: 4, confirmedSuccessN: 3 } })
  })

  it('그래프 날짜는 서울 날짜다(UTC 16:30은 다음 날)', () => {
    expect(shortDate('2026-10-05T16:30:00Z')).toBe('10.6')
    expect(shortDate('2026-10-05T01:00:00')).toBe('10.5')
  })

  it('가정 연습 낱말은 목표 단계의 게임 낱말이고 제외 낱말은 빠진다', () => {
    expect(practiceItems('syllable')).toEqual(['사', '소', '시', '수', '사과', '수박', '시소'])
    expect(practiceItems('word')).toEqual(['사과', '소리', '시소', '수박'])
    expect(practiceItems('word', ['시소'])).toEqual(['사과', '소리', '수박'])
    const draft = homePracticeDraft({ level: 'word', excluded_words: [], preferred_cue: 'auditory_model' })
    expect(draft).toContain("'사과·소리·시소·수박'을 천천히 말해 보세요")
    expect(draft).toContain('고쳐 말하라고 하지 말고')
    expect(homePracticeDraft({ level: 'syllable', excluded_words: [], preferred_cue: 'none' })).toContain("'사·소·시·수·사과·수박·시소'를")
    expect(draft).not.toMatch(/틀렸|정확도|진단/)
  })

  it('회기 기록 초안은 서버 수치만 옮기고 S·A·P는 치료사 몫으로 남기며 한계를 적는다', () => {
    const sessions = [crossingSession({ sessionId: 'a', confirmedRate: .6 }), crossingSession({ sessionId: 'b', confirmedRate: .85 }), crossingSession({ sessionId: 'c' })]
    const text = soapDraft(sessions[2], crossingData(sessions), { level: 'syllable', excluded_words: [], preferred_cue: 'auditory_model' }, '현재 목표 단계를 유지하는 구성을 제안합니다.')
    expect(text).toContain('S(주관): (치료사 작성')
    expect(text).toContain('목표 /ㅅ/ 어두 · 음절. 시도 10회, 판단 보류 1회(실패 아님)')
    expect(text).toContain('치료사 확인 8회 중 성공 6회(75%) · 단계별 음절 3/4, 낱말 3/4')
    expect(text).toContain('자동 추정(의심, 임상 판단 아님): 바람 소리 없음 1 · 바람 소리 짧음 1 · 모음 없음 0 · 기준 충족 6')
    expect(text).toContain('시작 박자 84BPM, 잘하면 빨라지기 켬')
    expect(text).toContain('최근 실제 3회기 확인 비율 60% → 85% → 75%')
    expect(text).toContain('회기 간 변화는 치료 효과의 증명이 아니다')
    expect(text).toContain('P(계획): 서버 제안: 현재 목표 단계를 유지하는 구성을 제안합니다.')
    expect(soapDraft(null, crossingData([]), null)).toBe('')
  })

  it('샘플·DEMO 회기의 기록 초안에는 확인 비율을 쓰지 않고 비교 제외를 적는다', () => {
    const sample = crossingSession({ source: 'SAMPLE', reviewedN: 0, confirmedSuccessN: 0, confirmedRate: null, rhythm: null })
    const text = soapDraft(sample, crossingData([sample]), null)
    expect(text).toContain('샘플·시연 회기라 확인 비율과 숙달 계산에서 뺐다')
    expect(text).not.toContain('치료사 확인')
    expect(text).toContain('박자 기록 없음')
    expect(text).toContain('비교할 실제 회기가 없다')
  })
})
