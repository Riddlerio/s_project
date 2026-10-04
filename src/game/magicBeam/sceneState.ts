import type { HoyaAction } from '../../control/speechGameSignal'

export interface BeamVisualInput { active: boolean; durationMs: number }

export const BEAM_CHAPTERS = [
  { title: '아침 논의 빛', sky: '#dceef3', ground: '#9bba72', light: '#fff1ac', mist: '#f4f8ef', sun: true },
  { title: '참새가 찾아온 논', sky: '#cfeaf1', ground: '#a9bd69', light: '#ffe9a0', mist: '#edf5ed', sun: true },
  { title: '반딧불의 저녁', sky: '#877ca9', ground: '#78845c', light: '#ffdb95', mist: '#e0d9ea', sun: true },
  { title: '바람이 쉬어 가는 들판', sky: '#b9d7d9', ground: '#9fa46a', light: '#fff1c1', mist: '#e5efdf', sun: false },
  { title: '밤의 등불 축제', sky: '#283951', ground: '#596b58', light: '#ffe09a', mist: '#b1c6cd', sun: false },
] as const

export function beamChapter(roundIndex: number) {
  const index = Number.isFinite(roundIndex) ? Math.min(5, Math.max(1, Math.trunc(roundIndex))) : 1
  return BEAM_CHAPTERS[index - 1]
}

export function beamVisualState(action: HoyaAction, input: BeamVisualInput, targetMs: number, reducedMotion = false, paused = false) {
  const duration = Number.isFinite(input.durationMs) ? Math.max(0, input.durationMs) : 0
  const target = Number.isFinite(targetMs) && targetMs > 0 ? targetMs : 1
  return {
    progress: Math.min(1, duration / target),
    quiet: paused || reducedMotion || input.active || ['LISTENING', 'CHARGE', 'BEAM'].includes(action),
    showBeam: !paused && duration > 0 && (input.active || action === 'RELEASE'),
  }
}
