import type { Object3D } from 'three'
import type { HoyaAction } from '../control/speechGameSignal'

/*
 * '네 차례' 귀 쫑긋(2026-10-05 Phase 4). 두두가 듣기(LISTENING)로 바뀌는 순간 귀가 한 번 쫑긋 선다.
 * 모델 파일(GLB)에는 귀 뼈가 없고 귀가 머리 뼈에 붙어 있어 머리를 위로 잠깐 늘였다 돌린다. 절차형 모델은 귀를 늘인다.
 * 차임 동안(마이크가 듣기 전) 끝나도록 짧고, 움직임 줄이기·정지 장면에서는 하지 않는다. 화면 연출일 뿐이다.
 */
export const PERK_MS = 380

/** 쫑긋 정도 0~1. 시작 뒤 PERK_MS 동안 한 번 올랐다 내려온다. */
export function perkLevel(elapsedMs: number): number {
  if (!(elapsedMs >= 0) || elapsedMs >= PERK_MS) return 0
  return Math.sin(Math.PI * elapsedMs / PERK_MS)
}

/** 동작이 LISTENING으로 바뀐 때를 기억해 매 프레임의 쫑긋 정도를 돌려준다. still이면 0이다. */
export function createPerkClock(now: () => number = () => performance.now()) {
  let previous: HoyaAction | null = null
  let startedAt = Number.NEGATIVE_INFINITY
  return (action: HoyaAction, still: boolean): number => {
    if (action !== previous) {
      if (action === 'LISTENING' && !still) startedAt = now()
      previous = action
    }
    return still ? 0 : perkLevel(now() - startedAt)
  }
}

/** 움직임 줄이기 설정. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** GLB 머리 뼈를 찾는다(Mixamo 이름 …Head). */
export function findHeadBone(model: Object3D): Object3D | null {
  let head: Object3D | null = null
  model.traverse(object => { if (!head && (object as { isBone?: boolean }).isBone && /head$/i.test(object.name)) head = object })
  return head
}

/** 머리를 위로 늘인다(0이면 원래 크기). 귀가 머리 위에 있어 쫑긋 서 보인다. */
export function applyHeadPerk(head: Object3D | null, level: number): void {
  head?.scale.set(1 - 0.045 * level, 1 + 0.15 * level, 1 - 0.045 * level)
}
