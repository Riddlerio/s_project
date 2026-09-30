import { useEffect, useState } from 'react'
import { approveSessionPlan, cancelSessionPlan, cloneSessionPlan, createSessionPlan, sessionPlanProposal, updateSessionPlan } from '../../api/therapist'
import { LEVEL_LABELS, STATUS_LABELS, approvedPlan, currentDraft, toForm, validateForm } from '../planning'
import type { Metrics, PlanForm, ProposalResponse, SessionPlan } from '../planning'
import PlanEditor from './PlanEditor'

export function EvidenceSummary({ metrics }: { metrics: Metrics }) {
  return <div className="evidence-summary">
    <p>최근 실제 회기 {metrics.window.realSessionN}개 · 치료사 확인 관찰 {metrics.verifiedN}건 · 평가 가능 시도 {metrics.evaluableN}건{metrics.successRate !== null && ` · 확인된 성공 ${metrics.successN}건(${metrics.successRate}%)`}</p>
    <p>불확실 {metrics.uncertainN}건 · 무발화 {metrics.noSpeechN}건(실패로 세지 않음) · 목표 관찰 {metrics.targetObservedN}건(정확한 산출 판정 아님)</p>
    {metrics.byLevel.length > 0 && <table><thead><tr><th>단계</th><th>평가 가능</th><th>성공 확인</th><th>비율</th></tr></thead><tbody>{metrics.byLevel.map(row => <tr key={row.level}><td>{LEVEL_LABELS[row.level] || row.level}</td><td>{row.evaluableN}</td><td>{row.successN}</td><td>{row.successRate === null ? '자료 없음' : `${row.successRate}%`}</td></tr>)}</tbody></table>}
    {metrics.pendingReviewN > 0 && <p className="notice">검토 대기 관찰 {metrics.pendingReviewN}건은 근거에서 빠져 있습니다.</p>}
  </div>
}

type ViewProps = {
  proposal: ProposalResponse | null; plan: SessionPlan | null; form: PlanForm | null; message: string; busy: boolean
  onPropose: () => void; onChange: (form: PlanForm) => void; onSave: () => void; onApprove: () => void; onCancel: () => void; onClone: () => void
}

/** 순서: 최근 검증 근거 → 시스템 요약 → 다음 회기 제안 → 치료사 수정 → 승인. */
export function NextSessionView({ proposal, plan, form, message, busy, onPropose, onChange, onSave, onApprove, onCancel, onClone }: ViewProps) {
  const readOnly = plan !== null && plan.status !== 'DRAFT'
  const errors = form && !readOnly ? validateForm(form) : []
  return <section className="card next-session">
    <h2>다음 회기</h2>
    {message && <p role="status">{message}</p>}
    {proposal && <>
      <h3>1. 최근 검증 근거</h3><EvidenceSummary metrics={proposal.metrics} />
      <h3>2. 시스템 요약 <small>{proposal.summary.source === 'LLM' ? 'AI 문장 정리 · 수치는 서버 계산' : '서버 계산 요약'}</small></h3>
      {proposal.status === 'INSUFFICIENT_DATA' && <p className="notice" data-insufficient="true">치료사가 확인한 실제 발화 자료가 부족합니다. 현재 목표를 유지하고 추가 관찰이 필요합니다.</p>}
      <p>{proposal.summary.observationSummary}</p>
      {proposal.summary.evidencePoints.length > 0 && <ul>{proposal.summary.evidencePoints.map(point => <li key={point}>{point}</li>)}</ul>}
      <h3>3. 다음 회기 제안</h3><p>{proposal.summary.nextSessionSuggestion}</p>
      <ul className="rationale">{proposal.proposal.rationale.map(row => <li key={row.code}>{row.text}</li>)}</ul>
      {proposal.summary.limitations.length > 0 && <details><summary>해석 한계</summary><ul>{proposal.summary.limitations.map(item => <li key={item}>{item}</li>)}</ul></details>}
    </>}
    {!proposal && <button disabled={busy} onClick={onPropose}>{form ? '최근 근거와 시스템 제안 보기' : '근거로 다음 회기 제안 만들기'}</button>}
    {form && <>
      <h3>4. 치료사 수정 {plan && <small>rev.{plan.revision} · {STATUS_LABELS[plan.status]}</small>}</h3>
      <PlanEditor form={form} readOnly={readOnly} onChange={onChange} />
      {errors.length > 0 && <ul role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      <h3>5. 승인</h3>
      <p>승인한 계획은 바꿀 수 없습니다. 고치려면 복제해서 새 revision을 만듭니다. 아동 화면 연결은 다음 단계에서 제공합니다.</p>
      {!readOnly && <div><button disabled={busy || errors.length > 0} onClick={onSave}>{plan ? '초안 저장' : '초안 만들기'}</button><button disabled={busy || !plan || errors.length > 0} onClick={onApprove}>치료사 승인</button>{plan && <button disabled={busy} onClick={onCancel}>초안 취소</button>}</div>}
      {readOnly && plan && <div><button disabled={busy} onClick={onClone}>복제해서 수정</button>{plan.status === 'APPROVED' && <button disabled={busy} onClick={onCancel}>계획 취소</button>}</div>}
    </>}
  </section>
}

export default function NextSessionPanel({ childId, plans, onChanged }: { childId: string; plans: SessionPlan[]; onChanged: () => Promise<void> }) {
  const [proposal, setProposal] = useState<ProposalResponse | null>(null)
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  const [form, setForm] = useState<PlanForm | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const own = plans.filter(row => row.childId === childId)
    const active = currentDraft(own) || approvedPlan(own)
    setPlan(active)
    setForm(active ? toForm(active) : null)
  }, [plans, childId])
  async function run(action: () => Promise<void>) {
    setBusy(true)
    try { await action() } catch (cause) { setMessage(String(cause)) } finally { setBusy(false) }
  }
  const propose = () => run(async () => {
    const result = await sessionPlanProposal(childId)
    setProposal(result)
    // 작성 중이거나 승인된 계획이 있으면 form을 덮어쓰지 않는다. 없을 때만 제안으로 form을 채운다.
    if (!plan) setForm(toForm(result.proposal.form))
    setMessage('제안을 불러왔습니다. 저장·승인 전에는 적용되지 않습니다.')
  })
  const save = () => run(async () => {
    if (!form) return
    const saved = plan ? await updateSessionPlan(plan.id, form) : await createSessionPlan(childId, form)
    setPlan(saved); setMessage('초안을 저장했습니다.'); await onChanged()
  })
  const approve = () => run(async () => {
    if (!plan || !form) return
    await updateSessionPlan(plan.id, form)
    await approveSessionPlan(plan.id); setMessage('치료사 승인이 저장되었습니다.'); await onChanged()
  })
  const cancel = () => run(async () => { if (plan) { await cancelSessionPlan(plan.id); setMessage('계획을 취소했습니다.'); await onChanged() } })
  const clone = () => run(async () => { if (plan) { await cloneSessionPlan(plan.id); setMessage('새 revision 초안을 만들었습니다.'); await onChanged() } })
  return <NextSessionView proposal={proposal} plan={plan} form={form} message={message} busy={busy}
    onPropose={() => { void propose() }} onChange={setForm} onSave={() => { void save() }} onApprove={() => { void approve() }}
    onCancel={() => { void cancel() }} onClone={() => { void clone() }} />
}
