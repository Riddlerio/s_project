import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hoya3D } from '../tiger/Hoya3D'
import type { HoyaAction } from '../control/speechGameSignal'
import { api } from '../api/client'
import { craftTunaSushi, getMyAdventure, type AdventureInventory } from '../api/adventure'
import { KoreanTts } from '../speech/koreanTts'
import './duduAdventure.css'

const duduLine = (line: string) => line.replace(/호야|루미/g, '두두')

export function PantryView({ bag, busy, onCraft }: { bag: AdventureInventory | null; busy: boolean; onCraft(): void }) {
  return <section className="dudu-pantry" aria-label="소풍 준비"><h2>두두의 소풍 준비</h2>
    <p>벼 수확에서 밥을, 해변 낚시에서 참치를 모아 참치초밥을 만들어요.</p>
    {bag ? <><div className="dudu-pantry-counts"><span>밥 <strong>{bag.inventory.rice}</strong>개</span><span>참치 <strong>{bag.inventory.tuna}</strong>개</span><span>참치초밥 <strong>{bag.crafted.tunaSushi}</strong>개</span></div>
      <p>밥 1개 + 참치 1개 → 참치초밥 1개</p><button disabled={busy || bag.inventory.rice < 1 || bag.inventory.tuna < 1} onClick={onCraft}>{busy ? '소풍 가방에 넣는 중…' : '참치초밥 만들기'}</button>
    </> : <p>소풍 가방을 확인하고 있어요.</p>}
  </section>
}

export default function CharacterHome() {
  const navigate = useNavigate()
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [line, setLine] = useState('안녕! 나는 두두야. 오늘은 어디로 가볼까?')
  const [heroName, setHeroName] = useState('')
  const [error, setError] = useState('')
  const [bag, setBag] = useState<AdventureInventory | null>(null)
  const [crafting, setCrafting] = useState(false)
  const [greeting, setGreeting] = useState(false)
  const [craftMessage, setCraftMessage] = useState('')
  const voice = useRef<KoreanTts | null>(null)
  const mounted = useRef(false)
  const craftRequest = useRef<string | null>(null)
  const craftPending = useRef(false)
  const greetPending = useRef(false)
  useEffect(() => {
    mounted.current = true
    let active = true
    const tts = new KoreanTts(); voice.current = tts
    void api<{ heroName: string }>('/me/home').then(result => { if (active) setHeroName(result.heroName) }).catch(cause => { if (active) setError(String(cause)) })
    void getMyAdventure().then(value => { if (active) setBag(value) }).catch(cause => { if (active) setError(String(cause)) })
    const timer = window.setTimeout(() => setAction('CHEER'), 300)
    const settle = window.setTimeout(() => setAction('IDLE'), 1700)
    return () => { active = false; mounted.current = false; tts.dispose(); window.clearTimeout(timer); window.clearTimeout(settle) }
  }, [])
  async function greet() {
    if (greetPending.current) return
    greetPending.current = true; setGreeting(true)
    const tts = voice.current
    try {
      const result = await api<{ line: string }>('/me/character/tap', { method: 'POST' })
      if (!mounted.current || voice.current !== tts) return
      const nextLine = duduLine(result.line)
      setLine(nextLine)
      setAction('CHEER')
      await tts?.speak(nextLine, { onEnd: () => { if (mounted.current) setAction('IDLE') } }, { rate: 0.85 }).finished
    } catch (cause) { if (mounted.current) setError(String(cause)) }
    finally { greetPending.current = false; if (mounted.current) setGreeting(false) }
  }
  async function craft() {
    if (craftPending.current) return
    craftPending.current = true; setCrafting(true); setError(''); setCraftMessage('')
    try {
      craftRequest.current ??= crypto.randomUUID()
      const result = await craftTunaSushi(craftRequest.current)
      if (!mounted.current) return
      setBag(result); craftRequest.current = null; setCraftMessage('참치초밥을 만들었어! 소풍 가방에 넣어 두었어.')
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '제작 연결을 다시 확인해 주세요') }
    finally { craftPending.current = false; if (mounted.current) setCrafting(false) }
  }
  return <main className="child-screen home-screen">
    <div className="child-shell">
      <header className="child-header"><span className="child-brand">D <span>두두의 모험</span></span><span className="child-header-status"><span aria-hidden="true" /> 오늘의 시작</span></header>
      <section className="home-layout">
        <div className="home-copy">
          <p className="eyebrow">ADVENTURE HOME · 두두의 집</p>
          <h1>{heroName ? `${heroName}, 반가워!` : '다시 만나서 반가워!'}</h1>
          <p className="home-description">두두가 기다리고 있어요. 서두르지 않아도 괜찮아요. 준비되면 함께 다음 길로 가요.</p>
          <div className="home-dialogue" aria-live="polite"><span className="dialogue-icon" aria-hidden="true">“</span><p>{line}</p></div>
          <div className="home-actions"><button className="primary-action" onClick={() => navigate('/play/map')}>탐험 지도로 가기 <span aria-hidden="true">→</span></button><button className="secondary-action" disabled={greeting} onClick={() => { void greet() }}>두두에게 인사하기</button></div>
          {error && <p className="notice" role="alert">{error}</p>}
        </div>
        <div className="home-character"><div className="home-character-halo" aria-hidden="true" /><Hoya3D action={action} /><span className="character-caption">YOUR COMPANION · DUDU</span></div>
      </section>
      <PantryView bag={bag} busy={crafting} onCraft={() => void craft()} />
      {craftMessage && <p role="status">{craftMessage}</p>}
      <nav className="home-shortcuts" aria-label="두두와 이어가기"><button onClick={() => navigate('/play/map')}><span>01</span><strong>모험 이어가기</strong><span aria-hidden="true">↗</span></button><button onClick={() => navigate('/play/chat')}><span>02</span><strong>두두와 대화하기</strong><span aria-hidden="true">↗</span></button></nav>
    </div>
  </main>
}
