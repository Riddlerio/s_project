import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationSessionList } from './ConversationInsights'
import { ACTIVITY_LABELS, selectablePlanActivities, validateForm } from './planning'
import type { PlanForm } from './planning'
import PlanEditor from './workspace/PlanEditor'
import { ObservationEvidence } from './ClinicalTimeline'
import type { InsightObservation } from './insights'

const form: PlanForm = {
  targetPhoneme: 'ㅅ', wordPosition: 'initial', startLevel: 'syllable', targetLevel: 'word',
  durationMin: 5, repetitionTarget: 10, preferredCue: 'auditory_model', priorityTargets: [], excludedWords: [],
  conversationTheme: '', therapistNote: '', steps: [{ stepType: 'GAME', activity: 'sky_climb' }],
}
describe('데모 치료사 화면', () => {
  it('새 선택에서는 빔을 숨기고 기존 계획의 값과 이름표는 보존한다', () => {
    expect(ACTIVITY_LABELS.daegu_crossing).toBe('대구대 건너기')
    expect(selectablePlanActivities('GAME')).not.toContain('magic_beam')
    expect(selectablePlanActivities('GAME')).not.toContain('daegu_crossing')
    const current = renderToStaticMarkup(<PlanEditor form={form} readOnly={false} onChange={() => {}} />)
    expect(current).not.toContain('value="magic_beam"')
    const old: PlanForm = { ...form, steps: [{ stepType: 'GAME', activity: 'magic_beam' }] }
    expect(validateForm(old)).toEqual([])
    const history = renderToStaticMarkup(<PlanEditor form={old} readOnly onChange={() => {}} />)
    expect(history).toContain('빛의 마법 (기존 기록·선택 중지)')
    expect(history).toContain('value="magic_beam" disabled="" selected=""')
  })
  it('대화별 횟수와 연습 출처를 보여 주고 정확도로 부르지 않는다', () => {
    const html = renderToStaticMarkup(<ConversationSessionList data={{
      sessions: [{ sessionId: 'chat', startedAt: '2026-10-05T00:00:00Z', source: 'SAMPLE', status: 'completed',
        completedTurnN: 12, targetObservedN: 10, uncertainN: 1, noSpeechN: 1 }],
      limitation: '목표 낱말 시도는 정확한 발음 횟수가 아닙니다. 게임 회기와 합산하지 않습니다.',
    }} />)
    expect(html).toContain('대화 중 목표 낱말 시도 10회')
    expect(html).toContain('샘플 대화')
    expect(html).toContain('실제 임상 비교에서 제외')
    expect(html).not.toContain('성공률')
  })
  it('건너기 관찰에는 한국어 활동명과 음향 근사 한계를 표시한다', () => {
    const row: InsightObservation = {
      id: 'o', sessionId: 's', roundIndex: 1, attemptNumber: 1, targetText: '사', targetPhoneme: 'ㅅ',
      wordPosition: 'initial', level: 'syllable', activity: 'daegu_crossing', cue: 'AUDITORY_MODEL',
      independence: 'MODELED', durationMs: 1000, audioQuality: 'GOOD', aiResult: 'success', result: 'success',
      source: 'REAL', verification: 'PENDING', provenance: 'AI', measurementSource: 'CLIENT_REPORTED',
      qualityFlags: [], excludedReasons: ['PENDING'], included: false, reviewNote: '',
      acoustic: { onsetFricationMs: 60, voicedAfterFricationMs: 80 },
    }
    const html = renderToStaticMarkup(<ObservationEvidence row={row} />)
    expect(html).toContain('대구대 건너기')
    expect(html).toContain('소리 시범')
    expect(html).toContain('음향 근사')
    expect(html).toContain('치료사 확인이 필요')
  })
})
