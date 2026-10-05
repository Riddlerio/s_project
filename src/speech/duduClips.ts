/*
 * 두두 목소리 파일(VOLI 베이직 보이스 '하람', 무료 플랜, 2026-10-05 생성, 16kHz 모노 WAV).
 * 무료 플랜 조건: 비상업적 사용, 출처 표기 필수(VOICE_CREDIT을 화면에 보인다). 자세한 내용: docs/handoff/DUDU_VOICE_VOLI_2026-10-05.md
 * 문장(마침표·느낌표·물음표 단위)이 모두 목록에 있으면 파일을 이어 재생하고, 하나라도 없으면 브라우저 음성으로 말한다.
 * 목록은 shared/dudu_voice_lines.json에 있고, 백엔드 테스트가 DEMO 대화 대본의 모든 문장이 목록에 있는지 확인한다.
 */
import DUDU_VOICE_LINES from '../../shared/dudu_voice_lines.json'

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

export interface ClipHooks { onStart(): void; onEnd(): void; onError(): void }
export interface ClipPlayer {
  plan(text: string): string[] | null
  play(urls: readonly string[], hooks: ClipHooks): { stop(): void }
}

/** 브라우저 재생기: 파일을 차례로 재생한다. 첫 소리가 나올 때 onStart, 마지막이 끝나면 onEnd, 실패하면 onError. */
export function browserClipPlayer(gapMs = CLIP_GAP_MS): ClipPlayer | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  return {
    plan: text => clipPlan(text),
    play(urls, hooks) {
      let index = 0, stopped = false, started = false
      let audio: HTMLAudioElement | null = null
      let gap: ReturnType<typeof setTimeout> | undefined
      const next = () => {
        if (stopped) return
        if (index >= urls.length) { hooks.onEnd(); return }
        audio = new Audio(urls[index++])
        audio.onplaying = () => { if (!started && !stopped) { started = true; hooks.onStart() } }
        audio.onended = () => { gap = setTimeout(next, index < urls.length ? gapMs : 0) }
        audio.onerror = () => { if (!stopped) { stopped = true; hooks.onError() } }
        audio.play().catch(() => { if (!stopped) { stopped = true; hooks.onError() } })
      }
      next()
      return { stop() { stopped = true; clearTimeout(gap); if (audio) { audio.onplaying = audio.onended = audio.onerror = null; audio.pause() } } }
    },
  }
}
