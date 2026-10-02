import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { demoLogin, login } from '../../api/therapist'
import { setToken } from '../auth'
import { useDemoMode } from '../../shared/useDemoMode'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const demoMode = useDemoMode()
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function submit(event?: FormEvent, demo = false) {
    event?.preventDefault()
    try { const result = demo ? await demoLogin('THERAPIST') : await login(username, password); if (result.role !== 'THERAPIST') throw new Error('치료사 계정이 아닙니다'); setToken(result.csrfToken); navigate('/therapist') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '로그인에 실패했습니다') }
  }
  return <main className="therapist-screen therapist-login"><div className="therapist-login-copy"><p className="eyebrow">THERAPIST WORKSPACE</p><h1>관찰하고,<br />함께 결정해요.</h1><p>아동의 목표와 회기 기록을 살피고, 다음 계획을 직접 정하는 공간입니다.</p></div><form className="therapist-login-card" onSubmit={submit}><p className="eyebrow">SIGN IN</p><h2>치료사 로그인</h2><label>아이디<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></label><label>비밀번호<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label><button>로그인 <span aria-hidden="true">→</span></button>{error && <p role="alert" className="notice">{error}</p>}{demoMode && <div className="therapist-login-demo"><p>DEMO 서버입니다.</p><button type="button" onClick={() => { void submit(undefined, true) }}>DEMO 치료사로 시작</button></div>}</form></main>
}
