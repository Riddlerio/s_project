import DUDU_VOICE_LINES from '../../../shared/dudu_voice_lines.json'
import DUDU_VOICE_ENVELOPES from '../../../shared/dudu_voice_envelopes.json'
import type { PaceEvent } from './crossingFlow'

/*
 * '대구대 건너기' 박자(2026-10-05 사용자 결정: 박자가 있는 리듬게임으로 바꾼다).
 * 리듬 세상처럼 소리로 박을 먼저 알려 주고, 두두가 부르면 아이가 따라 하는 마디를 쓴다.
 *
 * 마디와 박
 * - 한 카드는 한 마디(4박)다.
 * - 1·2·3박에 '똑' 소리와 함께 카드가 다가오고, 4박에 동그라미에 들어온다. 아이는 4박에 말한다.
 * - 두두가 먼저 들려줄 때(1라운드, 다시 들려주기)는 두 마디가 된다. 앞 마디 4박에 두두가 "사!"라고 부르고, 이어서 아이 마디가 온다.
 *
 * 마이크와 박 맞춤
 * - '똑' 소리는 아이가 말하는 박 전에만 낸다.
 * - 마지막 '똑'(3박)이 다 들린 뒤 마이크를 연다(Phase 4 '네 차례' 규칙, 소리가 아이 말로 잡히지 않게).
 * - 박 맞춤('딱 맞았어!')은 화면 연출이다. 발음 판정은 서버가 하고, 박 맞춤은 저장하지 않는다.
 *
 * 빠르기
 * - 시작 박자는 치료사가 정한다(서버 rhythm.startBpm, 76~100, 기본 84).
 * - 최근 8번 중 7번 이상 성공이면 4BPM 빠르게. 빨라지기 허용이면 100까지, 아니면 시작 박자까지다.
 * - 2번 연속 어려우면 4BPM 느리게, 72까지다.
 * - 바꾼 뒤에는 기록을 비워서 한 번에 하나씩만 바꾼다.
 *
 * 근거(docs/clinical/DAEGU_CROSSING_RATIONALE_2026-10-05.md 4절·7절)
 * - 4~5세는 너무 느린 박에서 오히려 박을 놓친다(80~100BPM).
 * - 속도는 정확도가 확보된 뒤 마지막에 올린다(DTTC, 리듬 세상 설계).
 */
export interface RhythmSetting { startBpm: number; allowFaster: boolean }
export const DEFAULT_RHYTHM: RhythmSetting = { startBpm: 84, allowFaster: true }
export const BPM = { min: 72, max: 100, step: 4, settingMin: 76, settingMax: 100 } as const
export const BEATS_PER_BAR = 4
/** 아이가 말하는 박(4박) 뒤로 한 마디(4박) 더 기다린다. 말을 시작했으면 끝날 때까지 기다린다(화면 쪽 최대 4초). */
export const WINDOW_BEATS = 4
/** '똑' 소리 길이와, 그 뒤 마이크를 열기 전에 조용히 두는 시간(방 울림이 잦아들게). */
export const TICK_MS = 90
export const TICK_TAIL_MS = 160
/** 출력 지연(블루투스 등)은 이만큼까지만 반영한다. */
export const MAX_OUTPUT_LATENCY_MS = 400
/** '딱 맞았어!' 범위: 4박 기준 앞 300ms ~ 뒤 400ms. 아이 반응 지연(사용자 실측 평균 448ms)을 생각해 뒤를 넉넉히 둔다. */
export const PERFECT_EARLY_MS = 300
export const PERFECT_LATE_MS = 400

export const beatMs = (bpm: number) => 60000 / bpm
export const barMs = (bpm: number) => beatMs(bpm) * BEATS_PER_BAR

/** 서버가 준 설정(없거나 이상하면 기본값). 시작 박자는 치료사 설정 범위로 자른다. */
export function rhythmSetting(raw: unknown): RhythmSetting {
  const value = raw && typeof raw === 'object' ? raw as Partial<RhythmSetting> : {}
  const bpm = typeof value.startBpm === 'number' && Number.isFinite(value.startBpm) ? Math.round(value.startBpm) : DEFAULT_RHYTHM.startBpm
  return {
    startBpm: Math.min(BPM.settingMax, Math.max(BPM.settingMin, bpm)),
    allowFaster: typeof value.allowFaster === 'boolean' ? value.allowFaster : DEFAULT_RHYTHM.allowFaster,
  }
}

