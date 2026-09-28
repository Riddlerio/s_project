import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../../api/therapist'
import { setToken } from '../auth'

export default function Login() {
  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('speechhero')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function submit(event: FormEvent) {
    event.preventDefault()
    try { const result = await login(username, password); if (result.role !== 'THERAPIST') throw new Error('치료사 계정이 아닙니다'); setToken(result.csrfToken); navigate('/therapist') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '로그인에 실패했습니다') }
  }
  return <main className="therapist-screen"><h1>치료사 로그인</h1><form onSubmit={submit}><label>아이디<input value={username} onChange={e => setUsername(e.target.value)} /></label><label>비밀번호<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><button>로그인</button></form>{error && <p role="alert">{error}</p>}<p>데모 계정: demo / speechhero</p></main>
}
