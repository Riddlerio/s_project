/*
 * 두두 목소리 파일(VOLI 베이직 보이스 '하람', 무료 플랜, 2026-10-05 생성, 16kHz 모노 WAV).
 * 무료 플랜 조건: 비상업적 사용, 출처 표기 필수(VOICE_CREDIT을 화면에 보인다). 자세한 내용: docs/handoff/DUDU_VOICE_VOLI_2026-10-05.md
 * 문장(마침표·느낌표·물음표 단위)이 모두 여기 있으면 파일을 이어 재생하고, 하나라도 없으면 브라우저 음성으로 말한다.
 */
export const VOICE_CREDIT = '이 콘텐츠는 VOLI의 AI보이스를 활용하여 제작되었습니다. https://voli.ai'
export const DUDU_CLIP_BASE = '/assets/voice/dudu/'

/** [앱이 말하는 문장, 파일 이름] */
export const DUDU_CLIPS: readonly (readonly [string, string])[] = [
  ['사!', 'w_sa'],
  ['소!', 'w_so'],
  ['시!', 'w_si'],
  ['수!', 'w_su'],
  ['사과!', 'w_sagwa'],
  ['수박!', 'w_subak'],
  ['시소!', 'w_siso'],
  ['소리!', 'w_sori'],
  ['두두 따라 해 봐.', 'c_model'],
  ['두두가 다시 들려줄게.', 'c_again'],
  ['정말 잘했어!', 'p_great'],
  ['좋아!', 'p_good'],
  ['멋져!', 'p_cool'],
  ['최고야!', 'p_best'],
  ['딱 맞았어!', 'p_perfect'],
  ["바람 소리 '스~'를 먼저 내 볼까?", 'r_wind'],
  ['바람 소리를 조금 더 길게 내 볼까?', 'r_longer'],
  ['바람 소리 좋아!', 'r_windgood'],
  ['끝까지 이어서 말해 볼까?', 'r_through'],
  ['앗, 지나가 버렸네!', 'm_oops'],
  ['한 번 더 온다!', 'm_again'],
  ['남은 길은 두두랑 같이 가자!', 'a_walk'],
  ['도착!', 'a_arrive'],
  ['역시 바람용사야!', 'a_name'],
  ['역시 최고야!', 'a_best'],
  ['오늘 나랑 대구대까지 건넜지!', 'g_crossed'],
  ["'사' 소리를 정말 많이 말했어.", 'g_many'],
  ["집에서도 '사과'라고 말해 볼까?", 'g_home'],
  ['오늘 나랑 얘기해 줘서 고마워.', 'g_thanks'],
  ['다음에 또 만나!', 'g_bye'],
  ['안녕~ 만나서 반가워!', 'h_hello'],
  ['바람용사야.', 'h_name'],
  ['나는 두두야.', 'h_dudu'],
  ['우리 게임 해 볼까?', 'h_game'],
  ["아래 '대구대 건너기'를 눌러 볼래?", 'h_press'],
]

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