/** 박 격자(anchor = 어떤 마디의 시작 시각)에서 now + lead 이후의 첫 마디 시작. */
export function nextBarStart(anchor: number, bpm: number, now: number, leadMs = 0): number {
  const at = now + leadMs
  if (at <= anchor) return anchor
  const bar = barMs(bpm)
  return anchor + Math.ceil((at - anchor) / bar - 1e-9) * bar
}

/** 박 격자에서 now 이후의 첫 박. */
export function nextBeat(anchor: number, bpm: number, now: number): number {
  if (now <= anchor) return anchor
  const beat = beatMs(bpm)
  return anchor + Math.ceil((now - anchor) / beat - 1e-9) * beat
}

/** 박 안에서의 위치 0~1(0이 박). 두두가 박에 맞춰 몸을 흔드는 데 쓴다. */
export function beatPhase(anchor: number, bpm: number, now: number): number {
  const beat = beatMs(bpm)
  const phase = ((now - anchor) / beat) % 1
  return phase < 0 ? phase + 1 : phase
}

export interface Bar {
  /** 1~4박 시각 */
  beats: readonly [number, number, number, number]
  /** 카드가 동그라미에 들어오는 박(4박). 아이가 말할 박이다. */
  land: number
  /** 마이크를 여는 때: 3박 '똑'이 다 들린 뒤(출력 지연 포함). 4박보다 늦지 않다. */
  micOpen: number
  /** 기다림이 끝나는 때(4박 + 한 마디) */
  windowEnd: number
}

/** start에서 시작하는 한 마디의 시각들. */
export function bar(start: number, bpm: number, outputLatencyMs = 0): Bar {
  const beat = beatMs(bpm)
  const beats = [start, start + beat, start + 2 * beat, start + 3 * beat] as const
  const latency = Math.max(0, Math.min(MAX_OUTPUT_LATENCY_MS, Number.isFinite(outputLatencyMs) ? outputLatencyMs : 0))
  return { beats, land: beats[3], micOpen: Math.min(beats[3], beats[2] + TICK_MS + TICK_TAIL_MS + latency), windowEnd: beats[3] + WINDOW_BEATS * beat }
}

export type TimingKind = 'perfect' | 'good'
/** 말 시작이 4박 앞 300ms ~ 뒤 400ms 안이면 '딱 맞았어!', 아니면 '펑!'. 성공일 때의 화면 연출만 정한다. */
export function timingKind(onset: number | null, land: number): TimingKind {
  return onset !== null && onset >= land - PERFECT_EARLY_MS && onset <= land + PERFECT_LATE_MS ? 'perfect' : 'good'
}

/** 다음 빠르기. 바뀌었으면 화면이 기록을 비운다(한 번에 하나씩). */
export function nextBpm(bpm: number, history: readonly PaceEvent[], setting: RhythmSetting): number {
  const last2 = history.slice(-2)
  if (last2.length === 2 && last2.every(event => event !== 'success')) return Math.max(BPM.min, bpm - BPM.step)
  const ceiling = setting.allowFaster ? BPM.max : setting.startBpm
  const last8 = history.slice(-8)
  if (last8.length === 8 && last8.filter(event => event === 'success').length >= 7 && bpm < ceiling) return Math.min(ceiling, bpm + BPM.step)
  return bpm
}

const CLIP_ID = new Map((DUDU_VOICE_LINES as unknown as [string, string][]).map(([text, id]) => [text, id]))
const ENVELOPES = DUDU_VOICE_ENVELOPES as unknown as { stepMs: number; clips: Record<string, string> }
/** 소리 크기가 이 단계(0~9) 이상이면 모음이 시작된 것으로 본다. */
const VOWEL_LEVEL = 6
export const DEFAULT_BEAT_LEAD_MS = 160

/**
 * 두두가 "사!"를 박에 맞춰 부를 때, 음성 파일을 박보다 얼마나 먼저 틀지(ms).
 * 말소리의 박은 모음이 시작되는 때로 들리므로, 입 모양 값(40ms 간격)에서 모음 시작까지의 시간을 쓴다.
 * 파일이 없으면 기본값이다.
 */
export function beatLeadMs(text: string): number {
  const id = CLIP_ID.get(text)
  const envelope = id ? ENVELOPES.clips[id] : undefined
  if (!envelope) return DEFAULT_BEAT_LEAD_MS
  const index = [...envelope].findIndex(level => Number(level) >= VOWEL_LEVEL)
  return index > 0 ? index * ENVELOPES.stepMs : DEFAULT_BEAT_LEAD_MS
}

/** 박 표시 문구(카운트인): 1~3박은 '똑', 4박은 말할 박. */
export const COUNT_IN = ['하나', '둘', '셋', '넷'] as const
