import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile } from '../api/play'
import { startActivity } from '../api/activities'
import { claimActivity, getActiveActivities, type ActiveActivity } from '../api/adventure'
import type { GameKind } from '../control/speechGameSignal'
import type { SessionMode } from '../shared/levels'
import { detectCapabilities, missingText, supportsRealMode } from '../speech/capabilities'
import './duduAdventure.css'

type Profile = Awaited<ReturnType<typeof getProfile>>
const games: { id: GameKind; chapter: string; title: string; lead: string; prompt: string; symbol: string }[] = [
  { id: 'magic_beam', chapter: '첫 번째 길', title: '빛의 마법', lead: '소리를 이어 벼를 수확해요. 2·4라운드에 밥을 모아요.', prompt: '소리 이어 내기 · 벼 수확', symbol: '✧' },
  { id: 'sky_climb', chapter: '두 번째 길', title: '하늘 오르기', lead: '한 걸음씩 하늘로 올라가요.', prompt: '호흡과 소리 조절', symbol: '↗' },
  { id: 'monster_adventure', chapter: '세 번째 길', title: '몬스터 모험', lead: '해변에서 낚시해요. 2·4라운드에 참치를 모아요.', prompt: '목표 낱말 연습 · 해변 낚시', symbol: '◇' },
  { id: 'conversation_quest', chapter: '네 번째 길', title: '두두와 소풍', lead: '필요한 것을 고르고 이야기해요.', prompt: '상황 속 말하기', symbol: '☼' },
]

