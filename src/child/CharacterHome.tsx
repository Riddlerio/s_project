import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hoya3D } from '../tiger/Hoya3D'
import type { HoyaAction } from '../control/speechGameSignal'
import { api } from '../api/client'

export default function CharacterHome() {
  const navigate = useNavigate()
  const [action, setAction] = useState<HoyaAction>('IDLE')
  const [line, setLine] = useState('안녕! 나는 호야야.')
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
      setLine(result.line)
      setAction('CHEER')
      speak(result.line)
      window.setTimeout(() => setAction('IDLE'), 900)
    } catch (cause) { setError(String(cause)) }
  }
  return <main className="child-screen"><h1>{heroName ? `${heroName}와 호야의 집` : '호야의 집'}</h1>
    <div style={{ height: '54vh', minHeight: 310 }}><Hoya3D action={action} /></div>
    <p aria-live="polite">{line}</p>
    <button onClick={() => { void greet() }}>호야에게 인사하기</button>{error && <p role="alert">{error}</p>}
    <nav><button onClick={() => navigate('/play/map')}>모험 지도</button><button onClick={() => navigate('/play/map')}>게임하기</button></nav>
  </main>
}
