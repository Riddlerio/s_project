import {
  BufferGeometry, CanvasTexture, Float32BufferAttribute, Group, LinearFilter, Mesh, MeshStandardMaterial, Ray, SRGBColorSpace, Vector3,
  type Object3D, type SkinnedMesh,
} from 'three'
import type { HoyaAction } from '../control/speechGameSignal'

/*
 * Meshy 두두 모델의 눈·입은 텍스처에 그려져 있어 형태를 바꿀 수 없다(셰이프 키 없음).
 * 그 위에 얼굴 곡면을 따라 만든 얇은 덧그림(눈 감기·웃는 눈·벌린 입)을 머리 뼈에 붙여 표정을 만든다.
 * 위치는 Blender에서 원본 GLB의 얼굴 텍셀을 3D로 펼쳐 잰 값을 DuduCharacter의 fit 좌표(키 3.25, 발바닥 y=-2.03)로
 * 옮긴 것이다(2026-10-04, assets/dudu3d/README.md). 머리 뼈 좌표를 두 방법으로 비교해 일치함을 확인했다.
 */
type Anchor = { at: [number, number, number]; normal: [number, number, number] }
const EYES: Anchor[] = [
  { at: [-0.279, 0.414, 0.747], normal: [-0.377, 0.112, 0.919] },
  { at: [0.275, 0.415, 0.749], normal: [0.341, 0.079, 0.937] },
]
// 그려진 입선의 가운데 아래 끝. 벌린 입은 여기서 아래로 열린다.
const MOUTH: Anchor = { at: [-0.005, 0.049, 0.781], normal: [0, -0.482, 0.876] }
const EYE_PATCH = { width: 0.2, height: 0.28 }
const MOUTH_PATCH = { width: 0.4, height: 0.28, anchorV: 38 / 180 }
// 렌더된 얼굴 밝기에 맞춘 털색(텍스처 흰색보다 6% 어둡게. 덧그림 가장자리 고리가 보이지 않게 잰 값)
const FUR = '#ebebea'
const INK = '#1d1d20'

export type FaceState = { eyes: 'open' | 'closed' | 'happy'; mouth: number }

// 눈 깜박임 간격(초). 일정하면 기계처럼 보여서 몇 가지 간격을 돌린다.
const BLINK_GAPS = [2.6, 4.1, 3.3, 5.2]
const BLINK_CYCLE = BLINK_GAPS.reduce((sum, gap) => sum + gap, 0)
const BLINK_SEC = 0.13
const SMILE: ReadonlySet<HoyaAction> = new Set<HoyaAction>(['WAVE', 'CHEER', 'ENCOURAGE'])

/**
 * 동작·시간별 표정. 정지 장면(moving=false)에서는 깜박임과 말하기 입 움직임을 멈춘다.
 * speech: 두두 음성 파일로 말하는 중이면 그 소리 크기(0~1, 문장 사이 쉼은 0). 입이 소리를 따라 열린다(환호의 웃는 입은 그대로).
 * null이면(브라우저 음성·말하지 않음) 말하기 입은 일정하게 여닫는다.
 */
export function faceState(action: HoyaAction, time: number, moving: boolean, speech: number | null = null): FaceState {
  const synced = moving && speech !== null && action !== 'CHEER'
  const mouth = synced ? (SMILE.has(action) ? Math.max(0.3, speech) : speech)
    : SMILE.has(action) ? 0.8
      : action === 'TALKING' && moving ? 0.3 + 0.7 * Math.abs(Math.sin(time * 7.5)) * (0.65 + 0.35 * Math.sin(time * 2.3))
        : 0
  if (action === 'CHEER') return { eyes: 'happy', mouth }
  if (!moving) return { eyes: 'open', mouth }
  let t = ((time % BLINK_CYCLE) + BLINK_CYCLE) % BLINK_CYCLE
  for (const gap of BLINK_GAPS) {
    if (t >= gap - BLINK_SEC && t < gap) return { eyes: 'closed', mouth }
    t -= gap
  }
  return { eyes: 'open', mouth }
}

// ---------- 덧그림 텍스처 ----------
function canvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (typeof document === 'undefined') return null
  const element = document.createElement('canvas')
  element.width = width; element.height = height
  const ctx = element.getContext('2d')
  if (!ctx) return null
  draw(ctx)
  const texture = new CanvasTexture(element)
  texture.colorSpace = SRGBColorSpace
  // 밉맵을 만들면 투명 픽셀(검정)이 가장자리에 섞여 어두운 고리가 보인다. 작은 덧그림이라 밉맵 없이 쓴다.
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  return texture
}

