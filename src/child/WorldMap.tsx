import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, startPlay } from '../api/play'
import { startActivity } from '../api/activities'
import type { GameKind } from '../control/speechGameSignal'
import type { SessionMode } from '../shared/levels'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'

type Profile = Awaited<ReturnType<typeof getProfile>>
const games: { id: GameKind; chapter: string; title: string; lead: string; prompt: string; symbol: string }[] = [
  { id: 'magic_beam', chapter: '첫 번째 길', title: '빛의 마법', lead: '소리를 길게 이어 빛을 모아요.', prompt: '소리 이어 내기', symbol: '✧' },
  { id: 'sky_climb', chapter: '두 번째 길', title: '하늘 오르기', lead: '한 걸음씩 하늘로 올라가요.', prompt: '호흡과 소리 조절', symbol: '↗' },
  { id: 'monster_adventure', chapter: '세 번째 길', title: '몬스터 모험', lead: '말로 길을 열고 몬스터를 만나요.', prompt: '목표 낱말 연습', symbol: '◇' },
  { id: 'conversation_quest', chapter: '네 번째 길', title: '두두와 소풍', lead: '필요한 것을 고르고 이야기해요.', prompt: '상황 속 말하기', symbol: '☼' },
]

export default function WorldMap() {
  const navigate = useNavigate()
  const code = sessionStorage.getItem('speechHero.code') || ''
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mode, setMode] = useState<SessionMode>('demo')
  const [error, setError] = useState('')
  const [capabilities] = useState(() => detectCapabilities())
  const realAllowed = (game: GameKind | 'legacy_adventure') => mode === 'demo' || supportsRealMode(game, capabilities)
  const anyReal = games.some(game => supportsRealMode(game.id, capabilities))
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
  return <main className="child-screen map-screen"><div className="child-shell">
    <header className="child-header"><button className="header-back" onClick={() => navigate('/play/home')}>← 두두의 집</button><span className="child-brand">D <span>두두의 모험</span></span></header>
    <div className="map-intro"><div><p className="eyebrow">WORLD MAP · 오늘의 탐험</p><h1>{profile?.heroName || '우리'}의 모험 지도</h1><p>어느 길에서 시작해도 좋아요. 각 길에는 다섯 번의 작은 도전이 있어요.</p></div><div className="map-level" aria-label={`레벨 ${profile?.heroLevel || 1}, 반짝이 ${profile?.xp || 0}`}><small>MY JOURNEY</small><strong>Lv. {profile?.heroLevel || 1}</strong><span>반짝이 {profile?.xp || 0}</span></div></div>
    <section className="map-options" aria-label="모험 방법"><div><strong>모험 방법</strong><span>기기와 공간에 맞춰 선택해요.</span></div><fieldset><legend className="sr-only">모험 방법</legend><label className={mode === 'demo' ? 'selected' : ''}><input type="radio" checked={mode === 'demo'} onChange={() => setMode('demo')} /> DEMO 연습</label><label className={mode === 'real' ? 'selected' : ''}><input type="radio" checked={mode === 'real'} disabled={!anyReal} onChange={() => setMode('real')} /> 실제 음성</label></fieldset></section>
    {assigned && <section className="assigned-journey"><span className="assigned-icon" aria-hidden="true">✦</span><div><p className="eyebrow">THERAPIST PICK</p><h2>치료사가 골라 준 길 · {assigned.title}</h2><p>오늘의 목표에 맞춰 추천된 모험이에요.</p></div><button disabled={!realAllowed(assigned.id)} onClick={() => { void enterGame(assigned.id) }}>이 길로 출발 <span aria-hidden="true">→</span></button>{!realAllowed(assigned.id) && <p className="small">{missingText(assigned.id, capabilities)}</p>}</section>}
    <section className="journey-section"><div className="section-heading"><div><p className="eyebrow">CHOOSE A PATH</p><h2>모험의 네 갈래</h2></div><span>각 모험 · 5라운드</span></div><div className="journey-grid">{games.map((game, index) => <article className={`journey-card journey-card-${index + 1}`} key={game.id}><div className="journey-card-top"><span>{game.chapter}</span><span className="journey-symbol" aria-hidden="true">{game.symbol}</span></div><div className="journey-card-content"><small>{game.prompt}</small><h3>{game.title}</h3><p>{game.lead}</p></div><button disabled={!realAllowed(game.id)} onClick={() => { void enterGame(game.id) }} aria-label={`${game.title} 5라운드 시작`}>길 들어가기 <span aria-hidden="true">↗</span></button>{!realAllowed(game.id) && <p className="small">{missingText(game.id, capabilities)}</p>}</article>)}</div></section>
    <section className="map-foot-grid"><div className="map-collection"><p className="eyebrow">COLLECTION</p><h2>모험의 기록</h2><div><span>모은 카드</span><strong>{profile?.monsterCards.join(' · ') || '첫 카드를 기다려요'}</strong></div><div><span>뱃지</span><strong>{profile?.badges.join(' · ') || '첫 모험을 기다려요'}</strong></div></div><div className="legacy-journey"><p className="eyebrow">ALSO AVAILABLE</p><h2>기존 모험</h2><p>이전에 시작한 길도 계속 탐험할 수 있어요.</p><button className="secondary-action" disabled={!realAllowed('legacy_adventure')} onClick={() => { void depart() }}>기존 모험 시작 <span aria-hidden="true">→</span></button><small>진행 기록 {profile?.mapProgress || 0} / 10층</small></div></section>
    <p className="privacy-note">실제 음성 인식에서는 브라우저 제공업체 서버로 음성이 전송될 수 있습니다. 이 서비스는 원본 음성을 저장하지 않습니다.</p>{error && <p className="notice" role="alert">{error}</p>}
  </div></main>
}
