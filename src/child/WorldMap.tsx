import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, startPlay } from '../api/play'
import { startActivity } from '../api/activities'
import type { GameKind } from '../control/speechGameSignal'
import type { SessionMode } from '../shared/levels'
import { WebSpeechRecognizer } from '../speech/webSpeechRecognizer'

type Profile = Awaited<ReturnType<typeof getProfile>>
const games: { id: GameKind; title: string }[] = [
  { id: 'magic_beam', title: '빛의 마법' }, { id: 'sky_climb', title: '하늘 오르기' },
  { id: 'monster_adventure', title: '몬스터 모험' }, { id: 'conversation_quest', title: '호야와 소풍' },
]

export default function WorldMap() {
  const navigate = useNavigate()
  const code = sessionStorage.getItem('speechHero.code') || ''
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mode, setMode] = useState<SessionMode>('demo')
  const [error, setError] = useState('')
  useEffect(() => { if (!code) navigate('/play'); else void getProfile(code).then(setProfile).catch(cause => setError(String(cause))) }, [code, navigate])
  async function depart() {
    try { const start = await startPlay(code, mode); sessionStorage.setItem('speechHero.play', JSON.stringify(start)); navigate(`/play/session/${start.sessionId}`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '모험을 시작할 수 없어요') }
  }
  async function enterGame(game: GameKind) {
    try { const started = await startActivity(game, mode); sessionStorage.setItem('speechHero.activity', JSON.stringify(started)); navigate(`/play/activity/${started.sessionId}`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '게임을 시작할 수 없어요') }
  }
  const assigned = games.find(game => game.id === profile?.assignedActivity)
  return <main className="child-screen"><h1>{profile?.heroName || '용사'}의 모험 지도</h1>
    <p>레벨 {profile?.heroLevel || 1} · 반짝이 {profile?.xp || 0}</p>
    <div className="map">{Array.from({ length: 10 }, (_, index) => <span key={index} className={index < (profile?.mapProgress || 0) ? 'unlocked' : ''}>★ {index + 1}층</span>)}</div>
    <p>모은 카드: {profile?.monsterCards.join(', ') || '아직 없어요'}</p>
    <p>뱃지: {profile?.badges.join(', ') || '첫 모험을 기다려요'}</p>
    <fieldset><legend>모험 방법</legend><label><input type="radio" checked={mode === 'demo'} onChange={() => setMode('demo')} /> DEMO 연습</label><label><input type="radio" checked={mode === 'real'} disabled={!new WebSpeechRecognizer().isAvailable()} onChange={() => setMode('real')} /> 실제 음성</label></fieldset>
    {assigned && <section className="card"><h2>치료사가 골라 준 모험</h2><p>{assigned.title}</p><button onClick={() => { void enterGame(assigned.id) }}>이 모험 시작</button></section>}
    <p className="small">실제 음성 인식은 브라우저 제공업체 서버로 음성이 전송될 수 있어요. 원본 음성은 이 서비스에 저장하지 않아요.</p>
    <section className="grid">{games.map(game => <button key={game.id} onClick={() => { void enterGame(game.id) }}>{game.title} · 5라운드</button>)}</section>
    <button onClick={() => { void depart() }}>기존 모험</button>{error && <p role="alert">{error}</p>}
  </main>
}
