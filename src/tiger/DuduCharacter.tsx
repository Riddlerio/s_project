import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimationMixer, Box3, LoopOnce, LoopRepeat, Vector3, type AnimationAction, type AnimationClip, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { HoyaAction } from '../control/speechGameSignal'
import { DuduModel } from './DuduModel'
import { DUDU_GLB_URL, ONE_SHOT, pickClip } from './duduClips'
import { attachDuduFace, faceState, type FaceState } from './duduFace'
import { speakingLevel } from '../speech/duduClips'
import { createGrounding, limitRootDrift, softenClip } from './duduMotion'
import { attachDuduTail, swayDuduTail } from './duduTail'
import { applyHeadPerk, createPerkClock, findHeadBone, prefersReducedMotion } from './duduPerk'

/*
 * 두두 캐릭터 진입점. 모델 파일(GLB, 2026-10-04 사용자 승인으로 GLTFLoader 도입)을 먼저 쓰고,
 * 불러오는 중이거나 실패하면 절차형 두두(DuduModel)를 보여 준다. <Hoya3D>의 인터페이스·대체 화면은 바뀌지 않는다.
 */
type Loaded = { scene: Object3D; clips: AnimationClip[] }
let shared: Promise<Loaded | null> | null = null

function loadDudu(): Promise<Loaded | null> {
  shared ??= new GLTFLoader().loadAsync(DUDU_GLB_URL)
    .then(gltf => {
      // 사람 비율 동작을 두두 몸에 맞춘다: 엉덩이의 수평 이동 제한, 물건 줍기 약하게(duduMotion.ts).
      limitRootDrift(gltf.scene, gltf.animations, HEIGHT)
      softenClip(gltf.animations, 'collect', 'happy_sway', 0.45)
      return { scene: gltf.scene, clips: gltf.animations }
    })
    .catch(error => { console.warn('두두 모델 파일을 불러오지 못해 절차형 모델을 씁니다', error); return null })
  return shared
}

// 절차형 모델과 같은 자리·크기: 발바닥 y=-2.03, 키 약 3.25.
const FLOOR_Y = -2.03
const HEIGHT = 3.25

function fit(object: Object3D) {
  const box = new Box3().setFromObject(object)
  const size = box.getSize(new Vector3())
  const scale = size.y > 0 ? HEIGHT / size.y : 1
  object.scale.setScalar(scale)
  const scaled = new Box3().setFromObject(object)
  const center = scaled.getCenter(new Vector3())
  object.position.set(-center.x, FLOOR_Y - scaled.min.y, -center.z)
}

/** 꼬리·표정·바닥 보정은 덧붙임이다. 만들다 실패하면 경고만 남기고 없이 그린다(모델·대체 화면은 그대로). */
function optional<T>(label: string, make: () => T | null): T | null {
  try { return make() } catch (error) { console.warn(`두두 ${label}을 붙이지 못했습니다`, error); return null }
}

// 꼬리를 크게 흔드는 신나는 동작. 듣기 중에는 꼬리도 멈춘다.
const LIVELY: ReadonlySet<HoyaAction> = new Set<HoyaAction>(['CHEER', 'WAVE', 'ENCOURAGE', 'FLY'])

type Props = { action: HoyaAction; animate?: boolean; /** 검토 화면 전용: 표정을 고정한다. */ expression?: FaceState }

function GlbDudu({ data, action, animate, expression }: Props & { data: Loaded; animate: boolean }) {
  const scene = useMemo(() => { const copy = cloneSkinned(data.scene); fit(copy); return copy }, [data])
  const tail = useMemo(() => optional('꼬리', () => attachDuduTail(scene)), [scene])
  const face = useMemo(() => optional('표정', () => attachDuduFace(scene)), [scene])
  const ground = useMemo(() => optional('바닥 보정', () => createGrounding(scene)), [scene])
  // '네 차례' 귀 쫑긋: 듣기로 바뀌는 순간 머리를 위로 잠깐 늘인다(귀가 머리 뼈에 붙어 있음). 움직임 줄이기에서는 하지 않는다.
  const head = useMemo(() => findHeadBone(scene), [scene])
  const perk = useMemo(() => createPerkClock(), [scene])
  const [reduced] = useState(prefersReducedMotion)
  // 정지 장면이 되면 원래 머리 크기로 돌린다(쫑긋 중간에 멈추지 않게).
  useEffect(() => { if (!animate) applyHeadPerk(head, 0) }, [animate, head])
  useEffect(() => () => tail?.dispose(), [tail])
  useEffect(() => () => face?.dispose(), [face])
  // 정지 장면에서도 동작에 맞는 표정(웃는 눈·벌린 입)은 한 번 반영한다.
  useEffect(() => { if (!animate || expression) face?.update(expression ?? faceState(action, 0, false)) }, [face, action, animate, expression])
  const mixer = useMemo(() => new AnimationMixer(scene), [scene])
  const current = useRef<AnimationAction | null>(null)
  const moving = useRef(animate)
  moving.current = animate
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(scene) }, [mixer, scene])
  useEffect(() => {
    const name = pickClip(action, data.clips.map(clip => clip.name))
    const clip = data.clips.find(candidate => candidate.name === name)
    if (!clip) return
    const next = mixer.clipAction(clip)
    if (current.current === next) return
    next.reset()
    next.setLoop(ONE_SHOT.has(action) ? LoopOnce : LoopRepeat, Infinity)
    next.clampWhenFinished = ONE_SHOT.has(action)
    next.play()
    if (moving.current) current.current?.crossFadeTo(next, 0.25, false)
    else current.current?.stop()
    current.current = next
    // 정지 장면에서는 새 동작의 첫 자세를 한 번만 반영한다(절차형 모델과 같은 규칙). 쉬는 자세(팔 벌린 A자)에 멈추지 않게 한다.
    if (!moving.current) { mixer.update(0); ground?.apply() }
  }, [action, data, mixer, ground])
  // 움직임을 멈춰야 하는 장면(듣기·일시정지·움직임 줄이기)에서는 현재 자세에 멈춘다.
  useFrame(({ clock }, delta) => {
    if (!animate) return
    mixer.update(Math.min(delta, 0.05))
    ground?.apply()
    applyHeadPerk(head, perk(action, reduced))
    face?.update(expression ?? faceState(action, clock.elapsedTime, true, speakingLevel()))
    if (tail && action !== 'LISTENING') swayDuduTail(tail, clock.elapsedTime, LIVELY.has(action))
  })
  return <primitive object={scene} />
}

export function DuduCharacter({ action, animate = true, expression }: Props) {
  const [data, setData] = useState<Loaded | null>(null)
  useEffect(() => {
    let active = true
    void loadDudu().then(value => { if (active) setData(value) })
    return () => { active = false }
  }, [])
  return data ? <GlbDudu data={data} action={action} animate={animate} expression={expression} /> : <DuduModel action={action} animate={animate} />
}
