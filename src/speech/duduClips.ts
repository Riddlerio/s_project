/*
 * 두두 목소리 파일(VOLI 베이직 보이스 '하람', 무료 플랜, 2026-10-05 생성, 16kHz 모노 WAV).
 * 무료 플랜 조건: 비상업적 사용, 출처 표기 필수(VOICE_CREDIT을 화면에 보인다). 자세한 내용: docs/handoff/DUDU_VOICE_VOLI_2026-10-05.md
 * 문장(마침표·느낌표·물음표 단위)이 모두 목록에 있으면 파일을 이어 재생하고, 하나라도 없으면 브라우저 음성으로 말한다.
 * 목록은 shared/dudu_voice_lines.json에 있고, 백엔드 테스트가 DEMO 대화 대본의 모든 문장이 목록에 있는지 확인한다.
 */
import DUDU_VOICE_LINES from '../../shared/dudu_voice_lines.json'
import DUDU_VOICE_ENVELOPES from '../../shared/dudu_voice_envelopes.json'

export const VOICE_CREDIT = '이 콘텐츠는 VOLI의 AI보이스를 활용하여 제작되었습니다. https://voli.ai'
export const DUDU_CLIP_BASE = '/assets/voice/dudu/'

/** [앱이 말하는 문장, 파일 이름] */
export const DUDU_CLIPS: readonly (readonly [string, string])[] = DUDU_VOICE_LINES.map(([text, id]) => [text, id] as const)

const CLIP_BY_TEXT = new Map(DUDU_CLIPS.map(([text, id]) => [text, id]))
/** 문장 사이 쉼(ms). 이어 붙인 파일이 한 사람이 말하듯 들리게 짧게 둔다. */
export const CLIP_GAP_MS = 120

/** 마침표·느낌표·물음표 뒤에서 문장을 나눈다. 따옴표·물결(~)·쉼표는 문장 안에 둔다. */
export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map(part => part.trim()).filter(Boolean)
}

/** 모든 문장에 파일이 있으면 재생할 주소 목록, 하나라도 없으면 null(한 말 안에서 목소리가 섞이지 않게). */
export function clipPlan(text: string, clips: ReadonlyMap<string, string> = CLIP_BY_TEXT, base = DUDU_CLIP_BASE): string[] | null {
  const sentences = splitSentences(text)
  if (!sentences.length) return null
  const ids = sentences.map(sentence => clips.get(sentence))
  return ids.every((id): id is string => id !== undefined) ? ids.map(id => `${base}${id}.wav`) : null
}

// AI가 답을 만드는 대화를 하면 그 답은 음성 파일이 없어 브라우저 음성으로 말한다.
// 그래서 이 탭에서는 게임·마무리 인사도 파일을 쓰지 않고 같은 브라우저 음성으로 말한다(2026-10-10 사용자 결정: 두두 목소리 하나).
const CLIP_SOURCE_KEY = 'speechHero.duduVoiceSource'
let clipsAllowed: boolean | null = null

/** 대화를 시작할 때 서버 설정으로 정한다. false면 이 탭을 닫을 때까지 음성 파일을 쓰지 않는다(새로 고침해도 유지). */
export function setDuduClipsAllowed(allowed: boolean): void {
  clipsAllowed = allowed
  try { if (allowed) sessionStorage.removeItem(CLIP_SOURCE_KEY); else sessionStorage.setItem(CLIP_SOURCE_KEY, 'browser') } catch { /* 저장할 수 없으면 이 화면 동안만 유지한다. */ }
}

export function duduClipsAllowed(): boolean {
  if (clipsAllowed !== null) return clipsAllowed
  try { return sessionStorage.getItem(CLIP_SOURCE_KEY) !== 'browser' } catch { return true }
}

export interface ClipHooks { onStart(): void; onEnd(): void; onError(): void }
export interface ClipPlayer {
  plan(text: string): string[] | null
  play(urls: readonly string[], hooks: ClipHooks): { stop(): void }
}

