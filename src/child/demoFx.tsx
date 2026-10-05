/*
 * 데모 화면 효과: 성공했을 때 "펑!" 터지는 별·종이 조각과 짧은 효과음.
 * 화면 연출일 뿐 임상 자료가 아니다. 깜박임 없이 한 번만 터지고(초당 3회 미만), 빨간색을 쓰지 않으며,
 * 움직임 줄이기에서는 별 하나만 멈춰서 보여 준다. 효과음은 듣기가 끝난 뒤에만 낸다(마이크에 들어가지 않게).
 */
import { VOICE_CREDIT } from '../speech/duduClips'

const COLORS = ['#f4b400', '#7ac13a', '#13a389', '#ffffff', '#ffd75e', '#9be15d']

/** 두두 음성(VOLI 무료 플랜) 출처 표기. 두두가 말하는 화면 아래에 작게 둔다. */
export function VoiceCredit() {
  return <p className="voice-credit">{VOICE_CREDIT}</p>
}

export type PopKind = 'perfect' | 'good'

/** 터지는 효과. key를 바꾸면 다시 터진다. */
export function PopBurst({ kind, label, still }: { kind: PopKind; label: string; still: boolean }) {
  const count = kind === 'perfect' ? 14 : 8
  return <div className={`pop-burst ${kind}${still ? ' still' : ''}`} aria-hidden="true">
    <span className="pop-ring" />
    {!still && Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i + (i % 2 ? 10 : -6)
      const distance = (kind === 'perfect' ? 120 : 85) + (i % 3) * 18
      return <i key={i} className={i % 3 === 0 ? 'star' : 'bit'} style={{ ['--a' as string]: `${angle}deg`, ['--d' as string]: `${distance}px`, ['--c' as string]: COLORS[i % COLORS.length] }} />
    })}
    <strong className="pop-label">{label}</strong>
  </div>
}

let context: AudioContext | null = null
function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null
  try { context ??= new AudioContext(); if (context.state === 'suspended') void context.resume() } catch { return null }
  return context
}

function tone(ctx: AudioContext, at: number, from: number, to: number, ms: number, gain: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator(), amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + ms / 1000)
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000)
  osc.connect(amp).connect(ctx.destination)
  osc.start(at); osc.stop(at + ms / 1000 + 0.02)
}

/** 펑(성공), 딱 맞았을 때는 이어서 반짝 두 음. 휘익(지나감)은 낮고 부드럽게. */
export function playFx(kind: PopKind | 'whoosh') {
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime + 0.01
  if (kind === 'whoosh') { tone(ctx, now, 520, 180, 260, 0.05, 'triangle'); return }
  tone(ctx, now, 180, 620, 120, 0.18, 'triangle')
  if (kind === 'perfect') { tone(ctx, now + 0.12, 880, 880, 140, 0.08); tone(ctx, now + 0.24, 1320, 1320, 220, 0.07) }
}
