import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile } from '../api/play'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'

export default function PlayEntry() {
  const [code, setCode] = useState(sessionStorage.getItem('speechHero.code') || 'HERO01')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function enter() {
    try { await getProfile(code.trim()); sessionStorage.setItem('speechHero.code', code.trim().toUpperCase()); navigate('/play/map') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '모험 코드를 확인해 주세요') }
  }
  return <main className="child-screen"><h1>모험 코드</h1><p>루미와 만날 준비가 됐나요?</p><input aria-label="모험 코드" value={code} onChange={e => setCode(e.target.value)} maxLength={12} /><button onClick={enter}>다음</button>{error && <p role="alert">{error}</p>}<p className="small">DEMO는 연습용 음성 인식 결과를 사용해요. 실제 음성 인식: {new WebSpeechRecognizer().isAvailable() ? '사용 가능' : '이 브라우저에서 사용 불가'}</p></main>
}
