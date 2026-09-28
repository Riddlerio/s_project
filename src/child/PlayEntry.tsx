import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile } from '../api/play'
import { login } from '../api/therapist'
import { setToken } from '../therapist/auth'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'

export default function PlayEntry() {
  const [code, setCode] = useState('HERO01')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function enter() {
    try {
      const username = code.trim().toUpperCase()
      const result = await login(username, password)
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
    <button onClick={enter}>모험 시작</button>{error && <p role="alert">{error}</p>}
    <p className="small">DEMO 모드 · 음성 인식: {new WebSpeechRecognizer().isAvailable() ? '사용 가능' : '이 브라우저에서 사용할 수 없음'}</p>
  </main>
}