/** 털색 타원(가장자리는 부드럽게 사라짐)으로 그려진 눈을 덮고, 감은 눈 선을 긋는다. */
function eyeTexture(kind: 'closed' | 'happy') {
  // 판 비율(0.2 × 0.28)과 같은 128 × 180
  return canvas(128, 180, ctx => {
    ctx.save()
    ctx.translate(64, 90); ctx.scale(1, 82 / 56)
    const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 56)
    fade.addColorStop(0, FUR); fade.addColorStop(0.78, FUR); fade.addColorStop(1, 'rgba(235,235,234,0)')
    ctx.fillStyle = fade
    ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 15
    ctx.beginPath()
    if (kind === 'closed') { ctx.moveTo(30, 96); ctx.quadraticCurveTo(64, 124, 98, 96) } // 감은 눈 ‿
    else { ctx.moveTo(28, 110); ctx.quadraticCurveTo(64, 56, 100, 110) } // 웃는 눈 ∩
    ctx.stroke()
  })
}

/** 입선 아래로 열린 입과 혀. 위쪽 가장자리는 그려진 입선처럼 가운데가 조금 내려간다. */
function mouthTexture() {
  return canvas(256, 180, ctx => {
    const shape = () => {
      ctx.beginPath()
      ctx.moveTo(30, 30); ctx.quadraticCurveTo(128, 46, 226, 30)
      ctx.bezierCurveTo(220, 118, 170, 150, 128, 150)
      ctx.bezierCurveTo(86, 150, 36, 118, 30, 30)
      ctx.closePath()
    }
    shape(); ctx.fillStyle = '#4d2228'; ctx.fill()
    ctx.save(); shape(); ctx.clip()
    ctx.fillStyle = '#ec8d95'; ctx.beginPath(); ctx.ellipse(128, 142, 58, 34, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  })
}

// ---------- 얼굴 곡면을 따르는 판 ----------
type Surface = { triangles: Float32Array }

/** 쉬는 자세에서 얼굴 근처 삼각형의 실제(스키닝 적용) 위치를 모은다. 머리 뼈에 붙은 정점만 계산한다. */
function faceSurface(mesh: SkinnedMesh, head: Object3D, centres: Vector3[], radius: number): Surface {
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes
  const index = mesh.geometry.index
  const headIndex = mesh.skeleton.bones.findIndex(bone => bone === head)
  const points: (Vector3 | undefined)[] = new Array(position.count)
  for (let i = 0; i < position.count; i++) {
    let weight = 0
    for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === headIndex) weight += skinWeight.getComponent(i, k)
    if (weight > 0.3) points[i] = mesh.localToWorld(mesh.getVertexPosition(i, new Vector3()))
  }
  const near = (p: Vector3 | undefined) => !!p && centres.some(centre => p.distanceToSquared(centre) < radius * radius)
  const out: number[] = []
  const count = index ? index.count : position.count
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k)
    if (!ids.every(id => points[id]) || !ids.some(id => near(points[id]))) continue
    for (const id of ids) out.push(points[id]!.x, points[id]!.y, points[id]!.z)
  }
  return { triangles: new Float32Array(out) }
}

// 같은 모델 파일의 복제본은 쉬는 자세가 같아 덧그림 판도 같다. 원본 기하별로 한 번만 만든다(첫 생성 약 25ms, 데스크톱).
type Patches = { eyes: BufferGeometry[]; mouth: BufferGeometry }
const patchCache = new WeakMap<BufferGeometry, Patches>()

function facePatches(mesh: SkinnedMesh, head: Object3D): Patches {
  const cached = patchCache.get(mesh.geometry)
  if (cached) return cached
  const surface = faceSurface(mesh, head, [...EYES, MOUTH].map(anchor => new Vector3(...anchor.at)), 0.3)
  const patches = {
    eyes: EYES.map(anchor => patchGeometry(surface, anchor, EYE_PATCH.width, EYE_PATCH.height)),
    mouth: patchGeometry(surface, MOUTH, MOUTH_PATCH.width, MOUTH_PATCH.height, MOUTH_PATCH.anchorV),
  }
  patchCache.set(mesh.geometry, patches)
  return patches
}

