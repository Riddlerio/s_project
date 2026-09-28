import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, startPlay } from '../api/play'
import type { SessionMode } from '../shared/levels'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'

type Profile = Awaited<ReturnType<typeof getProfile>>
export default function WorldMap() {
  const navigate = useNavigate()
  const code = sessionStorage.getItem('speechHero.code') || ''
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mode, setMode] = useState<SessionMode>('demo')
  const [error, setError] = useState('')
  useEffect(() => { if (!code) navigate('/play'); else getProfile(code).then(setProfile).catch(e => setError(String(e))) }, [code, navigate])
  async function depart() {
    try { const start = await startPlay(code, mode); sessionStorage.setItem('speechHero.play', JSON.stringify(start)); navigate(`/play/session/${start.sessionId}`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '모험을 시작할 수 없어요') }
  }
  return <main className="child-screen"><h1>{profile?.heroName || '용사'}의 모험 지도</h1><p>레벨 {profile?.heroLevel || 1} · 반짝이 {profile?.xp || 0}</p><div className="map">{Array.from({ length: 10 }, (_, i) => <span key={i} className={i < (profile?.mapProgress || 0) ? 'unlocked' : ''}>★ {i + 1}층</span>)}</div><p>모은 카드: {profile?.monsterCards.join(', ') || '아직 없어요'}</p><p>뱃지: {profile?.badges.join(', ') || '첫 모험을 기다려요'}</p><fieldset><legend>모험 방법</legend><label><input type="radio" checked={mode === 'demo'} onChange={() => setMode('demo')} /> DEMO 연습</label><label><input type="radio" checked={mode === 'real'} disabled={!new WebSpeechRecognizer().isAvailable()} onChange={() => setMode('real')} /> 실제 음성</label></fieldset><p className="small">실제 음성 인식은 브라우저 제공업체 서버로 음성이 전송될 수 있어요. 원본 음성은 이 서비스에 저장하지 않아요.</p><button onClick={depart}>출발!</button>{error && <p role="alert">{error}</p>}</main>
}
