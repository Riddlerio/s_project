import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type Ref } from 'react'
import {
  BackSide, BufferAttribute, BufferGeometry, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, DoubleSide, FrontSide,
  LatheGeometry, MathUtils, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, SphereGeometry, TubeGeometry,
  Vector2, Vector3, type Group, type Mesh,
} from 'three'
import type { HoyaAction } from '../control/speechGameSignal'

/*
 * 두두 절차형 3D 시제품. 원래 정면 도안(정체성 기준)과 2026-10-03에 받은 정면·측면·후면 조형 도면을
 * 참고해 공간에서 둥근 머리·몸·팔·다리·꼬리·양면 망토를 만든다. 최종 모델 파일(.blend/.glb)이 아니며
 * 털 질감·리그·흉장의 정확한 형태는 임시다. 도면이 저해상도라 곡면 비례는 추정이다.
 */

const FUR = '#fbfaf6'
const STRIPE = '#2f3033'
const CAPE = '#00806c'
const LINING = '#7ac13a'
const SCARF = '#0b8a73'
const EAR_INNER = '#f2c9c4'

// ---------- 줄무늬 텍스처 ----------
type Stripe = { a0: number; a1: number; h0: number; h1: number; w: number; tip?: 'both' | 'end' }
type Mapping = { u(az: number): number; v(h: number): number; width: number; height: number }

/** 방위각(az, 정면 0°에서 +x 방향 양수)·높이(h)로 정한 띠를 그린다. tip=end는 a1 쪽만 뾰족하다. */
function paintStripes(stripes: Stripe[], map: Mapping, ground = FUR) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = map.width; canvas.height = map.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = ground; ctx.fillRect(0, 0, map.width, map.height)
  ctx.fillStyle = STRIPE
  for (const s of stripes) {
    const top: [number, number][] = [], bottom: [number, number][] = []
    for (let i = 0; i <= 24; i++) {
      const k = i / 24
      const taper = s.tip === 'end' ? Math.pow(1 - k, 0.55) * Math.min(1, k * 6 + 0.35) : Math.pow(Math.sin(Math.PI * k), 0.6)
      const az = MathUtils.lerp(s.a0, s.a1, k)
      const h = MathUtils.lerp(s.h0, s.h1, k)
      const x = map.u(az) * map.width
      top.push([x, map.v(h + (s.w * taper) / 2) * map.height])
      bottom.push([x, map.v(h - (s.w * taper) / 2) * map.height])
    }
    for (const shift of [-map.width, 0, map.width]) {
      ctx.beginPath()
      top.forEach(([x, y], i) => i ? ctx.lineTo(x + shift, y) : ctx.moveTo(x + shift, y))
      bottom.reverse().forEach(([x, y]) => ctx.lineTo(x + shift, y)); bottom.reverse()
      ctx.closePath(); ctx.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.anisotropy = 4
  return texture
}

const mirror = (stripes: Stripe[]) => stripes.flatMap(s => [s, { ...s, a0: -s.a0, a1: -s.a1 }])
// u는 이음매에서 접지 않는다. 경계를 넘는 띠는 paintStripes가 좌우로 한 번씩 더 그린다.
// SphereGeometry: u=0.25가 정면(+z), u=0.5가 +x. v는 위도(°)에서 정한다.
const SPHERE_MAP: Mapping = { u: az => 0.25 + az / 360, v: el => (90 - el) / 180, width: 1024, height: 512 }

// 머리: 뒤통수의 좌우 짝 줄(후면 도면), 옆으로 이어져 볼에서 뾰족해지는 줄(정면·측면 도면), 이마 무늬.
const HEAD_STRIPES: Stripe[] = [
  ...mirror([
    { a0: 168, a1: 104, h0: 40, h1: 44, w: 8, tip: 'end' },
    { a0: 168, a1: 47, h0: 15, h1: 22, w: 10, tip: 'end' },
    { a0: 168, a1: 45, h0: -5, h1: -1, w: 10, tip: 'end' },
    { a0: 166, a1: 52, h0: -26, h1: -21, w: 9, tip: 'end' },
    { a0: 64, a1: 40, h0: 46, h1: 50, w: 6, tip: 'end' },
  ]),
  // 이마: 위도가 높을수록 같은 폭에 더 큰 방위각이 필요하다.
  { a0: -24, a1: 24, h0: 60, h1: 60, w: 5.5 },
  { a0: -15, a1: 15, h0: 52, h1: 52, w: 5 },
  { a0: -3, a1: 3, h0: 70, h1: 46, w: 6 },
]

// 몸통(LatheGeometry): u=0이 정면, 0.25가 +x. 높이는 y 좌표다.
const BODY_TOP = -0.08, BODY_BOTTOM = -1.6
const BODY_MAP: Mapping = { u: az => az / 360, v: y => (BODY_TOP - y) / (BODY_TOP - BODY_BOTTOM), width: 512, height: 256 }
const BODY_STRIPES: Stripe[] = mirror([
  { a0: 150, a1: 62, h0: -0.42, h1: -0.38, w: 0.06, tip: 'end' },
  { a0: 160, a1: 58, h0: -0.7, h1: -0.66, w: 0.07, tip: 'end' },
  { a0: 160, a1: 60, h0: -0.98, h1: -0.95, w: 0.07, tip: 'end' },
  { a0: 150, a1: 66, h0: -1.25, h1: -1.22, w: 0.06, tip: 'end' },
])
// 팔·다리(CapsuleGeometry): 바깥쪽(az=90)에만 띠를 둔다. h는 0(아래)~1(위).
const LIMB_MAP: Mapping = { u: az => az / 360, v: h => 1 - h, width: 256, height: 256 }
const limbStripes = (heights: number[]): Stripe[] => heights.map(h => ({ a0: 30, a1: 150, h0: h, h1: h + 0.02, w: 0.07 }))
// 꼬리(TubeGeometry): u는 길이 방향이다.
function paintTail() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 32
  const ctx = canvas.getContext('2d'); if (!ctx) return null
  ctx.fillStyle = FUR; ctx.fillRect(0, 0, 256, 32); ctx.fillStyle = STRIPE
  for (const x of [70, 118, 166, 214]) ctx.fillRect(x, 0, 22, 32)
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace
  return texture
}

