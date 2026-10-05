import type { ReactNode } from 'react'
import { ACTIVITY_LABELS, CUE_LABELS, LEVEL_LABELS, POSITION_LABELS, START_LEVELS, selectablePlanActivities, STEP_LABELS, TARGET_LEVELS, parseWords } from '../planning'
import type { PlanForm, PlanStep, StepType } from '../planning'

type Props = { form: PlanForm; readOnly: boolean; onChange: (form: PlanForm) => void }

function Field({ label, children }: { label: string; children: ReactNode }) { return <label>{label} {children}</label> }

/** 다음 회기 구조화 form. 치료사는 프롬프트를 쓰지 않고 선택지로 계획을 정한다. 자유 입력은 메모 하나뿐이다. */
export default function PlanEditor({ form, readOnly, onChange }: Props) {
  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => onChange({ ...form, [key]: value })
  const setStep = (index: number, step: PlanStep) => set('steps', form.steps.map((row, at) => at === index ? step : row))
  const moveStep = (index: number, delta: number) => {
    const steps = [...form.steps]
    const [row] = steps.splice(index, 1)
    steps.splice(index + delta, 0, row)
    set('steps', steps)
  }
  return <fieldset className="plan-editor" disabled={readOnly}>
    <legend>{readOnly ? '승인된 계획(읽기 전용)' : '다음 회기 계획'}</legend>
    <div className="form-grid">
      <Field label="목표 음소"><select value={form.targetPhoneme} onChange={event => set('targetPhoneme', event.target.value as PlanForm['targetPhoneme'])}>{['ㅅ', 'ㅈ', 'ㄹ'].map(value => <option key={value} value={value}>/{value}/</option>)}</select></Field>
      <Field label="위치"><select value={form.wordPosition} onChange={event => set('wordPosition', event.target.value as PlanForm['wordPosition'])}>{Object.entries(POSITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="시작 단계"><select value={form.startLevel} onChange={event => set('startLevel', event.target.value as PlanForm['startLevel'])}>{START_LEVELS.map(value => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}</select></Field>
      <Field label="목표 단계"><select value={form.targetLevel} onChange={event => set('targetLevel', event.target.value as PlanForm['targetLevel'])}>{TARGET_LEVELS.map(value => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}</select></Field>
      <Field label="세션 시간"><select value={form.durationMin} onChange={event => set('durationMin', Number(event.target.value) as PlanForm['durationMin'])}>{[5, 10, 15].map(value => <option key={value} value={value}>{value}분</option>)}</select></Field>
      <Field label="목표 시도 횟수"><input type="number" min={10} max={60} value={form.repetitionTarget} onChange={event => set('repetitionTarget', Number(event.target.value))} /></Field>
      <Field label="허용 단서"><select value={form.preferredCue} onChange={event => set('preferredCue', event.target.value as PlanForm['preferredCue'])}>{Object.entries(CUE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="대화 주제"><input maxLength={100} value={form.conversationTheme} onChange={event => set('conversationTheme', event.target.value)} placeholder="예: 동물원" /></Field>
      <Field label="우선 단어(쉼표로 구분)"><input defaultValue={form.priorityTargets.join(', ')} key={`p-${form.priorityTargets.join()}`} onBlur={event => set('priorityTargets', parseWords(event.target.value))} /></Field>
      <Field label="제외 단어(쉼표로 구분)"><input defaultValue={form.excludedWords.join(', ')} key={`e-${form.excludedWords.join()}`} onBlur={event => set('excludedWords', parseWords(event.target.value))} /></Field>
    </div>
    <h3>활동 순서</h3>
    <ol className="plan-steps">{form.steps.map((step, index) => <li key={index}>
      <select aria-label={`${index + 1}번 활동 유형`} value={step.stepType} onChange={event => { const stepType = event.target.value as StepType; setStep(index, { ...step, stepType, activity: selectablePlanActivities(stepType)[0] }) }}>{Object.entries(STEP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label={`${index + 1}번 활동`} value={step.activity} onChange={event => setStep(index, { ...step, activity: event.target.value as PlanStep['activity'] })}>{step.activity === 'magic_beam' && <option value="magic_beam" disabled>빛의 마법 (기존 기록·선택 중지)</option>}{selectablePlanActivities(step.stepType).map(value => <option key={value} value={value}>{ACTIVITY_LABELS[value]}</option>)}</select>
      {step.stepType !== 'CONVERSATION' && <select aria-label={`${index + 1}번 활동 단계`} value={step.targetLevel || ''} onChange={event => setStep(index, { ...step, targetLevel: (event.target.value || null) as PlanStep['targetLevel'] })}><option value="">계획 단계 따름</option>{START_LEVELS.map(value => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}</select>}
      {!readOnly && <span><button type="button" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label="위로">↑</button><button type="button" disabled={index === form.steps.length - 1} onClick={() => moveStep(index, 1)} aria-label="아래로">↓</button><button type="button" disabled={form.steps.length === 1} onClick={() => set('steps', form.steps.filter((_row, at) => at !== index))}>삭제</button></span>}
    </li>)}</ol>
    {!readOnly && form.steps.length < 8 && <button type="button" onClick={() => set('steps', [...form.steps, { stepType: 'GAME', activity: 'monster_adventure', targetLevel: null, parameters: {} }])}>활동 추가</button>}
    <Field label="치료사 메모"><textarea maxLength={500} value={form.therapistNote} onChange={event => set('therapistNote', event.target.value)} /></Field>
  </fieldset>
}