/** 얼굴 앞 평면의 격자점을 곡면에 투영해 덧그림 판을 만든다. 좌표는 fit 공간이다. */
function patchGeometry(surface: Surface, anchor: Anchor, width: number, height: number, anchorV = 0.5) {
  const at = new Vector3(...anchor.at), normal = new Vector3(...anchor.normal).normalize()
  const up = new Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize()
  const right = new Vector3().crossVectors(up, normal).normalize()
  // anchorV: 판에서 기준점의 위치(위에서부터 비율). 입은 위쪽 가장자리 근처가 기준점이다.
  const centre = at.clone().addScaledVector(up, (anchorV - 0.5) * height)
  const segments = 8
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const ray = new Ray(), hit = new Vector3(), best = new Vector3()
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const tri = surface.triangles
  for (let j = 0; j <= segments; j++) {
    for (let i = 0; i <= segments; i++) {
      const u = i / segments, v = j / segments
      const point = centre.clone().addScaledVector(right, (u - 0.5) * width).addScaledVector(up, (v - 0.5) * height)
      ray.set(point.clone().addScaledVector(normal, 0.3), normal.clone().negate())
      let nearest = Infinity
      for (let k = 0; k < tri.length; k += 9) {
        a.fromArray(tri, k); b.fromArray(tri, k + 3); c.fromArray(tri, k + 6)
        if (ray.intersectTriangle(a, b, c, false, hit)) {
          const distance = hit.distanceTo(ray.origin)
          if (distance < nearest) { nearest = distance; best.copy(hit) }
        }
      }
      const placed = Number.isFinite(nearest) ? best.addScaledVector(normal, 0.006) : point
      positions.push(placed.x, placed.y, placed.z)
      uvs.push(u, v)
    }
  }
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const p = j * (segments + 1) + i
      indices.push(p, p + 1, p + segments + 1, p + 1, p + segments + 2, p + segments + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function decalMaterial(map: CanvasTexture) {
  return new MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
}

export type DuduFace = { update(state: FaceState): void; dispose(): void }

/** 쉬는 자세의 모델(fit 적용, 장면에 넣기 전)에 표정 덧그림을 붙인다. 머리 뼈나 메시가 없으면 붙이지 않는다. */
export function attachDuduFace(model: Object3D): DuduFace | null {
  let head: Object3D | null = null, mesh: SkinnedMesh | null = null
  model.traverse(object => {
    if (!head && (object as { isBone?: boolean }).isBone && /head$/i.test(object.name)) head = object
    if (!mesh && (object as { isSkinnedMesh?: boolean }).isSkinnedMesh) mesh = object as SkinnedMesh
  })
  const closed = eyeTexture('closed'), happy = eyeTexture('happy'), open = mouthTexture()
  if (!head || !mesh || !closed || !happy || !open) { closed?.dispose(); happy?.dispose(); open?.dispose(); return null }
  model.updateMatrixWorld(true)
  const patches = facePatches(mesh, head)
  const group = new Group()
  group.name = 'dudu-face'
  const materials = [decalMaterial(closed), decalMaterial(happy), decalMaterial(open)]
  const [closedMaterial, happyMaterial, mouthMaterial] = materials
  const eyes = patches.eyes.map(geometry => new Mesh(geometry, closedMaterial))
  const mouth = new Mesh(patches.mouth, mouthMaterial)
  for (const part of [...eyes, mouth]) { part.visible = false; part.renderOrder = 2; group.add(part) }
  ;(head as Object3D).attach(group)
  // 입은 위쪽 가장자리(입선)를 기준으로 세로로만 줄여 여닫는다.
  const anchorV = 1 - MOUTH_PATCH.anchorV
  let last = ''
  return {
    update(state) {
      const amount = state.mouth < 0.08 ? 0 : Math.min(1, state.mouth)
      const key = `${state.eyes}:${amount.toFixed(2)}`
      if (key === last) return
      last = key
      for (const eye of eyes) {
        eye.visible = state.eyes !== 'open'
        eye.material = state.eyes === 'happy' ? happyMaterial : closedMaterial
      }
      mouth.visible = amount > 0
      if (amount > 0) {
        open.repeat.set(1, 1 / amount)
        open.offset.set(0, anchorV * (1 - 1 / amount))
      }
    },
    dispose() {
      // 판 기하는 다음 복제본이 다시 쓰므로 남긴다.
      group.removeFromParent()
      for (const material of materials) material.dispose()
      closed.dispose(); happy.dispose(); open.dispose()
    },
  }
}