// ---------- 형태 ----------
const HEAD_R = new Vector3(0.88, 0.8, 0.8)
const HEAD_Y = 0.66
const MUZZLE = { c: new Vector3(0, -0.3, 0.6), r: new Vector3(0.34, 0.23, 0.24) }

function bodyRadius(y: number) {
  // 아래(엉덩이)에서 위(목)까지. 측면 도면처럼 몸통은 짧고 둥글다.
  const t = (y - BODY_BOTTOM) / (BODY_TOP - BODY_BOTTOM)
  if (t <= 0 || t >= 1) return 0.001
  return 0.56 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06)), 0.45) * (1 - 0.32 * t * t)
}

/** 머리 타원체 표면 위의 점과 법선(머리 중심 기준 좌표). */
function onHead(x: number, y: number, lift = 0.004): { p: [number, number, number]; r: [number, number, number] } {
  const k = 1 - (x / HEAD_R.x) ** 2 - (y / HEAD_R.y) ** 2
  let z = HEAD_R.z * Math.sqrt(Math.max(0.0001, k))
  const m = 1 - ((x - MUZZLE.c.x) / MUZZLE.r.x) ** 2 - ((y - MUZZLE.c.y) / MUZZLE.r.y) ** 2
  let n = new Vector3(x / HEAD_R.x ** 2, y / HEAD_R.y ** 2, z / HEAD_R.z ** 2)
  if (m > 0) {
    const mz = MUZZLE.c.z + MUZZLE.r.z * Math.sqrt(m)
    if (mz > z) { z = mz; n = new Vector3((x - MUZZLE.c.x) / MUZZLE.r.x ** 2, (y - MUZZLE.c.y) / MUZZLE.r.y ** 2, (z - MUZZLE.c.z) / MUZZLE.r.z ** 2) }
  }
  n.normalize()
  return { p: [x + n.x * lift, y + n.y * lift, z + n.z * lift], r: [-Math.asin(MathUtils.clamp(n.y, -1, 1)), Math.atan2(n.x, n.z), 0] }
}

function surfaceCurve(points: [number, number][], lift = 0.012) {
  return new CatmullRomCurve3(points.map(([x, y]) => new Vector3(...onHead(x, y, lift).p)))
}

