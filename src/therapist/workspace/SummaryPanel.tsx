import { CUE_LABELS, LEVEL_LABELS, POSITION_LABELS, STATUS_LABELS } from '../planning'
import type { PlanningContext } from '../planning'
import { formatDate } from '../formatTime'

/** 첫 화면: 누구인지, 현재 목표, 최근 실제 회기, 검토할 관찰, 다음 계획 상태만 보인다. 그래프·AI 점수는 두지 않는다. */
export default function SummaryPanel({ context, playCode }: { context: PlanningContext; playCode?: string }) {
  const { child, currentGoal: goal, evidenceAvailability: evidence, recentRealSessions: sessions, latestPlan } = context
  const latest = sessions[0]
  return <section className="card summary-panel"><h2>요약</h2>
    <dl className="summary-grid">
      <div><dt>아동</dt><dd>{child.alias} · {child.childCode} · {child.ageBand}세</dd></div>
      <div><dt>현재 목표 v{goal.version}</dt><dd>/{goal.targetPhoneme}/ {POSITION_LABELS[goal.wordPosition] || goal.wordPosition} · {LEVEL_LABELS[goal.level] || goal.level} · {CUE_LABELS[goal.preferredCue] || goal.preferredCue}</dd></div>
      <div><dt>최근 실제 회기</dt><dd>{latest?.startedAt ? `${formatDate(latest.startedAt)} · 평가 가능 ${latest.evaluableN}건` : '실제 음성 회기 없음'}</dd></div>
      <div><dt>검토할 관찰</dt><dd data-pending-review={evidence.pendingReviewN}>{evidence.pendingReviewN}건{evidence.pendingReviewN > 0 && ' · 경과 · 기록 탭에서 확인'}</dd></div>
      <div><dt>다음 회기 계획</dt><dd>{latestPlan ? `${STATUS_LABELS[latestPlan.status]} (rev.${latestPlan.revision})` : '아직 없음'}</dd></div>
    </dl>
    {!evidence.sufficient && <p className="notice" data-insufficient="true">치료사가 확인한 평가 가능 자료가 아직 부족합니다. 자료 없음은 0점이 아닙니다.</p>}
    {playCode && <p className="muted">아동 로그인 아이디: <strong>{playCode}</strong></p>}
  </section>
}