export default function WorldMap() {
  const navigate = useNavigate()
  const code = sessionStorage.getItem('speechHero.code') || ''
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mode, setMode] = useState<SessionMode>('demo')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeActivities, setActiveActivities] = useState<ActiveActivity[]>([])
  const [takingOver, setTakingOver] = useState<ActiveActivity | null>(null)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [capabilities] = useState(() => detectCapabilities())
  const realAllowed = (game: GameKind) => mode === 'demo' || supportsRealMode(game, capabilities)
  const anyReal = games.some(game => supportsRealMode(game.id, capabilities))
  useEffect(() => { if (!code) navigate('/play'); else void getProfile(code).then(setProfile).catch(cause => setError(String(cause))) }, [code, navigate])
  useEffect(() => {
    let active = true
    void getActiveActivities().then(value => { if (active) setActiveActivities(value.activities) }).catch(cause => { if (active) setError(String(cause)) })
    return () => { active = false }
  }, [])
  async function enterGame(game: GameKind) {
    if (busy) return
    setBusy(true)
    try { const started = await startActivity(game, mode); if (!mounted.current) return; sessionStorage.setItem('speechHero.activity', JSON.stringify(started)); navigate(`/play/activity/${started.sessionId}`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '게임을 시작할 수 없어요') }
    finally { setBusy(false) }
  }
  async function takeOver() {
    if (!takingOver || busy) return
    setBusy(true); setError('')
    try { const live = await claimActivity(takingOver.sessionId, true); if (!mounted.current) return; sessionStorage.setItem('speechHero.activity', JSON.stringify(live)); navigate(`/play/activity/${live.sessionId}`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '모험을 이어받을 수 없어요') }
    finally { setBusy(false) }
  }
  const assigned = games.find(game => game.id === profile?.assignedActivity)
  return <main className="child-screen map-screen"><div className="child-shell">
    <header className="child-header"><button className="header-back" onClick={() => navigate('/play/home')}>← 두두의 집</button><span className="child-brand">D <span>두두의 모험</span></span></header>
    <div className="map-intro"><div><p className="eyebrow">WORLD MAP · 오늘의 탐험</p><h1>{profile?.heroName || '우리'}의 모험 지도</h1><p>어느 길에서 시작해도 좋아요. 각 길에는 다섯 번의 작은 도전이 있어요.</p></div><div className="map-level" aria-label={`레벨 ${profile?.heroLevel || 1}, 반짝이 ${profile?.xp || 0}`}><small>MY JOURNEY</small><strong>Lv. {profile?.heroLevel || 1}</strong><span>반짝이 {profile?.xp || 0}</span></div></div>
    <section className="map-options" aria-label="모험 방법"><div><strong>모험 방법</strong><span>기기와 공간에 맞춰 선택해요.</span></div><fieldset><legend className="sr-only">모험 방법</legend><label className={mode === 'demo' ? 'selected' : ''}><input type="radio" checked={mode === 'demo'} onChange={() => setMode('demo')} /> DEMO 연습</label><label className={mode === 'real' ? 'selected' : ''}><input type="radio" checked={mode === 'real'} disabled={!anyReal} onChange={() => setMode('real')} /> 실제 음성</label></fieldset></section>
    {!!activeActivities.length && <section className="dudu-resume-list" aria-label="저장된 모험"><h2>하던 모험 이어가기</h2>{activeActivities.map(value => {
      const game = games.find(candidate => candidate.id === value.game)
      const supported = value.mode === 'demo' || supportsRealMode(value.game, capabilities)
      return <div key={value.sessionId}><p><strong>{game?.title}</strong> · {value.mode === 'demo' ? 'DEMO' : '실제 음성'} · {value.completedRounds.length}/5 완료</p><button disabled={busy || !supported} onClick={() => setTakingOver(value)}>이어받기 확인</button>{!supported && <p>{missingText(value.game, capabilities)}</p>}</div>
    })}</section>}
    {takingOver && <section className="dudu-resume-confirm" aria-label="이 기기에서 이어받기 확인"><h2>이 기기에서 이어서 할까요?</h2><p>이전 기기는 더 이상 이 모험에 제출할 수 없어요. 저장된 라운드부터 이어가요.</p><button disabled={busy} onClick={() => void takeOver()}>이 기기에서 이어받기</button><button className="quiet" disabled={busy} onClick={() => setTakingOver(null)}>취소</button></section>}
    {assigned && <section className="assigned-journey"><span className="assigned-icon" aria-hidden="true">✦</span><div><p className="eyebrow">THERAPIST PICK</p><h2>치료사가 골라 준 길 · {assigned.title}</h2><p>오늘의 목표에 맞춰 추천된 모험이에요.</p></div><button disabled={!realAllowed(assigned.id)} onClick={() => { void enterGame(assigned.id) }}>이 길로 출발 <span aria-hidden="true">→</span></button>{!realAllowed(assigned.id) && <p className="small">{missingText(assigned.id, capabilities)}</p>}</section>}
    <section className="journey-section"><div className="section-heading"><div><p className="eyebrow">CHOOSE A PATH</p><h2>모험의 네 갈래</h2></div><span>각 모험 · 5라운드</span></div><div className="journey-grid">{games.map((game, index) => <article className={`journey-card journey-card-${index + 1}`} key={game.id}><div className="journey-card-top"><span>{game.chapter}</span><span className="journey-symbol" aria-hidden="true">{game.symbol}</span></div><div className="journey-card-content"><small>{game.prompt}</small><h3>{game.title}</h3><p>{game.lead}</p></div><button disabled={!realAllowed(game.id)} onClick={() => { void enterGame(game.id) }} aria-label={`${game.title} 5라운드 시작`}>길 들어가기 <span aria-hidden="true">↗</span></button>{!realAllowed(game.id) && <p className="small">{missingText(game.id, capabilities)}</p>}</article>)}</div></section>
    <section className="map-foot-grid"><div className="map-collection"><p className="eyebrow">COLLECTION</p><h2>모험의 기록</h2><div><span>모은 카드</span><strong>{profile?.monsterCards.join(' · ') || '첫 카드를 기다려요'}</strong></div><div><span>뱃지</span><strong>{profile?.badges.join(' · ') || '첫 모험을 기다려요'}</strong></div></div></section>
    <p className="privacy-note">실제 음성 인식에서는 브라우저 제공업체 서버로 음성이 전송될 수 있습니다. 이 서비스는 원본 음성을 저장하지 않습니다.</p>{error && <p className="notice" role="alert">{error}</p>}
  </div></main>
}