/** 목에서 뒤로 넓게 퍼지는 양면 망토. s=좌→우, t=위→아래. */
const CAPE_S = 22, CAPE_T = 16
function capePoint(s: number, t: number, flare: number, wave: number, out: Vector3) {
  const range = MathUtils.degToRad(MathUtils.lerp(104, 80, t))
  const beta = (s * 2 - 1) * range
  const radius = MathUtils.lerp(0.4, 1.0 + flare * 0.18, Math.pow(t, 0.8))
  const back = (0.3 + flare * 0.55) * Math.pow(t, 1.25)
  const sway = (0.1 + wave) * t * t
  out.set(Math.sin(beta) * radius + sway, MathUtils.lerp(-0.14, -1.9 + flare * 0.35, t), -Math.cos(beta) * radius * 0.85 - back - 0.02)
  return out
}
function makeCape() {
  const geometry = new BufferGeometry()
  const positions = new Float32Array((CAPE_S + 1) * (CAPE_T + 1) * 3)
  const index: number[] = []
  for (let j = 0; j < CAPE_T; j++) for (let i = 0; i < CAPE_S; i++) {
    const a = j * (CAPE_S + 1) + i, b = a + 1, c = a + CAPE_S + 1, d = c + 1
    index.push(a, b, c, b, d, c) // (b-a)×(c-a)가 바깥을 향한다.
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(index)
  return geometry
}
function shapeCape(geometry: BufferGeometry, flare: number, time: number) {
  const position = geometry.getAttribute('position') as BufferAttribute
  const p = new Vector3()
  for (let j = 0; j <= CAPE_T; j++) for (let i = 0; i <= CAPE_S; i++) {
    const s = i / CAPE_S, t = j / CAPE_T
    const wave = Math.sin(time * 2.1 + t * 3.2 + s * 2.4) * 0.05 * (0.6 + flare)
    capePoint(s, t, flare, wave, p)
    position.setXYZ(j * (CAPE_S + 1) + i, p.x, p.y, p.z)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}

function drawSeal() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const c = 128
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c, c, 124, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#303334'; ctx.lineWidth = 6
  ctx.beginPath(); ctx.arc(c, c, 118, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(c, c, 78, 0, Math.PI * 2); ctx.stroke()
  // 흉장은 근사 표현이다. 공식 엠블럼의 정확한 형태·사용 권한은 별도로 확인한다.
  ctx.fillStyle = '#0086b8'; ctx.beginPath(); ctx.moveTo(126, 72); ctx.lineTo(170, 94); ctx.lineTo(166, 148); ctx.lineTo(126, 170); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#78bd22'; ctx.beginPath(); ctx.moveTo(126, 72); ctx.lineTo(88, 102); ctx.lineTo(96, 150); ctx.lineTo(126, 170); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#edcc28'; ctx.beginPath(); ctx.moveTo(126, 74); ctx.lineTo(150, 105); ctx.lineTo(138, 140); ctx.lineTo(106, 156); ctx.lineTo(96, 110); ctx.closePath(); ctx.fill()
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace
  return texture
}

// ---------- 동작 ----------
interface Pose {
  x: number; y: number; z: number; yaw: number; pitch: number; roll: number; squash: number
  headYaw: number; headPitch: number; headRoll: number
  rA: number; rF: number; rE: number; lA: number; lF: number; lE: number
  legL: number; legR: number; cape: number; tail: number; mouth: number
}
const REST: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, squash: 0, headYaw: 0, headPitch: 0, headRoll: 0,
  rA: 0.82, rF: 0.15, rE: 1.85, lA: 0.14, lF: 0.05, lE: 0.25, legL: 0, legR: 0, cape: 0, tail: 0.2, mouth: 0 }

/** 기존 17개 동작 값을 관절 목표로 바꾼다. 오른쪽(+x)은 원래 도안처럼 허리에 손을 얹는다. */
function poseFor(action: HoyaAction, t: number): Pose {
  const p: Pose = { ...REST, y: Math.sin(t * 1.8) * 0.012, headRoll: Math.sin(t * 0.7) * 0.03, tail: 0.25 + Math.sin(t * 1.4) * 0.15 }
  switch (action) {
    case 'LISTENING': return { ...p, headRoll: -0.16, headYaw: 0.12, headPitch: 0.04, lA: 0.2, lF: 0.2 }
    case 'TALKING': return { ...p, headPitch: Math.sin(t * 5) * 0.04, mouth: 0.35 + Math.abs(Math.sin(t * 7.5)) * 0.65, lA: 0.45, lF: 0.45 + Math.sin(t * 3.5) * 0.15, lE: 0.9 }
    case 'CHARGE': return { ...p, squash: 0.05, pitch: -0.05, rA: 0.35, rF: 0.95, rE: 0.8, lA: 0.35, lF: 0.95, lE: 0.8, cape: 0.3 }
    case 'BEAM': return { ...p, pitch: -0.1, z: 0.08, rA: 0.45, rF: 1.45, rE: 0.05, lA: 0.3, lF: -0.35, lE: 0.3, cape: 0.65, mouth: 0.4 }
    case 'RELEASE': return { ...p, y: 0.04, rA: 0.4, rF: 0.5, rE: 0.4, lA: 0.4, lF: 0.3, lE: 0.4, cape: 0.25 }
    case 'FLY': return { ...p, y: 0.3 + Math.sin(t * 4) * 0.07, pitch: -0.16, rA: 1.25, rF: 0.2, rE: 0.1, lA: 1.25, lF: 0.2, lE: 0.1, legL: -0.35, legR: -0.25, cape: 1 }
    case 'LAND': return { ...p, y: -0.06, squash: 0.12, rA: 0.6, rE: 0.3, lA: 0.6, lE: 0.3, cape: 0.2 }
    case 'CAST': return { ...p, rA: 2.3 + Math.sin(t * 5) * 0.12, rF: 0.25, rE: 0.25, lA: REST.rA, lF: REST.rF, lE: REST.rE, cape: 0.35, headPitch: -0.08 }
    case 'ATTACK': return { ...p, z: 0.16, pitch: -0.13, yaw: -0.12, rA: 0.35, rF: 1.55, rE: 0, lA: 0.35, lF: -0.45, lE: 0.5, legL: 0.25, legR: -0.2, cape: 0.75, mouth: 0.5 }
    case 'WALK_TO': {
      const step = Math.sin(t * 5.5)
      return { ...p, x: Math.sin(t * 1.2) * 0.12, y: Math.abs(Math.cos(t * 5.5)) * 0.05, yaw: 0.55, rA: 0.18, rF: -step * 0.4, rE: 0.25, lA: 0.18, lF: step * 0.4, lE: 0.25, legL: step * 0.45, legR: -step * 0.45, cape: 0.25 }
    }
    case 'PICK_UP': return { ...p, pitch: 0.28, y: -0.08, headPitch: 0.15, rA: 0.25, rF: 0.85, rE: 0.2, lA: 0.25, lF: 0.85, lE: 0.2 }
    case 'PUT_IN_BAG': return { ...p, headRoll: 0.1, headYaw: 0.25, rA: 0.2, rF: 0.75, rE: 1.25 }
    case 'WAVE': return { ...p, headRoll: -0.08, rA: 2.55, rF: 0.15, rE: 0.35 + Math.sin(t * 8) * 0.35 }
    case 'CHEER': {
      const hop = Math.abs(Math.sin(t * 6.5))
      return { ...p, y: hop * 0.22, squash: (0.5 - hop) * 0.08, rA: 2.6, rF: 0.2, rE: 0.2, lA: 2.6, lF: 0.2, lE: 0.2, cape: 0.5, mouth: 0.6, legL: -0.15, legR: -0.15 }
    }
    case 'ENCOURAGE': return { ...p, headPitch: Math.sin(t * 3.2) * 0.07, rA: 0.45, rF: 0.55, rE: 1.95 + Math.sin(t * 6) * 0.15, mouth: 0.3 }
    case 'THINKING': return { ...p, headRoll: 0.15 + Math.sin(t * 0.8) * 0.02, headPitch: -0.06, headYaw: -0.1, rA: 0.12, rF: 1.25, rE: 2.55, lA: REST.rA, lF: REST.rF, lE: REST.rE }
    case 'IDLE': return p
  }
}

// ---------- 모델 ----------
function useMaterials() {
  return useMemo(() => {
    const headMap = paintStripes(HEAD_STRIPES, SPHERE_MAP)
    const bodyMap = paintStripes(BODY_STRIPES, BODY_MAP)
    const armMap = paintStripes(limbStripes([0.52, 0.72]), LIMB_MAP)
    const legMap = paintStripes(limbStripes([0.42, 0.66]), LIMB_MAP)
    const tailMap = paintTail()
    const seal = drawSeal()
    const fur = (map: CanvasTexture | null) => new MeshStandardMaterial({ color: '#ffffff', map, roughness: 0.93 })
    const m = {
      head: fur(headMap), body: fur(bodyMap), arm: fur(armMap), leg: fur(legMap), tail: fur(tailMap), plain: fur(null),
      ink: new MeshStandardMaterial({ color: STRIPE, roughness: 0.6 }),
      eye: new MeshStandardMaterial({ color: '#0f1012', roughness: 0.18, metalness: 0.05 }),
      shine: new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.2 }),
      nose: new MeshStandardMaterial({ color: '#3a3739', roughness: 0.38 }),
      mouth: new MeshStandardMaterial({ color: '#4a2228', roughness: 0.7 }),
      tongue: new MeshStandardMaterial({ color: '#ef8f95', roughness: 0.6 }),
      earInner: new MeshStandardMaterial({ color: EAR_INNER, roughness: 0.9 }),
      earBack: new MeshStandardMaterial({ color: '#3a3b3e', roughness: 0.9 }),
      scarf: new MeshStandardMaterial({ color: SCARF, roughness: 0.85 }),
      capeOut: new MeshStandardMaterial({ color: CAPE, roughness: 0.82, side: FrontSide }),
      capeIn: new MeshStandardMaterial({ color: LINING, roughness: 0.85, side: BackSide }),
      seal: new MeshStandardMaterial({ map: seal, roughness: 0.5, transparent: true, side: DoubleSide }),
      shadow: new MeshStandardMaterial({ color: '#2d4a3d', transparent: true, opacity: 0.16, depthWrite: false }),
    }
    return { m, textures: [headMap, bodyMap, armMap, legMap, tailMap, seal] }
  }, [])
}

