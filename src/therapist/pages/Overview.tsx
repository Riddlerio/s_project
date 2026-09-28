import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { overview } from '../../api/therapist'
import { clearToken, getToken } from '../auth'

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
  return <main className="therapist-screen"><header><h1>아동 현황</h1><button onClick={() => { void api('/auth/logout', { method: 'POST' }).finally(() => { clearToken(); navigate('/therapist/login') }) }}>로그아웃</button></header>{error && <p role="alert">{error}</p>}<section className="grid">{data?.activeChildren?.map((child: any) => <Link className="card" key={child.id} to={`/therapist/children/${child.id}`}><h2>{child.hero_name} · {child.child_code}</h2><p>목표 /{child.currentGoal?.target_phoneme}/ · {child.currentGoal?.level}</p><p>대기 중인 추천 {child.pendingRecommendations}건</p></Link>)}</section><section className="card"><h2>아동 등록</h2><label>용사 이름<input value={hero} onChange={e => setHero(e.target.value)} /></label><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> 보호자 동의를 확인했습니다</label><button disabled={!hero || !consent} onClick={add}>등록</button>{newLogin && <p role="status">아동 로그인 정보(이번 한 번만 표시): 아이디 {newLogin.play_code} · 비밀번호 {newLogin.initialPassword}</p>}</section><section><h2>최근 세션</h2>{data?.recentSessions?.map((session: any) => <p key={session.id}><Link to={`/therapist/sessions/${session.id}`}>{new Date(session.startedAt).toLocaleString()} · {session.mode} · {session.status}</Link></p>)}</section></main>
}
