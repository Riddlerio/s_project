import { Box3, Matrix3, Quaternion, Vector3, type AnimationClip, type Object3D } from 'three'

/*
 * Meshy 프리셋 동작은 사람 비율 뼈대에서 옮겨 와 두두(다리가 짧고 머리가 큰 몸)에 그대로 쓰면
 * 두 가지가 어긋난다(2026-10-04 측정, 키 3.25 기준).
 * - 엉덩이가 옆·앞으로 크게 움직여 화면 밖으로 나간다: 양주먹 펀치 0.69, 행복한 점프 0.43.
 * - 엉덩이가 다리 길이보다 깊이 내려가 발이 바닥 아래로 들어간다: 물건 줍기 0.38, 주문 0.26, 점프 착지 0.28.
 * - 물건 줍기는 큰 머리가 바닥에 닿을 만큼 웅크려 공처럼 보인다.
 * 동작 파일은 바꾸지 않고 불러온 뒤 코드에서 보정한다.
 */

const isBone = (object: Object3D) => (object as { isBone?: boolean }).isBone === true

/** 엉덩이 뼈의 수평 이동을 키 3.25 기준 limit 이하로 줄인다. 위아래 움직임(점프·웅크리기)은 그대로 둔다. */
export function limitRootDrift(model: Object3D, clips: AnimationClip[], height: number, limit = 0.3) {
  let hips: Object3D | undefined
  model.traverse(object => { if (!hips && isBone(object) && /hips$/i.test(object.name)) hips = object })
  if (!hips?.parent) return []
  model.updateMatrixWorld(true)
  const size = new Box3().setFromObject(model).getSize(new Vector3())
  const scale = size.y > 0 ? height / size.y : 1
  const toWorld = new Matrix3().setFromMatrix4(hips.parent.matrixWorld)
  const toLocal = toWorld.clone().invert()
  const changed: string[] = []
  const d = new Vector3()
  for (const clip of clips) {
    const track = clip.tracks.find(candidate => candidate.name === `${hips!.name}.position`)
    if (!track || track.getValueSize() !== 3 || track.values.length < 6) continue
    const v = track.values
    const [x0, y0, z0] = [v[0], v[1], v[2]]
    let max = 0
    for (let i = 0; i < v.length; i += 3) {
      d.set(v[i] - x0, v[i + 1] - y0, v[i + 2] - z0).applyMatrix3(toWorld)
      max = Math.max(max, Math.hypot(d.x, d.z) * scale)
    }
    if (max <= limit) continue
    const k = limit / max
    for (let i = 0; i < v.length; i += 3) {
      d.set(v[i] - x0, v[i + 1] - y0, v[i + 2] - z0).applyMatrix3(toWorld)
      d.x *= k; d.z *= k
      d.applyMatrix3(toLocal)
      v[i] = x0 + d.x; v[i + 1] = y0 + d.y; v[i + 2] = z0 + d.z
    }
    changed.push(`${clip.name} ${max.toFixed(2)}→${limit}`)
  }
  return changed
}

/**
 * 동작을 기준 동작의 첫 자세와 섞어 약하게 만든다(같은 이름의 클립을 고쳐 쓴다).
 * 물건 줍기(Collect_Object)는 큰 머리가 바닥에 닿을 만큼 웅크려 공처럼 보여서, 대기 자세와 45%로 섞어 허리를 굽혀 손을 뻗는 정도로 줄인다.
 */
export function softenClip(clips: AnimationClip[], targetHint: string, baseHint: string, weight: number) {
  const find = (hint: string) => clips.find(clip => clip.name.toLowerCase().includes(hint))
  const target = find(targetHint), base = find(baseHint)
  if (!target || !base) return false
  const a = new Quaternion(), b = new Quaternion()
  for (const track of target.tracks) {
    const from = base.tracks.find(candidate => candidate.name === track.name)
    if (!from) continue
    const size = track.getValueSize()
    const v = track.values, start = from.values
    for (let i = 0; i < v.length; i += size) {
      if (size === 4) {
        a.fromArray(start, 0); b.fromArray(v, i)
        a.slerp(b, weight).toArray(v, i)
      } else {
        for (let k = 0; k < size; k++) v[i + k] = start[k] + (v[i + k] - start[k]) * weight
      }
    }
  }
  return true
}

export type Grounding = { apply(): void }

/**
 * 발·발가락 뼈가 쉬는 자세의 높이보다 내려가면 모델 전체를 그만큼 올려 바닥을 뚫지 않게 한다.
 * 점프로 뜨는 것은 막지 않는다. 쉬는 자세(fit 직후, 장면에 넣기 전)에서 만든다.
 */
export function createGrounding(model: Object3D): Grounding | null {
  const feet: Object3D[] = []
  model.traverse(object => { if (isBone(object) && /(Left|Right)(Foot|ToeBase)$/.test(object.name)) feet.push(object) })
  if (!feet.length) return null
  model.updateMatrixWorld(true)
  const rest = feet.map(bone => bone.getWorldPosition(new Vector3()).y)
  const baseY = model.position.y
  const point = new Vector3()
  return {
    apply() {
      model.position.y = baseY
      model.updateMatrixWorld(true)
      let lift = 0
      feet.forEach((bone, i) => {
        bone.getWorldPosition(point)
        model.parent?.worldToLocal(point)
        lift = Math.max(lift, rest[i] - point.y)
      })
      model.position.y = baseY + lift
    },
  }
}
