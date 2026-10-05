import type { GameKind } from '../control/speechGameSignal'

/** 실제 음성 모드에 필요한 브라우저 기능. 서로 독립적으로 판단한다. */
export type SpeechCapability = 'MIC_AVAILABLE' | 'ACOUSTIC_AVAILABLE' | 'ASR_AVAILABLE'
export type Capabilities = Record<SpeechCapability, boolean>

/** 게임별 필요 기능. 지속 발성 게임은 음향 특징만, 단어·대화 게임은 음성 인식 문장도 필요하다. */
export const GAME_REQUIREMENTS: Record<GameKind, SpeechCapability[]> = {
  magic_beam: ['MIC_AVAILABLE', 'ACOUSTIC_AVAILABLE'],
  sky_climb: ['MIC_AVAILABLE', 'ACOUSTIC_AVAILABLE'],
  monster_adventure: ['MIC_AVAILABLE', 'ACOUSTIC_AVAILABLE', 'ASR_AVAILABLE'],
  conversation_quest: ['MIC_AVAILABLE', 'ACOUSTIC_AVAILABLE', 'ASR_AVAILABLE'],
  // 대구대 건너기는 소리 시작의 마찰 구간(음향)으로 판정한다. 음성 인식은 쓰지 않는다.
  daegu_crossing: ['MIC_AVAILABLE', 'ACOUSTIC_AVAILABLE'],
}

type CapabilityScope = {
  navigator?: { mediaDevices?: { getUserMedia?: unknown } }
  isSecureContext?: boolean
  AudioContext?: unknown
  SpeechRecognition?: unknown
  webkitSpeechRecognition?: unknown
}

export function detectCapabilities(scope: CapabilityScope | undefined = typeof window === 'undefined' ? undefined : window as unknown as CapabilityScope): Capabilities {
  if (!scope) return { MIC_AVAILABLE: false, ACOUSTIC_AVAILABLE: false, ASR_AVAILABLE: false }
  return {
    // 브라우저는 HTTPS(또는 localhost) 보안 컨텍스트에서만 마이크를 연다.
    MIC_AVAILABLE: typeof scope.navigator?.mediaDevices?.getUserMedia === 'function' && scope.isSecureContext !== false,
    // AudioCapture가 표준 AudioContext만 쓰므로 같은 기준으로 판단한다.
    ACOUSTIC_AVAILABLE: typeof scope.AudioContext === 'function',
    ASR_AVAILABLE: typeof (scope.SpeechRecognition ?? scope.webkitSpeechRecognition) === 'function',
  }
}

export function missingCapabilities(game: keyof typeof GAME_REQUIREMENTS, capabilities: Capabilities): SpeechCapability[] {
  return GAME_REQUIREMENTS[game].filter(requirement => !capabilities[requirement])
}

export function supportsRealMode(game: keyof typeof GAME_REQUIREMENTS, capabilities: Capabilities): boolean {
  return missingCapabilities(game, capabilities).length === 0
}

const MISSING_TEXT: Record<SpeechCapability, string> = {
  MIC_AVAILABLE: '마이크',
  ACOUSTIC_AVAILABLE: '소리 분석',
  ASR_AVAILABLE: '음성 인식',
}

export function missingText(game: keyof typeof GAME_REQUIREMENTS, capabilities: Capabilities): string {
  const missing = missingCapabilities(game, capabilities)
  return missing.length ? `이 브라우저에서는 ${missing.map(item => MISSING_TEXT[item]).join('·')} 기능을 쓸 수 없어요. DEMO 연습으로 할 수 있어요.` : ''
}
