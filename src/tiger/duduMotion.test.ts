import { AnimationClip, Bone, BoxGeometry, Group, Mesh, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three'
import { describe, expect, it } from 'vitest'
import { createGrounding, limitRootDrift, softenClip } from './duduMotion'

/** 키 3.25 상자와 엉덩이·발 뼈만 있는 작은 모델. */
function model() {
  const root = new Group()
  root.add(new Mesh(new BoxGeometry(1, 3.25, 1)))
  const armature = new Group()
  const hips = new Bone(); hips.name = 'mixamorigHips'; hips.position.set(0, 1, 0)
  const foot = new Bone(); foot.name = 'mixamorigLeftFoot'; foot.position.set(0.2, -1, 0)
  hips.add(foot); armature.add(hips); root.add(armature)
  return { root, hips, foot }
}

describe('두두 동작 보정', () => {
  it('엉덩이의 수평 이동만 0.3까지 줄이고 위아래 움직임은 남긴다', () => {
    const { root } = model()
    const clip = new AnimationClip('Punch', 1, [new VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0, 1, 0, 0.9, 0.5, 1.2])])
    expect(limitRootDrift(root, [clip], 3.25)).toHaveLength(1)
    const v = clip.tracks[0].values
    expect(Math.hypot(v[3], v[5])).toBeCloseTo(0.3, 5)
    expect(v[4]).toBeCloseTo(0.5, 5)
    expect([v[0], v[1], v[2]]).toEqual([0, 1, 0])
  })

  it('수평 이동이 작은 동작은 그대로 둔다', () => {
    const { root } = model()
    const clip = new AnimationClip('Idle', 1, [new VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0, 1, 0, 0.1, 1, 0.1])])
    expect(limitRootDrift(root, [clip], 3.25)).toEqual([])
    expect(Array.from(clip.tracks[0].values)).toEqual(Array.from(new Float32Array([0, 1, 0, 0.1, 1, 0.1])))
  })

  it('약하게 만든 동작은 기준 동작의 첫 자세와 비율만큼 섞인다', () => {
    const turn = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
    const collect = new AnimationClip('Collect_Object', 1, [new QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0], turn.toArray())])
    const idle = new AnimationClip('Happy_Sway_Standing', 1, [new QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0], [0, 0, 0, 1])])
    expect(softenClip([collect, idle], 'collect', 'happy_sway', 0.5)).toBe(true)
    const angle = 2 * Math.acos(new Quaternion().fromArray(collect.tracks[0].values).w)
    expect(angle).toBeCloseTo(Math.PI / 4, 5)
    expect(softenClip([idle], 'collect', 'happy_sway', 0.5)).toBe(false)
  })

  it('발이 쉬는 자세보다 내려가면 모델을 그만큼 올리고, 뜨는 것은 막지 않는다', () => {
    const { root, hips } = model()
    const ground = createGrounding(root)!
    const baseY = root.position.y
    hips.position.y = 0.7 // 웅크려 발이 0.3 내려감
    ground.apply()
    expect(root.position.y - baseY).toBeCloseTo(0.3, 5)
    hips.position.y = 1.5 // 점프
    ground.apply()
    expect(root.position.y).toBeCloseTo(baseY, 5)
  })

  it('발 뼈가 없으면 바닥 보정을 만들지 않는다', () => {
    expect(createGrounding(new Group())).toBeNull()
  })
})
