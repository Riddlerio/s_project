/*
 * 데모 화면 효과: 성공했을 때 "펑!" 터지는 별·종이 조각과 짧은 효과음.
 * 화면 연출일 뿐 임상 자료가 아니다. 깜박임 없이 한 번만 터지고(초당 3회 미만), 빨간색을 쓰지 않으며,
 * 움직임 줄이기에서는 별 하나만 멈춰서 보여 준다. 효과음은 듣기가 끝난 뒤에만 낸다(마이크에 들어가지 않게).
 * '네 차례' 차임은 듣기가 열리기 전에만 울리고, 다 들린 뒤에 듣기를 연다(playTurnChime).
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

function tone(ctx: AudioContext, at: number, from: number, to: number, ms: number, gain: number, type: OscillatorType = 'sine'): OscillatorNode {
  const osc = ctx.createOscillator(), amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + ms / 1000)
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000)
  osc.connect(amp).connect(ctx.destination)
  osc.start(at); osc.stop(at + ms / 1000 + 0.02)
  return osc
}

/** 누를 때 불러 효과음 오디오를 깨운다. iOS는 누름 안에서 시작한 오디오만 소리를 낸다(실제 아이폰 확인은 리허설 때). */
export function unlockFx() { audio() }

/** '네 차례' 차임이 끝나는 시각(ms, 예약 여유 포함)과 그 뒤 마이크를 열기 전 조용히 기다리는 시간(방 울림이 잦아들게). */
const CHIME_END_MS = 290
const CHIME_TAIL_MS = 160
/** 차임 뒤 마이크를 열기까지의 기본 시간. 기기 출력 지연(블루투스 등)이 있으면 그만큼 더 기다린다. */
export const TURN_CUE_MS = CHIME_END_MS + CHIME_TAIL_MS

/** 차임이 다 들린 뒤 마이크를 열어도 되는 시간(ms). 출력 지연이 크면 늘리되 1초를 넘기지 않는다. */
export function turnCueWait(outputLatencySec: number | undefined): number {
  const latency = Number.isFinite(outputLatencySec) && (outputLatencySec as number) > 0 ? (outputLatencySec as number) * 1000 : 0
  return Math.round(Math.min(1000, Math.max(TURN_CUE_MS, CHIME_END_MS + latency + CHIME_TAIL_MS)))
}

/**
 * '네 차례' 차임: 부드럽게 올라가는 두 음(솔→레, 약 0.27초). 마이크가 아이 말을 듣기 전에만 부른다.
 * 돌려준 시간(ms)이 지난 뒤에 듣기를 연다(차임이 마이크에 들어가 아이 말로 잡히지 않게). 소리를 못 내도 같은 시간을 쓴다.
 */
export function playTurnChime(): number {
  const ctx = audio()
  if (!ctx) return TURN_CUE_MS
  const now = ctx.currentTime + 0.01
  tone(ctx, now, 784, 784, 110, 0.07)
  tone(ctx, now + 0.1, 1175, 1175, 160, 0.06)
  return turnCueWait(ctx.outputLatency || ctx.baseLatency)
}

/** 예약한 박 소리. 쉬기·화면 정리 때 취소한다. */
export interface TickHandle { cancel(): void }

/**
 * 대구대 건너기의 박 소리 '똑'을 정확한 시각에 예약한다(Web Audio 시계). times는 performance.now() 기준 ms다.
 * 나무 블록 같은 짧은 소리(약 90ms, rhythm.ts의 TICK_MS)이고 첫 박은 조금 높다. 아이가 말하는 박에는 내지 않는다.
 * 소리는 기기 출력 지연만큼 늦게 들리므로, 마이크는 그만큼 더 기다렸다가 연다(rhythm.ts의 bar).
 */
export function scheduleTicks(times: readonly number[], accentFirst = true): TickHandle {
  const ctx = audio()
  if (!ctx) return { cancel() {} }
  const offset = ctx.currentTime - performance.now() / 1000
  const nodes: OscillatorNode[] = []
  times.forEach((time, i) => {
    const at = time / 1000 + offset
    if (at < ctx.currentTime - 0.02) return
    const start = Math.max(at, ctx.currentTime)
    const accent = accentFirst && i === 0
    nodes.push(tone(ctx, start, accent ? 1660 : 1250, accent ? 1480 : 1100, 85, accent ? 0.1 : 0.08, 'triangle'))
    nodes.push(tone(ctx, start, 2600, 2600, 18, 0.03))
  })
  return { cancel: () => nodes.forEach(node => { try { node.stop(); node.disconnect() } catch { /* 이미 끝남 */ } }) }
}

/** 기기 출력 지연(ms). 모르면 0. */
export function outputLatencyMs(): number {
  const ctx = audio()
  return ctx ? Math.round((ctx.outputLatency || ctx.baseLatency || 0) * 1000) : 0
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