function useGeometries() {
  return useMemo(() => {
    const lathe: Vector2[] = []
    for (let i = 0; i <= 28; i++) {
      const y = MathUtils.lerp(BODY_BOTTOM, BODY_TOP, i / 28)
      lathe.push(new Vector2(bodyRadius(y), y))
    }
    const tailCurve = new CatmullRomCurve3([new Vector3(0.1, -1.32, -0.28), new Vector3(0.42, -1.46, -0.42), new Vector3(0.78, -1.34, -0.3),
      new Vector3(0.98, -1.06, -0.12), new Vector3(1.02, -0.86, 0.02)])
    const brow = (sx: number) => surfaceCurve([[0.47 * sx, 0.31], [0.34 * sx, 0.35], [0.2 * sx, 0.27]])
    return {
      body: new LatheGeometry(lathe, 40),
      upper: new CapsuleGeometry(0.15, 0.3, 6, 16),
      fore: new CapsuleGeometry(0.145, 0.24, 6, 16),
      leg: new CapsuleGeometry(0.2, 0.32, 6, 16),
      sphere: new SphereGeometry(1, 48, 32),
      small: new SphereGeometry(1, 20, 14),
      tail: new TubeGeometry(tailCurve, 40, 0.085, 12, false),
      tailTip: tailCurve.getPoint(1),
      browL: new TubeGeometry(brow(-1), 16, 0.024, 8, false),
      browR: new TubeGeometry(brow(1), 16, 0.024, 8, false),
      smile: new TubeGeometry(surfaceCurve([[-0.3, -0.31], [-0.17, -0.42], [0, -0.45], [0.17, -0.42], [0.3, -0.31]], 0.01), 32, 0.02, 8, false),
      philtrum: new TubeGeometry(surfaceCurve([[0, -0.25], [0, -0.44]], 0.01), 6, 0.018, 8, false),
      cape: makeCape(),
    }
  }, [])
}

