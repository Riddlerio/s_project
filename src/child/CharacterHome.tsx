import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hoya3D } from '../tiger/Hoya3D'
import type { HoyaAction } from '../control/speechGameSignal'
import { api } from '../api/client'

const duduLine = (line: string) => line.replace(/호야|루미/g, '두두')

export default function CharacterHome() {
  const navigate = useNavigate()
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [line, setLine] = useState('안녕! 나는 두두야. 오늘은 어디로 가볼까?')
  const [heroName, setHeroName] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    void api<{ heroName: string }>('/me/home').then(result => setHeroName(result.heroName)).catch(cause => setError(String(cause)))
    const timer = window.setTimeout(() => setAction('CHEER'), 300)
    const settle = window.setTimeout(() => setAction('IDLE'), 1700)
    return () => { window.clearTimeout(timer); window.clearTimeout(settle) }
  }, [])
  function speak(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ko-KR'
      utterance.rate = 0.85
      window.speechSynthesis.speak(utterance)
    }
  }
  async function greet() {
    try {
      const result = await api<{ line: string }>('/me/character/tap', { method: 'POST' })
      const nextLine = duduLine(result.line)
      setLine(nextLine)
      setAction('CHEER')
      speak(nextLine)
      window.setTimeout(() => setAction('IDLE'), 900)
    } catch (cause) { setError(String(cause)) }
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
          <div className="home-actions"><button className="primary-action" onClick={() => navigate('/play/map')}>탐험 지도로 가기 <span aria-hidden="true">→</span></button><button className="secondary-action" onClick={() => { void greet() }}>두두에게 인사하기</button></div>
          {error && <p className="notice" role="alert">{error}</p>}
        </div>
        <div className="home-character"><div className="home-character-halo" aria-hidden="true" /><Hoya3D action={action} /><span className="character-caption">YOUR COMPANION · DUDU</span></div>
      </section>
      <nav className="home-shortcuts" aria-label="두두와 이어가기"><button onClick={() => navigate('/play/map')}><span>01</span><strong>모험 이어가기</strong><span aria-hidden="true">↗</span></button><button onClick={() => navigate('/play/chat')}><span>02</span><strong>두두와 대화하기</strong><span aria-hidden="true">↗</span></button></nav>
    </div>
  </main>
}
