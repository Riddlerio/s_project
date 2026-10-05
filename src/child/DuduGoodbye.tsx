import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { HoyaAction } from '../control/speechGameSignal'
import { KoreanTts } from '../speech/koreanTts'
import { Hoya3D } from '../tiger/Hoya3D'
import { PopBurst } from './demoFx'
import { hasFinalConsonant } from './koreanText'
import './duduDemo.css'

/*
 * 마무리(2026-10-05 데모): 게임을 마치고 대화 화면으로 돌아와 두두가 오늘 한 일을 말하고 인사한다.
 * 아이에게는 시도 횟수만 말한다(점수·정확도 없음). 집에서 해 볼 낱말 하나를 권한다(일반화).
 */
type Arrival = { attempts?: number; word?: string; heroName?: string }

export function goodbyeLines({ attempts = 0, word = '사과' }: Arrival): string[] {
  const sound = word.slice(0, 1)
  const quote = `'${word}'${hasFinalConsonant(word) ? '이라고' : '라고'}`
  return [
    attempts > 0 ? `오늘 나랑 대구대까지 건넜지! '${sound}' 소리를 ${attempts}번이나 말했어.` : '오늘 나랑 대구대까지 건넜지!',
    `집에서도 ${quote} 말해 볼까?`,
    '오늘 나랑 얘기해 줘서 고마워. 다음에 또 만나!',
  ]
}

export default function DuduGoodbye() {
  const navigate = useNavigate()
  const arrival = (useLocation().state as Arrival | null) ?? {}
  const [action, setAction] = useState<HoyaAction>('CHEER')
  const [text, setText] = useState('')
  const [ended, setEnded] = useState(false)
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const tts = new KoreanTts()
    let alive = true
    const lines = goodbyeLines(arrival)
    const speak = (index: number) => {
      if (!alive) return
      if (index >= lines.length) { setAction('IDLE'); setEnded(true); return }
      setText(lines[index])
      const last = index === lines.length - 1
      void tts.speak(lines[index], { onStart: () => setAction(last ? 'WAVE' : 'TALKING') }, { rate: 0.85 }).finished.then(() => speak(index + 1))
    }
    // 먼저 반갑게 점프하고 말한다.
    const timer = window.setTimeout(() => speak(0), 1200)
    return () => { alive = false; window.clearTimeout(timer); tts.dispose() }
  // 도착 정보는 화면에 들어올 때 한 번만 읽는다. 개발 모드의 두 번 실행은 정리에서 첫 타이머를 취소한다.
  }, [])

  return <main className="child-screen game-screen dudu-chat">
    <h1>두두와 대화하기</h1>
    <div className="dudu-chat-stage">
      <Hoya3D action={action} />
      {/* 마지막 박자: 한 번만 터지는 축하(움직임 줄이기에서는 멈춘 별) */}
      <PopBurst kind="perfect" label="오늘의 모험 끝!" still={still} />
    </div>
    <p className="speech-bubble dudu-bubble" aria-live="polite">{text || '\u00a0'}</p>
    {ended && <div className="crossing-controls">
      <button onClick={() => navigate('/play')}>처음으로</button>
    </div>}
  </main>
}
