import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimationMixer, Box3, LoopOnce, LoopRepeat, Vector3, type AnimationAction, type AnimationClip, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { HoyaAction } from '../control/speechGameSignal'
import { DuduModel } from './DuduModel'
import { DUDU_GLB_URL, ONE_SHOT, pickClip } from './duduClips'

/*
 * 두두 캐릭터 진입점. 모델 파일(GLB, 2026-10-04 사용자 승인으로 GLTFLoader 도입)을 먼저 쓰고,
 * 불러오는 중이거나 실패하면 절차형 두두(DuduModel)를 보여 준다. <Hoya3D>의 인터페이스·대체 화면은 바뀌지 않는다.
 */
type Loaded = { scene: Object3D; clips: AnimationClip[] }
let shared: Promise<Loaded | null> | null = null

function loadDudu(): Promise<Loaded | null> {
  shared ??= new GLTFLoader().loadAsync(DUDU_GLB_URL)
    .then(gltf => ({ scene: gltf.scene, clips: gltf.animations }))
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

function GlbDudu({ data, action, animate }: { data: Loaded; action: HoyaAction; animate: boolean }) {
  const scene = useMemo(() => { const copy = cloneSkinned(data.scene); fit(copy); return copy }, [data])
  const mixer = useMemo(() => new AnimationMixer(scene), [scene])
  const current = useRef<AnimationAction | null>(null)
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
    if (current.current) current.current.crossFadeTo(next, 0.25, false)
    current.current = next
  }, [action, data, mixer])
  // 움직임을 멈춰야 하는 장면(듣기·일시정지·움직임 줄이기)에서는 현재 자세에 멈춘다.
  useFrame((_, delta) => { if (animate) mixer.update(Math.min(delta, 0.05)) })
  return <primitive object={scene} />
}

export function DuduCharacter({ action, animate = true }: { action: HoyaAction; animate?: boolean }) {
  const [data, setData] = useState<Loaded | null>(null)
  useEffect(() => {
    let active = true
    void loadDudu().then(value => { if (active) setData(value) })
    return () => { active = false }
  }, [])
  return data ? <GlbDudu data={data} action={action} animate={animate} /> : <DuduModel action={action} animate={animate} />
}
