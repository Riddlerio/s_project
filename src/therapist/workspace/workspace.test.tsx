import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { CaseloadList } from '../pages/Overview'
import type { CaseloadChild } from '../pages/Overview'
import { WORKSPACE_TABS, Workspace } from '../pages/ChildDetail'
import { approvedPlan, currentDraft, isEditable, parseWords, toForm, validateForm } from '../planning'
import type { Metrics, PlanForm, PlanningContext, ProposalResponse, SessionPlan } from '../planning'
import { NextSessionView } from './NextSessionPanel'
import ProgressPanel from './ProgressPanel'
import SummaryPanel from './SummaryPanel'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = () => undefined

const metrics = (over: Partial<Metrics> = {}): Metrics => ({
  window: { realSessionN: 2, maxSessions: 5 }, totalObservedN: 8, poorAudioN: 0, pendingReviewN: 3, rejectedN: 0,
  verifiedN: 5, evaluableN: 3, successN: 2, retryN: 1, successRate: 66.7, retryRate: 33.3, uncertainN: 1, noSpeechN: 1,
  targetObservedN: 0, byLevel: [{ level: 'word', verifiedN: 5, evaluableN: 3, successN: 2, retryN: 1, successRate: 66.7, uncertainN: 1, noSpeechN: 1, targetObservedN: 0 }],
  cueCounts: {}, independenceCounts: {}, trend: [], sufficient: false, ...over,
})

const form: PlanForm = {
  targetPhoneme: 'ㅅ', wordPosition: 'initial', startLevel: 'syllable', targetLevel: 'word', durationMin: 10, repetitionTarget: 30,
  preferredCue: 'visual_mouth', priorityTargets: ['사과'], excludedWords: [], conversationTheme: '', therapistNote: '',
  steps: [{ stepType: 'CONVERSATION', activity: 'hoya_conversation', targetLevel: null, parameters: { durationMin: 2 } },
    { stepType: 'GAME', activity: 'monster_adventure', targetLevel: 'syllable', parameters: { trials: 30 } }],
}

const plan = (status: SessionPlan['status'], over: Partial<SessionPlan> = {}): SessionPlan => ({
  ...form, id: `plan-${status}`, childId: 'c1', goalId: 'g1', goalVersion: 1, parentPlanId: null, revision: 1, status,
  createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', approvedAt: null, cancelledAt: null,
  evidenceSnapshot: {}, recommendationSnapshot: {}, ...over,
})

const context = (over: Partial<PlanningContext> = {}): PlanningContext => ({
  child: { childCode: 'C-0004', alias: '바람', ageBand: '4-5' },
  currentGoal: { goalId: 'g1', version: 2, targetPhoneme: 'ㅅ', wordPosition: 'initial', level: 'word', minLevel: 'syllable', sessionDurationMin: 10, repetitionTarget: 30, preferredCue: 'visual_mouth', priorityTargets: [], excludedWords: [] },
  metrics: metrics(), evidenceAvailability: { verifiedN: 5, pendingReviewN: 3, demoExcludedN: 4, rejectedN: 0, sufficient: false },
  recentRealSessions: [], latestPlan: null, ...over,
})

const proposal = (status: ProposalResponse['status']): ProposalResponse => ({
  status, metrics: metrics({ sufficient: status === 'READY' }), goal: context().currentGoal,
  summary: { observationSummary: '최근 실제 회기 2개에서 치료사가 확인한 관찰은 5건입니다.', evidencePoints: ['단어 단계: 평가 가능 3건'], nextSessionSuggestion: '현재 목표를 유지합니다.', limitations: ['치료사가 확인한 자료만 사용했습니다.'], source: 'TEMPLATE' },
  proposal: { status, form, rationale: [{ code: status, text: '추가 관찰이 필요합니다.' }], activityHint: null },
})

const view = (props: Partial<Parameters<typeof NextSessionView>[0]>) => render(<NextSessionView proposal={null} plan={null} form={null} message="" busy={false}
  onPropose={noop} onChange={noop} onSave={noop} onApprove={noop} onCancel={noop} onClone={noop} {...props} />)

describe('치료사 홈과 작업 공간', () => {
  it('담당 아동 5명을 모두 보여 주고 각 아동 작업 공간으로 연결한다', () => {
    const children: CaseloadChild[] = ['가', '나', '다', '라', '마'].map((name, index) => ({ id: `child-${index}`, hero_name: name, child_code: `C-000${index}`, age_band: '4-5', currentGoal: { target_phoneme: 'ㅅ', level: 'word' }, pendingRecommendations: 0 }))
    const html = render(<CaseloadList children={children} />)
    expect(html).toContain('담당 아동 5명')
    children.forEach(child => expect(html).toContain(`href="/therapist/children/${child.id}"`))
  })

  it('작업 공간은 요약·치료 목표·다음 회기·경과 · 기록 4영역이다', () => {
    expect(WORKSPACE_TABS.map(tab => tab.label)).toEqual(['요약', '치료 목표', '다음 회기', '경과 · 기록'])
    const html = render(<Workspace tab="next" onTab={noop} title="바람 · C-0004"><p>본문</p></Workspace>)
    expect(html.match(/role="tab"/g)).toHaveLength(4)
    expect(html).toContain('aria-selected="true" class="active">다음 회기')
  })

  it('요약은 목표·검토 대기·계획 상태만 보이고 부족한 자료를 0점으로 보이지 않는다', () => {
    const html = render(<SummaryPanel context={context({ latestPlan: { id: 'p', status: 'APPROVED', revision: 2 } })} />)
    expect(html).toContain('바람 · C-0004 · 4-5세')
    expect(html).toContain('현재 목표 v2')
    expect(html).toContain('data-pending-review="3"')
    expect(html).toContain('승인됨 (rev.2)')
    expect(html).toContain('자료 없음은 0점이 아닙니다')
    expect(html).not.toContain('recharts')
  })

  it('경과 · 기록은 검토 대기 관찰과 이전 계획을 보이고 기존 추천은 고급 정보로 접는다', () => {
    const html = render(<ProgressPanel childId="c1" context={context()} trends={null} showAdvanced
      sessions={[{ id: 's1', mode: 'real', isSeed: false, startedAt: '2026-09-29T00:00:00Z', status: 'completed' }]}
      plans={[plan('SUPERSEDED'), plan('APPROVED', { id: 'p2', revision: 2 })]} recommendations={[]} rules={[]} onDecide={noop} onDeactivate={noop} />)
    expect(html).toContain('관찰 3건')
    expect(html).toContain('/therapist/sessions/s1')
    expect(html).toContain('새 계획으로 대체됨')
    expect(html).toMatch(/<details class="card advanced"><summary>고급 정보/)
  })
})

