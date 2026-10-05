import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile } from '../api/play'
import { demoLogin, login } from '../api/therapist'
import { setToken } from '../therapist/auth'
import { useDemoMode } from '../shared/useDemoMode'

export default function PlayEntry() {
  const [code, setCode] = useState('')
  const demoMode = useDemoMode()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function enter(demo = false) {
    try {
      let username = code.trim().toUpperCase()
      let result: { csrfToken: string; role: string }
      if (demo) {
        const demoResult = await demoLogin('STUDENT')
        username = demoResult.username
        result = demoResult
      } else result = await login(username, password)
      if (result.role !== 'STUDENT') throw new Error('아동 계정이 아닙니다')
      setToken(result.csrfToken)
      await getProfile(username)
      sessionStorage.setItem('speechHero.code', username)
      // 데모 흐름(2026-10-05): 로그인하면 두두가 바로 인사하는 대화로 간다. 두두의 집·지도는 주소로만 연다.
      navigate('/play/chat', { state: { autostart: true } })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '로그인에 실패했습니다') }
  }
  return <main className="child-screen entry-screen"><div className="child-shell"><header className="child-header"><span className="child-brand">D <span>두두의 모험</span></span><span className="child-header-status">나의 모험으로</span></header><div className="entry-layout"><div className="entry-copy"><p className="eyebrow">YOUR ADVENTURE STARTS HERE</p><h1>천천히,<br />같이 가보자.</h1><p>들어가면 두두가 먼저 인사할 거예요.</p><div className="entry-decoration" aria-hidden="true">✦ <span>작은 소리, 큰 모험</span></div></div><form className="entry-form" onSubmit={event => { event.preventDefault(); void enter() }}><p className="eyebrow">SIGN IN</p><h2>모험 시작</h2><label>아이디<input value={code} onChange={e => setCode(e.target.value)} maxLength={20} autoComplete="username" /></label><label>비밀번호<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label><button type="submit">두두 만나기 <span aria-hidden="true">→</span></button>{error && <p role="alert" className="notice">{error}</p>}{demoMode && <div className="entry-demo"><p className="small">DEMO 서버에서는 가상 입력으로 화면을 체험할 수 있어요.</p><button type="button" className="secondary-action" onClick={() => { void enter(true) }}>DEMO 아동으로 시작</button></div>}</form></div></div></main>
}
