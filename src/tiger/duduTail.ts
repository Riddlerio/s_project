import { CanvasTexture, CatmullRomCurve3, Group, Mesh, MeshStandardMaterial, SphereGeometry, SRGBColorSpace, TubeGeometry, Vector3, type Object3D } from 'three'

/*
 * Meshy 두두 모델에는 꼬리가 없어서(2026-10-04 기록) 코드로 만든 꼬리를 엉덩이 뼈에 붙인다.
 * 3D 목표 이미지처럼 왼쪽 엉덩이 옆(화면 오른쪽)에서 나와 위로 말린다(원화 기본형에서는 망토에 가려 보이지 않는다). 망토 아래쪽은 허벅지 뼈를 따라
 * 몸에 붙어 있어 등 가운데에는 꼬리가 나올 틈이 없다. 뿌리는 엉덩이 옆 안쪽에 두고 망토 앞쪽 가장자리 밖으로 내보낸다.
 * 좌표는 DuduCharacter의 fit(키 3.25, 발바닥 y=-2.03)을 적용한 쉬는 자세 기준이다.
 */
const ROOT = new Vector3(0.42, -1.22, -0.22)
const PATH = [ROOT, new Vector3(0.7, -1.34, -0.3), new Vector3(0.92, -1.32, -0.3), new Vector3(1.04, -1.16, -0.24),
  new Vector3(1.04, -0.98, -0.18), new Vector3(0.96, -0.86, -0.14)]
const RADIUS = { base: 0.105, tip: 0.082 }
const FUR = '#f6f6f3'
const STRIPE = '#2b2b2d'

/** 길이 방향(u)으로 검은 띠 네 개와 어두운 끝을 그린다. 띠 가장자리는 붓질처럼 조금 흔든다. */
function paintTail() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = FUR; ctx.fillRect(0, 0, 512, 64)
  ctx.fillStyle = STRIPE
  const band = (x0: number, width: number) => {
    ctx.beginPath()
    for (let y = 0; y <= 64; y += 4) ctx.lineTo(x0 + Math.sin(y * 0.2 + x0) * 4, y)
    for (let y = 64; y >= 0; y -= 4) ctx.lineTo(x0 + width + Math.sin(y * 0.23 + x0 * 1.7) * 4, y)
    ctx.closePath(); ctx.fill()
  }
  for (const [x, w] of [[150, 34], [236, 34], [316, 32], [392, 30]] as const) band(x, w)
  ctx.fillRect(462, 0, 50, 64)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** 뿌리에서 끝으로 갈수록 가늘어지는 관. 원점은 꼬리 뿌리다. */
function tailGeometry() {
  const curve = new CatmullRomCurve3(PATH.map(point => point.clone().sub(ROOT)))
  const segments = 48, radial = 14
  const geometry = new TubeGeometry(curve, segments, 1, radial, false)
  const position = geometry.attributes.position
  const centre = new Vector3(), point = new Vector3()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    curve.getPointAt(t, centre)
    const radius = RADIUS.base + (RADIUS.tip - RADIUS.base) * t
    for (let j = 0; j <= radial; j++) {
      const index = i * (radial + 1) + j
      point.fromBufferAttribute(position, index).sub(centre).multiplyScalar(radius).add(centre)
      position.setXYZ(index, point.x, point.y, point.z)
    }
  }
  geometry.computeVertexNormals()
  return { geometry, tip: curve.getPointAt(1) }
}

export type DuduTail = { swing: Group; dispose(): void }

/**
 * 쉬는 자세의 모델(이미 fit 적용, 애니메이션 전)에 꼬리를 붙인다. 엉덩이 뼈를 찾지 못하면 붙이지 않는다.
 * 엉덩이 뼈를 따라가므로 걷기·점프 동작에서도 몸과 함께 움직인다.
 */
export function attachDuduTail(model: Object3D): DuduTail | null {
  let hips: Object3D | null = null
  model.traverse(object => { if (!hips && (object as { isBone?: boolean }).isBone && /hips$/i.test(object.name)) hips = object })
  if (!hips) return null
  const map = paintTail()
  const material = new MeshStandardMaterial({ color: map ? '#ffffff' : FUR, map, roughness: 0.88, metalness: 0 })
  const { geometry, tip } = tailGeometry()
  const cap = new SphereGeometry(RADIUS.tip, 14, 10)
  const capMaterial = new MeshStandardMaterial({ color: STRIPE, roughness: 0.8, metalness: 0 })
  const swing = new Group()
  swing.add(new Mesh(geometry, material))
  const end = new Mesh(cap, capMaterial)
  end.position.copy(tip)
  swing.add(end)
  // 모델이 아직 장면에 들어가기 전이라 월드 좌표가 곧 fit 좌표다. attach가 이 월드 위치를 엉덩이 뼈 기준으로 바꾼다.
  const pivot = new Group()
  pivot.name = 'dudu-tail'
  pivot.position.copy(ROOT)
  pivot.add(swing)
  ;(hips as Object3D).attach(pivot)
  return {
    swing,
    dispose() {
      pivot.removeFromParent()
      geometry.dispose(); cap.dispose(); material.dispose(); capMaterial.dispose(); map?.dispose()
    },
  }
}

/** 꼬리 흔들기. 정지해야 하는 장면에서는 부르지 않아 마지막 자세에 멈춘다. */
export function swayDuduTail(tail: DuduTail, time: number, lively: boolean) {
  const amount = lively ? 0.16 : 0.07
  tail.swing.rotation.set(0, Math.sin(time * (lively ? 3.2 : 1.4)) * amount, Math.sin(time * 0.9) * 0.03)
}