describe('legacy 추천 출처', () => {
  const rec = (demoPractice: boolean) => ({ id: demoPractice ? 'demo' : 'real', observation: '관찰', suggestion_text: '제안', confidence: 'low', status: 'pending',
    provenance: { sessionMode: demoPractice ? 'demo' : 'real', sessionIsSeed: false, clinicalEligible: !demoPractice, demoPractice } })
  const html = (demoPractice: boolean) => render(<ProgressPanel childId="c1" context={context()} trends={null} sessions={[]} plans={[]}
    recommendations={[rec(demoPractice)]} rules={[]} onDecide={noop} onDeactivate={noop} />)

  it('DEMO 연습 기반 추천은 표시를 붙이고 수락·수정 버튼을 숨긴다', () => {
    const demo = html(true)
    expect(demo).toContain('DEMO 연습 기반')
    expect(demo).not.toContain('>수락<')
    expect(demo).toContain('거절')
  })

  it('임상 근거 회기의 추천은 기존처럼 수락할 수 있다', () => {
    const real = html(false)
    expect(real).toContain('>수락<')
    expect(real).not.toContain('data-provenance')
  })
})

describe('다음 회기 계획', () => {
  it('제안 전에는 제안 만들기 버튼만 있다', () => {
    const html = view({})
    expect(html).toContain('근거로 다음 회기 제안 만들기')
    expect(html).not.toContain('치료사 승인')
  })

  it('자료가 부족하면 INSUFFICIENT_DATA 안내를 보이고 제안 form을 채운다', () => {
    const response = proposal('INSUFFICIENT_DATA')
    const html = view({ proposal: response, form: toForm(response.proposal.form) })
    expect(html).toContain('data-insufficient="true"')
    expect(html).toContain('추가 관찰이 필요합니다')
    expect(html).toContain('value="30"')
    expect(html).toContain('초안 만들기')
  })

  it('초안은 수정·승인할 수 있다', () => {
    const html = view({ plan: plan('DRAFT'), form })
    expect(html).toContain('초안 저장')
    expect(html).toContain('치료사 승인')
    expect(html).not.toContain('<fieldset class="plan-editor" disabled')
  })

  it('승인된 계획은 읽기 전용이며 복제로만 수정한다', () => {
    const html = view({ plan: plan('APPROVED'), form })
    expect(html).toContain('<fieldset class="plan-editor" disabled')
    expect(html).toContain('승인된 계획(읽기 전용)')
    expect(html).toContain('복제해서 수정')
    expect(html).not.toContain('초안 저장')
  })

  it('잘못된 form은 승인 버튼을 막는다', () => {
    const html = view({ plan: plan('DRAFT'), form: { ...form, startLevel: 'short_sentence', targetLevel: 'word' } })
    expect(html).toContain('시작 단계가 목표 단계보다 높습니다')
  })
})

describe('계획 순수 함수', () => {
  it('제안이나 저장된 계획에서 form 값만 복사한다', () => {
    const copied = toForm(plan('APPROVED'))
    expect(Object.keys(copied)).not.toContain('status')
    copied.priorityTargets.push('수박')
    expect(form.priorityTargets).toEqual(['사과'])
  })

  it('수정은 새 객체로 하고 검증 규칙을 따른다', () => {
    const edited = { ...form, repetitionTarget: 40, excludedWords: parseWords('수박, 수박, 소라 ,') }
    expect(edited.excludedWords).toEqual(['수박', '소라'])
    expect(validateForm(edited)).toEqual([])
    expect(validateForm({ ...form, excludedWords: ['사과'] })).toContain('우선 단어와 제외 단어가 겹칩니다.')
    expect(validateForm({ ...form, steps: [{ stepType: 'CONVERSATION', activity: 'magic_beam' }] })).toContain('활동 유형과 활동이 맞지 않습니다.')
  })

  it('초안만 편집할 수 있고 초안·승인 계획을 고른다', () => {
    expect(isEditable(plan('DRAFT'))).toBe(true)
    expect(isEditable(plan('APPROVED'))).toBe(false)
    expect(isEditable(plan('SUPERSEDED'))).toBe(false)
    const rows = [plan('APPROVED'), plan('DRAFT', { id: 'd' })]
    expect(currentDraft(rows)?.id).toBe('d')
    expect(approvedPlan(rows)?.status).toBe('APPROVED')
  })
})
