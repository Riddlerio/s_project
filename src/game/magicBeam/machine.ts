export type BeamPhase = 'READY' | 'LISTENING' | 'VOICE_DETECTED' | 'BEAM_ACTIVE' | 'VOICE_END' | 'RESULT'
export interface BeamState { phase: BeamPhase; voicedMs: number; targetMs: number; success: boolean | null }
export function initialBeamState(targetMs = 1500): BeamState { return { phase: 'READY', voicedMs: 0, targetMs, success: null } }
export function beamTransition(state: BeamState, event: { type: 'LISTEN' | 'VOICE_START' | 'VOICE_CONTINUE' | 'VOICE_END' | 'RESULT'; voicedMs?: number; outcome?: 'SUCCESS' | 'RETRY' | 'UNCERTAIN' | 'NEUTRAL_CONTINUE' | 'NO_SPEECH' }): BeamState {
  switch (event.type) {
    case 'LISTEN': return { ...state, phase: 'LISTENING', voicedMs: 0, success: null }
    case 'VOICE_START': return { ...state, phase: 'VOICE_DETECTED' }
    case 'VOICE_CONTINUE': return { ...state, phase: 'BEAM_ACTIVE', voicedMs: Math.max(state.voicedMs, event.voicedMs || 0) }
    case 'VOICE_END': return { ...state, phase: 'VOICE_END', voicedMs: Math.max(state.voicedMs, event.voicedMs || 0) }
    case 'RESULT': return event.outcome === 'UNCERTAIN' || event.outcome === 'NEUTRAL_CONTINUE' || event.outcome === 'NO_SPEECH'
      ? { ...state, phase: 'READY', voicedMs: 0, success: null }
      : { ...state, phase: 'RESULT', success: event.outcome === 'SUCCESS' }
  }
}
