import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { childDetail, decision, planningContext, progress, saveGoal, sessionPlans } from '../../api/therapist'
import type { Progress } from '../../shared/types'
import { getToken } from '../auth'
import type { PlanningContext, SessionPlan } from '../planning'
import GoalPanel from '../workspace/GoalPanel'
import type { GoalRow } from '../workspace/GoalPanel'
import NextSessionPanel from '../workspace/NextSessionPanel'
import ProgressPanel from '../workspace/ProgressPanel'
import type { LegacyRecommendation, RuleRow, SessionRow } from '../workspace/ProgressPanel'
import SummaryPanel from '../workspace/SummaryPanel'

export const WORKSPACE_TABS = [
  { id: 'summary', label: '요약' }, { id: 'goal', label: '치료 목표' },
  { id: 'next', label: '다음 회기' }, { id: 'progress', label: '경과 · 기록' },
] as const
export type WorkspaceTab = typeof WORKSPACE_TABS[number]['id']

interface ChildDetailData { child: { hero_name: string; child_code: string; play_code: string }; currentGoal: GoalRow | null; goalHistory: GoalRow[]; sessions: SessionRow[]; activeRules: RuleRow[] }

/** 치료사 작업 순서(누구 → 목표 → 이전 회기 → 다음 계획 → 해석)에 맞춘 4영역 작업 공간. */
export function Workspace({ tab, onTab, title, children }: { tab: WorkspaceTab; onTab: (tab: WorkspaceTab) => void; title: string; children: ReactNode }) {
  return <main className="therapist-screen"><Link to="/therapist">← 담당 아동 목록</Link><h1>{title}</h1>
    <nav className="workspace-tabs" role="tablist">{WORKSPACE_TABS.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => onTab(item.id)}>{item.label}</button>)}</nav>
    <div role="tabpanel">{children}</div>
  </main>
}

export default function ChildDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const token = getToken()
  const [tab, setTab] = useState<WorkspaceTab>('summary')
  const [data, setData] = useState<ChildDetailData | null>(null)
  const [context, setContext] = useState<PlanningContext | null>(null)
  const [plans, setPlans] = useState<SessionPlan[]>([])
  const [metrics, setMetrics] = useState<Progress | null>(null)
  const [recs, setRecs] = useState<LegacyRecommendation[]>([])
  const [error, setError] = useState('')
  async function load() {
    const [child, planning, planRows, chart, recommendations] = await Promise.all([
      childDetail(id, token) as Promise<ChildDetailData>, planningContext(id), sessionPlans(id), progress(id, token),
      api<LegacyRecommendation[]>(`/children/${id}/recommendations`, {}, token),
    ])
    setData(child); setContext(planning); setPlans(planRows); setMetrics(chart); setRecs(recommendations)
  }
  const reload = () => load().catch(cause => setError(String(cause)))
  useEffect(() => { if (!token) navigate('/therapist/login'); else void reload() }, [id, token, navigate])
  async function attempt(action: () => Promise<unknown>) {
    try { await action(); await load() } catch (cause) { setError(String(cause)) }
  }
  const title = data ? `${data.child.hero_name} · ${data.child.child_code}` : '불러오는 중'
  return <Workspace tab={tab} onTab={setTab} title={title}>
    {error && <p role="alert">{error}</p>}
    {context && data && <>
      {tab === 'summary' && <SummaryPanel context={context} playCode={data.child.play_code} />}
      {tab === 'goal' && <GoalPanel goal={data.currentGoal} history={data.goalHistory} onSave={values => attempt(() => saveGoal(id, values, token))} />}
      {tab === 'next' && <NextSessionPanel childId={id} plans={plans} onChanged={async () => { await reload() }} />}
      {tab === 'progress' && <ProgressPanel childId={id} context={context} progress={metrics} sessions={data.sessions} plans={plans}
        recommendations={recs} rules={data.activeRules}
        onDecide={(recId, action, note, level) => { void attempt(() => decision(recId, { action, modifiedGoal: action === 'modify' ? { level } : undefined, note }, token)) }}
        onDeactivate={ruleId => { void attempt(() => api(`/rules/${ruleId}/deactivate`, { method: 'POST' }, token)) }} />}
    </>}
  </Workspace>
}
