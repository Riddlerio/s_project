import { Link } from 'react-router-dom'
import ConversationInsights from '../ConversationInsights'
import { formatDate, formatDateTime } from '../formatTime'
import type { GoalTrends } from '../insights'
import ActivityRecommendationPanel from '../ActivityRecommendationPanel'
import GoalTrendChart from '../charts/GoalTrendChart'
import { confidenceText, recommendationBadges, recommendationStatusText, sessionSourceText, sessionStatusText } from '../clinicalLabels'
import type { RecommendationProvenance } from '../clinicalLabels'
import { LEVEL_LABELS, STATUS_LABELS } from '../planning'
import type { PlanningContext, SessionPlan } from '../planning'
import { EvidenceSummary } from './NextSessionPanel'

export interface SessionRow { id: string; mode: string; isSeed: boolean; startedAt: string; status: string }
export interface LegacyRecommendation { id: string; observation: string; suggestion_text: string; evidence?: { label: string; value: unknown }[]; confidence: string; status: string; provenance?: RecommendationProvenance }
export interface RuleRow { id: string; rule_type: string; params: Record<string, unknown> }

type Props = {
  childId: string; context: PlanningContext; trends: GoalTrends | null; sessions: SessionRow[]; plans: SessionPlan[]
  recommendations: LegacyRecommendation[]; rules: RuleRow[]; showAdvanced?: boolean
  onDecide: (id: string, action: 'accept' | 'modify' | 'reject', note: string, level?: string) => void; onDeactivate: (id: string) => void
}

/** 경과 · 기록. 기존 자동 추천(규칙 기반, 내부 이름 AIRecommendation)과 치료사 규칙은 접힌 고급 정보로 옮겨 첫 화면을 가볍게 한다. */
export default function ProgressPanel({ childId, context, trends, sessions, plans, recommendations, rules, showAdvanced = true, onDecide, onDeactivate }: Props) {
  const pendingSessions = sessions.filter(session => session.mode === 'real' && !session.isSeed)
  return <>
    <GoalTrendChart data={trends} />
    <ConversationInsights key={childId} childId={childId} />
    <details className="card"><summary>다음 회기 제안에 사용되는 기존 근거 요약</summary><EvidenceSummary metrics={context.metrics} /></details>
    <section className="card"><h2>검토 대기 임상 관찰</h2>
      <p data-pending-review={context.evidenceAvailability.pendingReviewN}>치료사 확인을 기다리는 실제 음성 관찰 {context.evidenceAvailability.pendingReviewN}건. 확인하거나 교정한 관찰만 다음 회기 근거가 됩니다.</p>
      {context.evidenceAvailability.pendingReviewN > 0 && <ul>{pendingSessions.slice(0, 5).map(session => <li key={session.id}><Link to={`/therapist/sessions/${session.id}`}>{formatDateTime(session.startedAt)} 회기 관찰 검토</Link></li>)}</ul>}
      <p className="muted">DEMO·샘플 관찰 {context.evidenceAvailability.demoExcludedN}건은 근거에서 제외됩니다.</p>
    </section>
    <section className="card"><h2>최근 회기</h2>{sessions.length ? <ul>{sessions.map(session => <li key={session.id}><Link to={`/therapist/sessions/${session.id}`}>{formatDateTime(session.startedAt)} · {sessionSourceText(session)} · {sessionStatusText(session.status)}</Link></li>)}</ul> : <p>회기 기록이 없습니다.</p>}</section>
    <section className="card"><h2>이전 회기 계획</h2>{plans.length ? <table><thead><tr><th>rev.</th><th>상태</th><th>목표</th><th>활동</th><th>작성</th></tr></thead><tbody>{plans.map(plan => <tr key={plan.id}><td>{plan.revision}</td><td>{STATUS_LABELS[plan.status]}</td><td>v{plan.goalVersion} · /{plan.targetPhoneme}/</td><td>{plan.steps.length}개</td><td>{formatDate(plan.createdAt)}</td></tr>)}</tbody></table> : <p>작성한 계획이 없습니다.</p>}</section>
    {showAdvanced && <details className="card advanced"><summary>고급 정보: 활동 제안 · 목표 추천 · 적용 규칙</summary>
      <ActivityRecommendationPanel childId={childId} />
      <h3>기존 목표 추천</h3>{recommendations.length ? recommendations.map(rec => <LegacyRecommendationRow key={rec.id} rec={rec} onDecide={onDecide} />) : <p>추천이 없습니다.</p>}
      <h3>적용 규칙</h3>{rules.length ? rules.map(rule => <p key={rule.id}>{rule.rule_type} · {JSON.stringify(rule.params)} <button onClick={() => onDeactivate(rule.id)}>비활성화</button></p>) : <p>적용 중인 규칙이 없습니다.</p>}
    </details>}
  </>
}

function LegacyRecommendationRow({ rec, onDecide }: { rec: LegacyRecommendation; onDecide: Props['onDecide'] }) {
  const badges = recommendationBadges(rec.provenance)
  return <article><h4>{rec.observation}{badges.length > 0 && <small data-provenance="non-clinical"> · {badges.join(' · ')}</small>}</h4><p>{rec.suggestion_text}</p><p>근거: {rec.evidence?.map(item => `${item.label}: ${item.value}`).join(' · ')}</p><p>근거 양(이전 회기 수 기준): {confidenceText(rec.confidence)} · {recommendationStatusText(rec.status)}</p>
    {rec.status === 'pending' && <form onSubmit={event => { event.preventDefault(); const note = String(new FormData(event.currentTarget).get('note') || ''); onDecide(rec.id, 'reject', note) }}>
      {rec.provenance?.demoPractice ? <p className="muted">DEMO 연습 기반 추천은 목표에 반영할 수 없어 거절만 할 수 있습니다.</p> : <>
      <button type="button" onClick={() => onDecide(rec.id, 'accept', '')}>수락</button>
      <select name="level" aria-label="수정할 단계" defaultValue="word">{['syllable', 'word', 'short_sentence'].map(value => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}</select>
      <button type="button" onClick={event => onDecide(rec.id, 'modify', '', String(new FormData(event.currentTarget.form!).get('level')))}>선택 단계로 수정</button></>}
      <input name="note" aria-label="거절 사유" placeholder="거절 사유" required /><button type="submit">거절</button>
    </form>}
  </article>
}
