export type SpeechGameSignal =
  | { type: 'VOICE_START' }
  | { type: 'VOICE_CONTINUE'; energy01: number }
  | { type: 'VOICE_END' }
  | { type: 'TARGET_SUCCESS' }
  | { type: 'TARGET_RETRY' }
  | { type: 'UNCERTAIN' }
  | { type: 'NO_SPEECH' }

/** daegu_crossing: 5일 데모의 '대구대 건너기'(2026-10-05). 빛의 마법(magic_beam)은 아이 화면에서 숨겼고 기록을 위해 남긴다. */
export type GameKind = 'magic_beam' | 'sky_climb' | 'monster_adventure' | 'conversation_quest' | 'daegu_crossing'
export type HoyaAction = 'IDLE' | 'LISTENING' | 'TALKING' | 'CHARGE' | 'BEAM' | 'RELEASE' | 'FLY' | 'LAND' | 'CAST' | 'ATTACK' | 'WALK_TO' | 'PICK_UP' | 'PUT_IN_BAG' | 'WAVE' | 'CHEER' | 'ENCOURAGE'
  // 호야와 대화하기에서만 명시적으로 쓴다. mapSignalToHoya는 THINKING을 돌려주지 않는다.
  | 'THINKING'

export function mapSignalToHoya(game: GameKind, signal: SpeechGameSignal): HoyaAction {
  if (signal.type === 'UNCERTAIN' || signal.type === 'NO_SPEECH') return 'LISTENING'
  if (signal.type === 'TARGET_RETRY') return 'ENCOURAGE'
  if (signal.type === 'TARGET_SUCCESS') return game === 'monster_adventure' ? 'ATTACK' : game === 'conversation_quest' ? 'PICK_UP' : game === 'sky_climb' ? 'LAND' : 'CHEER'
  if (game === 'magic_beam') return signal.type === 'VOICE_START' ? 'CHARGE' : signal.type === 'VOICE_CONTINUE' ? 'BEAM' : 'RELEASE'
  if (game === 'sky_climb') return signal.type === 'VOICE_START' ? 'CHARGE' : signal.type === 'VOICE_CONTINUE' ? 'FLY' : 'LAND'
  if (game === 'monster_adventure') return signal.type === 'VOICE_START' ? 'CHARGE' : signal.type === 'VOICE_CONTINUE' ? 'CAST' : 'RELEASE'
  return signal.type === 'VOICE_START' ? 'LISTENING' : signal.type === 'VOICE_CONTINUE' ? 'WALK_TO' : 'IDLE'
}
