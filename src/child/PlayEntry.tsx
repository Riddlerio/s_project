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
      navigate('/play/home')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '로그인에 실패했습니다') }
  }
  return <main className="child-screen"><h1>호야와 모험하기</h1><p>계정으로 로그인해 주세요.</p>
    <label>아이디<input value={code} onChange={e => setCode(e.target.value)} maxLength={12} /></label>
    <label>비밀번호<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    <button onClick={() => { void enter() }}>모험 시작</button>{error && <p role="alert">{error}</p>}
    {demoMode && <p className="small">DEMO 서버입니다. <button type="button" onClick={() => { void enter(true) }}>DEMO 아동으로 시작</button></p>}
  </main>
}
