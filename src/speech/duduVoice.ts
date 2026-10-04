/*
 * 두두 목소리 고르기. 두두는 희망찬 남자 캐릭터 목소리를 쓴다(2026-10-05 사용자 결정).
 * 무료로 바로 쓸 수 있는 것은 브라우저가 주는 음성뿐이라, Edge의 온라인 한국어 남성 음성(InJoon·Hyunsu 등)을 먼저 찾고
 * 없으면 다른 한국어 음성을 쓴다. 검토 화면(voice-mic-check.html)에서 고른 음성·높이는 이 기기에만 저장한다.
 */
export interface DuduVoiceSetting { name: string | null; pitch: number }

/** 기본 높이: 조금 높여 밝은 캐릭터 느낌을 준다. 1이 원래 높이, 브라우저 허용 범위는 0~2. */
export const DUDU_PITCH = 1.15
export const DUDU_VOICE_KEY = 'speechHero.duduVoice'
// 앞쪽이 우선. Microsoft 온라인 한국어 남성 음성 이름 일부.
const PREFERRED_MALE = [/injoon/i, /hyunsu/i, /bongjin/i, /gookmin/i]

type VoiceLike = { name: string; lang: string }

/** 저장한 이름 → 선호 남성 음성 → 아무 한국어 음성 순으로 고른다. 한국어 음성이 없으면 null. */
export function pickDuduVoice<T extends VoiceLike>(voices: readonly T[], savedName?: string | null): T | null {
  const korean = voices.filter(voice => /^ko/i.test(voice.lang))
  const saved = savedName ? korean.find(voice => voice.name === savedName) : undefined
  if (saved) return saved
  for (const pattern of PREFERRED_MALE) {
    const match = korean.find(voice => pattern.test(voice.name))
    if (match) return match
  }
  return korean[0] ?? null
}

export function readDuduVoiceSetting(storage: Pick<Storage, 'getItem'> | null = safeStorage()): DuduVoiceSetting {
  try {
    const raw = storage?.getItem(DUDU_VOICE_KEY)
    const value = raw ? JSON.parse(raw) as Partial<DuduVoiceSetting> : {}
    const pitch = typeof value.pitch === 'number' && value.pitch >= 0.5 && value.pitch <= 2 ? value.pitch : DUDU_PITCH
    return { name: typeof value.name === 'string' ? value.name : null, pitch }
  } catch {
    return { name: null, pitch: DUDU_PITCH }
  }
}

export function saveDuduVoiceSetting(setting: DuduVoiceSetting, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try { storage?.setItem(DUDU_VOICE_KEY, JSON.stringify(setting)) } catch { /* 저장할 수 없는 환경이면 기본값을 쓴다. */ }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

// 브라우저는 음성 목록을 늦게 채운다. 처음 부를 때부터 목록을 기억해 두고 바뀌면 갱신한다.
let cached: SpeechSynthesisVoice[] = []
let watching = false

export function availableVoices(synthesis: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null): SpeechSynthesisVoice[] {
  if (!synthesis || typeof synthesis.getVoices !== 'function') return []
  if (!watching && typeof synthesis.addEventListener === 'function') {
    watching = true
    synthesis.addEventListener('voiceschanged', () => { cached = synthesis.getVoices() })
  }
  const now = synthesis.getVoices()
  if (now.length) cached = now
  return cached
}
