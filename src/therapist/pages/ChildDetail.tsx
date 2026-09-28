import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { childDetail, decision, progress, saveGoal } from '../../api/therapist'
import { getToken } from '../auth'
import SessionTrendChart from '../charts/SessionTrendChart'

export default function ChildDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const token = getToken()
  const [data, setData] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [recs, setRecs] = useState<any[]>([])
  const [error, setError] = useState('')
  const [level, setLevel] = useState('word')
  const [reason, setReason] = useState('')
  async function load() { const [child, chart, recommendations] = await Promise.all([childDetail(id, token), progress(id, token), api<any[]>(`/children/${id}/recommendations`, {}, token)]); setData(child); setMetrics(chart); setRecs(recommendations); setLevel(child.currentGoal?.level || 'word') }
  useEffect(() => { if (!token) navigate('/therapist/login'); else load().catch(e => setError(String(e))) }, [id, token, navigate])
  async function changeGoal() { try { await saveGoal(id, { ...data.currentGoal, level }, token); await load() } catch (cause) { setError(String(cause)) } }
  async function decide(recId: string, action: string) { try { await decision(recId, { action, modifiedGoal: action === 'modify' ? { level } : undefined, note: action === 'reject' ? reason : '' }, token); await load() } catch (cause) { setError(String(cause)) } }
  async function deactivate(ruleId: string) { try { await api(`/rules/${ruleId}/deactivate`, { method: 'POST' }, token); await load() } catch (cause) { setError(String(cause)) } }
  return <main className="therapist-screen"><Link to="/therapist">← 아동 현황</Link><h1>{data?.child?.hero_name} · {data?.child?.child_code}</h1><p>모험 코드: <strong>{data?.child?.play_code}</strong></p>{error && <p role="alert">{error}</p>}<section className="card"><h2>현재 목표 v{data?.currentGoal?.version}</h2><p>목표 음소 /{data?.currentGoal?.target_phoneme}/ · 현재 단계 {data?.currentGoal?.level}</p><label>다음 목표 단계 <select value={level} onChange={e => setLevel(e.target.value)}><option value="syllable">음절</option><option value="word">단어</option><option value="short_sentence">짧은 문장</option></select></label><button onClick={changeGoal}>목표 저장</button><p>목표 변경은 다음 세션부터 적용됩니다.</p></section><section className="card"><h2>진행 추이</h2><SessionTrendChart sessions={metrics?.sessions || []} />{metrics?.sessions?.length ? <table><thead><tr><th>세션</th><th>목표</th><th>첫 시도 성공률</th><th>재시도 비율</th><th>모드</th></tr></thead><tbody>{metrics.sessions.map((s: any) => <tr key={s.sessionId}><td><Link to={`/therapist/sessions/${s.sessionId}`}>{s.index}</Link></td><td>v{s.goalVersion}</td><td>{s.firstTrySuccessRate}%</td><td>{s.retryRate}%</td><td>{s.isSeed ? '샘플' : s.mode}</td></tr>)}</tbody></table> : <p>관찰 세션이 부족합니다.</p>}</section><section className="card"><h2>AI 추천 · 치료사 결정</h2>{recs.map(rec => <article key={rec.id}><h3>{rec.observation}</h3><p>{rec.suggestion_text}</p><p>근거: {rec.evidence?.map((e: any) => `${e.label}: ${e.value}`).join(' · ')}</p><p>신뢰도: {rec.confidence} · {rec.status}</p>{rec.status === 'pending' && <div><button onClick={() => decide(rec.id, 'accept')}>수락</button><button onClick={() => decide(rec.id, 'modify')}>선택 단계로 수정</button><input aria-label="거절 사유" value={reason} onChange={e => setReason(e.target.value)} placeholder="거절 사유" /><button disabled={!reason.trim()} onClick={() => decide(rec.id, 'reject')}>거절</button></div>}</article>)}</section><section className="card"><h2>적용 규칙</h2>{data?.activeRules?.map((rule: any) => <p key={rule.id}>{rule.rule_type} · {JSON.stringify(rule.params)} <button onClick={() => deactivate(rule.id)}>비활성화</button></p>)}</section><section><h2>세션 기록</h2>{data?.sessions?.map((session: any) => <p key={session.id}><Link to={`/therapist/sessions/${session.id}`}>{new Date(session.startedAt).toLocaleString()} · {session.mode} · {session.status}</Link></p>)}</section></main>
}
