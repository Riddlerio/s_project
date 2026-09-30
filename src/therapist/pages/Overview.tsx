import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { overview } from '../../api/therapist'
import { clearToken, getToken } from '../auth'
import { LEVEL_LABELS } from '../planning'

export interface CaseloadChild { id: string; hero_name: string; child_code: string; age_band: string; currentGoal?: { target_phoneme: string; level: string } | null; pendingRecommendations: number }

/** 치료사 홈: 누구를 볼지 고른다. 아동을 누르면 4영역 작업 공간으로 간다. */
export function CaseloadList({ children }: { children: CaseloadChild[] }) {
  if (!children.length) return <p>담당 아동이 없습니다. 아래에서 등록하세요.</p>
  return <section className="grid" aria-label={`담당 아동 ${children.length}명`}>{children.map(child => <Link className="card" key={child.id} to={`/therapist/children/${child.id}`}><h2>{child.hero_name} · {child.child_code}</h2><p>{child.age_band}세 · 목표 /{child.currentGoal?.target_phoneme}/ · {LEVEL_LABELS[child.currentGoal?.level || ''] || child.currentGoal?.level}</p>{child.pendingRecommendations > 0 && <p>대기 중인 추천 {child.pendingRecommendations}건</p>}</Link>)}</section>
}

export default function Overview() {
  const navigate = useNavigate()
  const token = getToken()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [hero, setHero] = useState('')
  const [consent, setConsent] = useState(false)
  const [newLogin, setNewLogin] = useState<{ play_code: string; initialPassword: string } | null>(null)
  useEffect(() => { if (!token) navigate('/therapist/login'); else overview(token).then(setData).catch(e => setError(String(e))) }, [token, navigate])
  async function add() {
    try { const created = await api<{ play_code: string; initialPassword: string }>('/children', { method: 'POST', body: JSON.stringify({ heroName: hero, guardianConsent: consent }) }, token); setNewLogin(created); setData(await overview(token)); setHero('') }
    catch (cause) { setError(String(cause)) }
  }
  return <main className="therapist-screen"><header><h1>담당 아동 목록</h1><button onClick={() => { void api('/auth/logout', { method: 'POST' }).finally(() => { clearToken(); navigate('/therapist/login') }) }}>로그아웃</button></header>{error && <p role="alert">{error}</p>}<CaseloadList children={data?.activeChildren || []} /><section className="card"><h2>아동 등록</h2><label>용사 이름<input value={hero} onChange={e => setHero(e.target.value)} /></label><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> 보호자 동의를 확인했습니다</label><button disabled={!hero || !consent} onClick={add}>등록</button>{newLogin && <p role="status">아동 로그인 정보(이번 한 번만 표시): 아이디 {newLogin.play_code} · 비밀번호 {newLogin.initialPassword}</p>}</section><section><h2>최근 세션</h2>{data?.recentSessions?.map((session: any) => <p key={session.id}><Link to={`/therapist/sessions/${session.id}`}>{new Date(session.startedAt).toLocaleString()} · {session.mode} · {session.status}</Link></p>)}</section></main>
}
