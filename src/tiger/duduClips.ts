import type { HoyaAction } from '../control/speechGameSignal'

/** 모델 파일 경로. 파일이 없거나 불러오지 못하면 절차형 두두(DuduModel)를 그대로 쓴다. */
export const DUDU_GLB_URL = '/assets/dudu/dudu.glb'

/**
 * 17개 동작별로 찾을 애니메이션 이름 후보(앞쪽 우선, 소문자 부분 일치).
 * Meshy·Blender에서 붙인 클립 이름이 바뀌어도 여기만 고치면 된다.
 */
const CLIP_HINTS: Record<HoyaAction, string[]> = {
  // 2026-10-04 Meshy 리깅·프리셋 클립: Happy_Sway_Standing, Listening_Gesture, Talk_with_Left_Hand_on_Hip,
  // Wave_One_Hand, happy_jump_m, Regular_Jump, Motivational_Cheer, mage_soell_cast_3, Punch_Forward_with_Both_Fists,
  // Collect_Object, Walking. (Idle_14는 카메라 반대쪽으로 돌아서서 뺐다.)
  IDLE: ['happy_sway', 'sway', 'idle'],
  LISTENING: ['listen'],
  TALKING: ['talk'],
  CHARGE: ['mage', 'spell', 'cast'],
  BEAM: ['mage', 'spell', 'cast'],
  RELEASE: ['happy_sway', 'idle'],
  FLY: ['regular_jump', 'jump'],
  LAND: ['happy_sway', 'idle'],
  CAST: ['mage', 'spell', 'cast'],
  ATTACK: ['punch', 'attack'],
  WALK_TO: ['walk'],
  PICK_UP: ['collect', 'pick'],
  PUT_IN_BAG: ['collect', 'pick'],
  WAVE: ['wave'],
  CHEER: ['happy_jump', 'cheer', 'jump'],
  ENCOURAGE: ['motivational', 'cheer'],
  THINKING: ['think', 'listen'],
}

/** 이 동작에 쓸 클립 이름. 맞는 것이 없으면 IDLE 클립, 그것도 없으면 첫 클립, 클립이 없으면 null. */
export function pickClip(action: HoyaAction, names: string[]): string | null {
  const lower = names.map(name => name.toLowerCase())
  for (const hint of [...CLIP_HINTS[action], ...CLIP_HINTS.IDLE]) {
    const index = lower.findIndex(name => name.includes(hint))
    if (index >= 0) return names[index]
  }
  return names[0] ?? null
}

/** 한 번만 재생하고 멈추는 동작. 나머지는 반복한다. */
export const ONE_SHOT: ReadonlySet<HoyaAction> = new Set<HoyaAction>(['RELEASE', 'LAND', 'ATTACK', 'PICK_UP', 'PUT_IN_BAG'])