// ---------- 입 모양 맞추기 ----------
// 파일마다 40ms 간격 소리 크기(0~9 글자, scripts/build-voice-envelopes.mjs로 만듦). 재생 위치의 값으로 두두의 입을 연다.
const ENVELOPES = DUDU_VOICE_ENVELOPES.clips as Record<string, string>
const ENVELOPE_STEP_SEC = DUDU_VOICE_ENVELOPES.stepMs / 1000
let speaking: { id: string; gap: boolean } | null = null
const clipId = (url: string) => url.slice(url.lastIndexOf('/') + 1).replace(/\.wav$/, '')

/** 두두 음성 파일 하나의 시각(초)별 소리 크기 0~1. 범위 밖이면 0. */
export function envelopeLevel(id: string, timeSec: number): number {
  const values = ENVELOPES[id]
  const index = Math.floor(timeSec / ENVELOPE_STEP_SEC)
  return values && index >= 0 && index < values.length ? Number(values[index]) / 9 : 0
}

/**
 * 지금 두두가 음성 파일로 말하는 소리 크기(0~1). 문장 사이 쉼에서는 0이다.
 * 파일로 말하지 않을 때(브라우저 음성·말하지 않음)는 null이고, 그때 입은 기존처럼 일정하게 여닫는다.
 */
export function speakingLevel(): number | null {
  if (!speaking) return null
  if (speaking.gap || !sharedAudio || sharedAudio.paused) return 0
  return envelopeLevel(speaking.id, sharedAudio.currentTime)
}

// 모든 두두 음성을 오디오 하나로 재생한다. iOS Safari는 사용자가 누르는 순간에 재생한 적 있는 요소만 이후에도 재생을 허락한다.
let sharedAudio: HTMLAudioElement | null = null
const audioElement = () => (sharedAudio ??= new Audio())

/** 아주 짧은 무음 WAV(8kHz 8bit, 0.05초). 오디오를 깨울 때만 쓴다. */
function silentWavUrl(): string {
  const samples = 400, bytes = new Uint8Array(44 + samples), view = new DataView(bytes.buffer)
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true)
  view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true); text(36, 'data'); view.setUint32(40, samples, true)
  bytes.fill(128, 44)
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
}

/**
 * 사용자가 누르는 처리기(로그인·시작 버튼) 안에서 부른다. 무음을 한 번 재생해 두면 iOS에서도 이후 두두 음성 파일이 나온다.
 * 다른 브라우저에는 영향이 없다. 이미 소리를 내는 중이면 건드리지 않는다.
 */
export function unlockDuduAudio(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const audio = audioElement()
  if (audio.dataset.unlocked || !audio.paused) return
  audio.muted = true
  audio.src = silentWavUrl()
  audio.play().then(() => { audio.pause(); audio.dataset.unlocked = '1' }).catch(() => undefined).finally(() => { audio.muted = false })
}

/** 브라우저 재생기: 파일을 차례로 재생한다. 첫 소리가 나올 때 onStart, 마지막이 끝나면 onEnd, 실패하면 onError. */
export function browserClipPlayer(gapMs = CLIP_GAP_MS): ClipPlayer | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  return {
    plan: text => duduClipsAllowed() ? clipPlan(text) : null,
    play(urls, hooks) {
      const audio = audioElement()
      let index = 0, stopped = false, started = false
      let gap: ReturnType<typeof setTimeout> | undefined
      const mine = { id: '', gap: false }
      const release = () => { if (speaking === mine) speaking = null }
      const detach = () => { audio.onplaying = null; audio.onended = null; audio.onerror = null; release() }
      const fail = () => { if (!stopped) { stopped = true; detach(); hooks.onError() } }
      const next = () => {
        if (stopped) return
        if (index >= urls.length) { detach(); hooks.onEnd(); return }
        audio.muted = false
        mine.id = clipId(urls[index]); mine.gap = false; speaking = mine
        audio.src = urls[index++]
        audio.onplaying = () => { if (!started && !stopped) { started = true; hooks.onStart() } }
        audio.onended = () => { mine.gap = true; gap = setTimeout(next, index < urls.length ? gapMs : 0) }
        audio.onerror = fail
        // 다른 말로 바뀌며 끊긴 재생(AbortError)은 이미 stopped라 실패로 세지 않는다.
        audio.play().catch(fail)
      }
      next()
      return { stop() { stopped = true; clearTimeout(gap); detach(); audio.pause() } }
    },
  }
}