function Limb({ side, pivot, upper, fore, materials, g }: {
  side: 1 | -1; pivot: Ref<Group>; upper: Ref<Group>; fore: Ref<Group>
  materials: ReturnType<typeof useMaterials>['m']; g: ReturnType<typeof useGeometries>
}) {
  // 왼쪽 팔은 줄무늬가 바깥을 향하도록 축을 반 바퀴 돌린다.
  const flip = side === 1 ? 0 : Math.PI
  return <group ref={pivot} position={[0.44 * side, -0.4, 0.02]}>
    <group ref={upper}>
      <mesh geometry={g.upper} material={materials.arm} position={[0, -0.2, 0]} rotation={[0, flip, 0]} />
      <group ref={fore} position={[0, -0.38, 0]}>
        <mesh geometry={g.fore} material={materials.arm} position={[0, -0.16, 0]} rotation={[0, flip, 0]} />
        <mesh geometry={g.small} material={materials.plain} position={[0, -0.34, 0.01]} scale={[0.18, 0.17, 0.17]} />
      </group>
    </group>
  </group>
}

export function DuduModel({ action }: { action: HoyaAction }) {
  const { m, textures } = useMaterials()
  const g = useGeometries()
  useEffect(() => () => {
    textures.forEach(texture => texture?.dispose())
    Object.values(m).forEach(material => material.dispose())
  }, [m, textures])
  useEffect(() => () => { Object.values(g).forEach(value => (value as { dispose?: () => void }).dispose?.()) }, [g])

  const root = useRef<Group>(null)
  const head = useRef<Group>(null)
  const rPivot = useRef<Group>(null), rUpper = useRef<Group>(null), rFore = useRef<Group>(null)
  const lPivot = useRef<Group>(null), lUpper = useRef<Group>(null), lFore = useRef<Group>(null)
  const legL = useRef<Group>(null), legR = useRef<Group>(null)
  const tail = useRef<Group>(null)
  const mouth = useRef<Mesh>(null)
  const eyes = useRef<Group>(null)
  const pose = useRef<Pose>({ ...REST })
  const capeFlare = useRef(0)

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const d = Math.min(delta, 0.05)
    const target = poseFor(action, t)
    const p = pose.current
    for (const key of Object.keys(target) as (keyof Pose)[]) p[key] = MathUtils.damp(p[key], target[key], key === 'mouth' ? 14 : 9, d)
    if (root.current) {
      root.current.position.set(p.x, p.y, p.z)
      root.current.rotation.set(p.pitch, p.yaw, p.roll)
      root.current.scale.set(1 + p.squash * 0.6, 1 - p.squash, 1 + p.squash * 0.6)
    }
    head.current?.rotation.set(p.headPitch, p.headYaw, p.headRoll)
    const arm = (pivot: Group | null, upper: Group | null, fore: Group | null, side: 1 | -1, a: number, f: number, e: number) => {
      pivot?.rotation.set(-f, 0, 0)
      upper?.rotation.set(0, 0, side * a)
      fore?.rotation.set(-e * 0.35, 0, -side * e)
    }
    arm(rPivot.current, rUpper.current, rFore.current, 1, p.rA, p.rF, p.rE)
    arm(lPivot.current, lUpper.current, lFore.current, -1, p.lA, p.lF, p.lE)
    legL.current?.rotation.set(-p.legL, 0, 0)
    legR.current?.rotation.set(-p.legR, 0, 0)
    tail.current?.rotation.set(0, Math.sin(t * 2.4) * p.tail, Math.sin(t * 1.2) * 0.05)
    if (mouth.current) mouth.current.scale.y = 0.004 + p.mouth * 0.075
    if (eyes.current) {
      const blink = (t % 3.7) < 0.12 ? 0.12 : 1
      eyes.current.scale.y = MathUtils.damp(eyes.current.scale.y, blink, 30, d)
    }
    capeFlare.current = p.cape
    shapeCape(g.cape, capeFlare.current, t)
  })

  const eye = (sx: number) => {
    const { p, r } = onHead(0.29 * sx, 0.06, -0.012)
    const shine = onHead(0.29 * sx + 0.035, 0.12, 0.03)
    return <group key={sx}>
      <mesh geometry={g.small} material={m.eye} position={p} rotation={r} scale={[0.078, 0.112, 0.05]} />
      <mesh geometry={g.small} material={m.shine} position={shine.p} scale={[0.021, 0.026, 0.012]} />
    </group>
  }
  const nose = onHead(0, -0.19, -0.02)
  const mouthAt = onHead(0, -0.47, -0.012)

  return <group>
    {/* 바닥 접지 그림자 */}
    <mesh position={[0, -2.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.shadow}><circleGeometry args={[0.95, 40]} /></mesh>
    <group ref={root}>
      <mesh geometry={g.cape} material={m.capeOut} />
      <mesh geometry={g.cape} material={m.capeIn} />

      <group ref={legL} position={[-0.25, -1.48, 0]}>
        <mesh geometry={g.leg} material={m.leg} position={[0, -0.2, 0]} rotation={[0, Math.PI, 0]} />
        <mesh geometry={g.small} material={m.plain} position={[0, -0.46, 0.08]} scale={[0.25, 0.14, 0.31]} />
        {[-0.07, 0.07].map(x => <mesh key={x} geometry={g.small} material={m.ink} position={[x, -0.4, 0.35]} scale={[0.012, 0.045, 0.012]} />)}
      </group>
      <group ref={legR} position={[0.25, -1.48, 0]}>
        <mesh geometry={g.leg} material={m.leg} position={[0, -0.2, 0]} />
        <mesh geometry={g.small} material={m.plain} position={[0, -0.46, 0.08]} scale={[0.25, 0.14, 0.31]} />
        {[-0.07, 0.07].map(x => <mesh key={x} geometry={g.small} material={m.ink} position={[x, -0.4, 0.35]} scale={[0.012, 0.045, 0.012]} />)}
      </group>

      <mesh geometry={g.body} material={m.body} scale={[1, 1, 0.86]} />
      <mesh material={m.seal} position={[0, -0.66, bodyRadius(-0.66) * 0.86 + 0.006]} rotation={[0.06, 0, 0]}><circleGeometry args={[0.16, 40]} /></mesh>

      <group ref={tail} position={[0.08, -1.3, -0.25]}>
        <mesh geometry={g.tail} material={m.tail} position={[-0.08, 1.3, 0.25]} />
        <mesh geometry={g.small} material={m.ink} position={[g.tailTip.x - 0.08, g.tailTip.y + 1.3, g.tailTip.z + 0.25]} scale={0.088} />
      </group>

      <Limb side={1} pivot={rPivot} upper={rUpper} fore={rFore} materials={m} g={g} />
      <Limb side={-1} pivot={lPivot} upper={lUpper} fore={lFore} materials={m} g={g} />

      {/* 스카프: 목둘레 고리와 앞 매듭·두 자락 */}
      <mesh material={m.scarf} position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.86, 1]}><torusGeometry args={[0.33, 0.085, 14, 40]} /></mesh>
      <mesh geometry={g.small} material={m.scarf} position={[0, -0.18, 0.33]} scale={[0.1, 0.085, 0.07]} />
      <mesh geometry={g.small} material={m.scarf} position={[-0.09, -0.3, 0.33]} rotation={[0.2, 0, -0.55]} scale={[0.055, 0.13, 0.03]} />
      <mesh geometry={g.small} material={m.scarf} position={[0.09, -0.3, 0.33]} rotation={[0.2, 0, 0.55]} scale={[0.055, 0.13, 0.03]} />

      <group ref={head} position={[0, -0.12, 0.02]}>
        <group position={[0, HEAD_Y + 0.12, 0]}>
          <mesh geometry={g.sphere} material={m.head} scale={HEAD_R.toArray()} />
          <mesh geometry={g.small} material={m.plain} position={MUZZLE.c.toArray()} scale={MUZZLE.r.toArray()} />
          {[-1, 1].map(sx => <group key={sx} position={[0.6 * sx, 0.6, -0.08]} rotation={[0, 0, -0.42 * sx]}>
            <mesh geometry={g.small} material={m.earBack} scale={[0.27, 0.25, 0.12]} position={[0, 0, -0.025]} />
            <mesh geometry={g.small} material={m.plain} scale={[0.25, 0.23, 0.11]} />
            <mesh geometry={g.small} material={m.earInner} scale={[0.15, 0.14, 0.06]} position={[0, -0.02, 0.07]} />
          </group>)}
          <group ref={eyes} position={[0, 0.06, 0]}>
            <group position={[0, -0.06, 0]}>{eye(-1)}{eye(1)}</group>
          </group>
          <mesh geometry={g.browL} material={m.ink} />
          <mesh geometry={g.browR} material={m.ink} />
          <mesh geometry={g.small} material={m.nose} position={nose.p} rotation={nose.r} scale={[0.13, 0.085, 0.08]} />
          <mesh geometry={g.philtrum} material={m.ink} />
          <mesh geometry={g.smile} material={m.ink} />
          <mesh ref={mouth} geometry={g.small} material={m.mouth} position={mouthAt.p} rotation={mouthAt.r} scale={[0.11, 0.004, 0.03]} />
        </group>
      </group>
    </group>
  </group>
}
