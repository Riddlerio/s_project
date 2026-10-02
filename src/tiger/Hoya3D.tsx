import { Canvas, useFrame } from '@react-three/fiber'
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CanvasTexture, CatmullRomCurve3, MathUtils, Shape, SRGBColorSpace, Vector3, type Group, type Mesh } from 'three'
import type { HoyaAction } from '../control/speechGameSignal'

// 원본 백호의 둥근 실루엣은 정면에 보존하고, 깊이와 관절은 별도 3D 메시로 만든다.
// 옆면·뒷면 도안이 아직 없으므로 큰 몸 회전은 의도적으로 제한한다.
const INK = '#17191a'
const STRIPE = '#343638'
const FUR = '#fffefe'
const CAPE = '#008a75'
const LINING = '#71bf24'
const VOLUME = { bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 4, curveSegments: 20 }

function headShape() {
  const s = new Shape()
  s.moveTo(0, 0.84)
  s.bezierCurveTo(0.30, 0.87, 0.48, 0.78, 0.60, 0.73)
  s.bezierCurveTo(0.87, 0.77, 1.04, 0.58, 1.06, 0.31)
  s.bezierCurveTo(1.16, -0.05, 1.08, -0.44, 0.79, -0.64)
  s.bezierCurveTo(0.55, -0.82, 0.26, -0.83, 0, -0.83)
  s.bezierCurveTo(-0.27, -0.83, -0.57, -0.82, -0.79, -0.64)
  s.bezierCurveTo(-1.09, -0.43, -1.16, -0.05, -1.06, 0.31)
  s.bezierCurveTo(-1.04, 0.58, -0.87, 0.77, -0.60, 0.73)
  s.bezierCurveTo(-0.43, 0.83, -0.27, 0.86, 0, 0.84)
  s.closePath()
  return s
}

function earShape() {
  const s = new Shape()
  s.moveTo(-0.29, -0.23)
  s.bezierCurveTo(-0.45, 0.02, -0.42, 0.38, -0.22, 0.47)
  s.bezierCurveTo(-0.04, 0.55, 0.22, 0.37, 0.28, 0.11)
  s.bezierCurveTo(0.31, -0.13, 0.07, -0.33, -0.29, -0.23)
  s.closePath()
  return s
}

function bodyShape() {
  const s = new Shape()
  s.moveTo(-0.47, 0.66)
  s.bezierCurveTo(-0.75, 0.57, -0.76, 0.24, -0.71, -0.10)
  s.bezierCurveTo(-0.68, -0.35, -0.53, -0.62, -0.53, -0.84)
  s.lineTo(0.56, -0.84)
  s.bezierCurveTo(0.56, -0.55, 0.69, -0.33, 0.72, -0.08)
  s.bezierCurveTo(0.77, 0.30, 0.70, 0.57, 0.44, 0.66)
  s.bezierCurveTo(0.08, 0.76, -0.10, 0.75, -0.47, 0.66)
  s.closePath()
  return s
}

function legShape() {
  const s = new Shape()
  s.moveTo(-0.23, 0.22)
  s.lineTo(0.23, 0.22)
  s.lineTo(0.22, -0.61)
  s.bezierCurveTo(0.34, -0.69, 0.32, -0.80, 0.20, -0.83)
  s.lineTo(-0.23, -0.83)
  s.bezierCurveTo(-0.38, -0.82, -0.37, -0.70, -0.25, -0.62)
  s.closePath()
  return s
}

function leftArmShape() {
  const s = new Shape()
  s.moveTo(-0.03, 0.18)
  s.bezierCurveTo(-0.30, 0.15, -0.38, -0.09, -0.39, -0.34)
  s.bezierCurveTo(-0.42, -0.56, -0.35, -0.72, -0.22, -0.73)
  s.bezierCurveTo(-0.11, -0.86, 0.10, -0.82, 0.15, -0.66)
  s.bezierCurveTo(0.12, -0.44, 0.15, -0.09, 0.16, 0.13)
  s.closePath()
  return s
}

function rightArmShape() {
  const s = new Shape()
  s.moveTo(-0.08, 0.17)
  s.bezierCurveTo(0.25, 0.18, 0.45, -0.03, 0.42, -0.29)
  s.bezierCurveTo(0.42, -0.47, 0.28, -0.55, 0.15, -0.72)
  s.bezierCurveTo(-0.03, -0.83, -0.31, -0.74, -0.34, -0.52)
  s.bezierCurveTo(-0.36, -0.33, -0.15, -0.17, -0.08, 0.17)
  s.closePath()
  return s
}

function capeShape() {
  const s = new Shape()
  s.moveTo(-0.04, 0.05)
  s.bezierCurveTo(0.35, 0.11, 0.82, -0.34, 1.23, -0.75)
  s.bezierCurveTo(1.54, -1.07, 1.68, -1.40, 1.69, -1.56)
  s.bezierCurveTo(1.49, -1.72, 1.15, -1.77, 0.98, -1.79)
  s.bezierCurveTo(0.90, -1.46, 0.67, -1.09, 0.35, -0.89)
  s.bezierCurveTo(0.12, -0.67, -0.09, -0.34, -0.04, 0.05)
  s.closePath()
  return s
}

function liningShape() {
  const s = new Shape()
  s.moveTo(0.13, -0.46)
  s.bezierCurveTo(0.65, -0.56, 1.07, -0.99, 1.33, -1.46)
  s.bezierCurveTo(1.01, -1.63, 0.61, -1.56, 0.27, -1.53)
  s.bezierCurveTo(0.21, -1.23, 0.15, -0.87, 0.13, -0.46)
  s.closePath()
  return s
}

function scarfShape() {
  const s = new Shape()
  s.moveTo(-0.58, 0.15)
  s.bezierCurveTo(-0.26, -0.04, 0.25, -0.08, 0.57, 0.16)
  s.lineTo(0.55, -0.03)
  s.bezierCurveTo(0.22, -0.25, -0.29, -0.24, -0.58, -0.03)
  s.closePath()
  return s
}

function scarfTailShape() {
  const s = new Shape()
  s.moveTo(-0.07, 0.10)
  s.bezierCurveTo(-0.22, -0.03, -0.27, -0.19, -0.26, -0.28)
  s.bezierCurveTo(-0.11, -0.27, 0.04, -0.15, 0.09, -0.01)
  s.bezierCurveTo(0.13, -0.17, 0.26, -0.27, 0.33, -0.30)
  s.bezierCurveTo(0.34, -0.16, 0.22, 0.05, 0.07, 0.11)
  s.closePath()
  return s
}

const HEAD = headShape()
const EAR = earShape()
const BODY = bodyShape()
const LEG = legShape()
const LEFT_ARM = leftArmShape()
const RIGHT_ARM = rightArmShape()
const CAPE_SHAPE = capeShape()
const CAPE_LINING = liningShape()
const SCARF = scarfShape()
const SCARF_TAIL = scarfTailShape()

function polygon(points: [number, number][]) {
  const s = new Shape()
  s.moveTo(...points[0])
  points.slice(1).forEach(point => s.lineTo(...point))
  s.closePath()
  return s
}

const CHEEK_STRIPE = polygon([[0, 0.07], [0.28, -0.01], [0.32, -0.13], [0.04, -0.08]])
const BODY_STRIPE = polygon([[0, 0.06], [0.18, 0.01], [0.20, -0.08], [0, -0.05]])
const FOREHEAD_STRIPE = polygon([[-0.17, 0.04], [0.14, 0.05], [0.20, 0], [0.01, -0.04], [-0.20, -0.03]])
const CAPE_EDGE = polygon([[0, 0], [0.12, 0.02], [0.12, -0.12], [0, -0.13]])
const SMILE = new CatmullRomCurve3([
  new Vector3(-0.35, -0.25, 0), new Vector3(-0.25, -0.34, 0),
  new Vector3(0, -0.37, 0), new Vector3(0.25, -0.34, 0), new Vector3(0.35, -0.25, 0),
])
const BROW_LEFT = new CatmullRomCurve3([new Vector3(-0.48, 0.45, 0), new Vector3(-0.35, 0.48, 0), new Vector3(-0.23, 0.41, 0)])
const BROW_RIGHT = new CatmullRomCurve3([new Vector3(0.23, 0.41, 0), new Vector3(0.35, 0.48, 0), new Vector3(0.48, 0.45, 0)])

function Volume({ shape, color = FUR, depth = 0.43 }: { shape: Shape; color?: string; depth?: number }) {
  return <group>
    <mesh position={[0, 0, 0.145 - depth - VOLUME.bevelThickness]}>
      <extrudeGeometry args={[shape, { ...VOLUME, depth }]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
    <mesh position={[0, 0, 0.149]}><shapeGeometry args={[shape, 20]} /><meshBasicMaterial color={INK} /></mesh>
    <mesh position={[0, 0, 0.153]} scale={[0.982, 0.982, 1]}>
      <shapeGeometry args={[shape, 20]} /><meshBasicMaterial color={color} />
    </mesh>
  </group>
}

function Stripe({ position, side = 1, angle = 0, body = false }: { position: [number, number, number]; side?: number; angle?: number; body?: boolean }) {
  return <mesh position={position} rotation={[0, 0, angle]} scale={[side, 1, 1]}>
    <shapeGeometry args={[body ? BODY_STRIPE : CHEEK_STRIPE]} /><meshBasicMaterial color={STRIPE} />
  </mesh>
}

function drawSeal() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const c = 256
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(c, c, 232, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#303334'; ctx.lineWidth = 10
  ctx.beginPath(); ctx.arc(c, c, 228, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(c, c, 149, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#172324'; ctx.font = 'bold 31px sans-serif'; ctx.textAlign = 'center'
  for (const [text, start, step, flip] of [['DAEGU UNIVERSITY', -1.92, 0.255, false], ['대 구 대 학 교', -1.15, 0.32, true]] as const) {
    for (let i = 0; i < text.length; i++) {
      ctx.save(); ctx.translate(c, c)
      ctx.rotate(start + i * step)
      ctx.translate(0, flip ? 188 : -184)
      if (flip) ctx.rotate(Math.PI)
      ctx.fillText(text[i], 0, 0)
      ctx.restore()
    }
  }
  ctx.fillStyle = '#0086b8'
  ctx.beginPath(); ctx.moveTo(245, 145); ctx.lineTo(336, 187); ctx.lineTo(327, 294); ctx.lineTo(245, 339); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#78bd22'
  ctx.beginPath(); ctx.moveTo(244, 146); ctx.lineTo(172, 205); ctx.lineTo(188, 301); ctx.lineTo(245, 339); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#edcc28'
  ctx.beginPath(); ctx.moveTo(245, 146); ctx.lineTo(295, 209); ctx.lineTo(269, 278); ctx.lineTo(207, 310); ctx.lineTo(189, 218); ctx.closePath(); ctx.fill()
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function ChestSeal() {
  const texture = useMemo(drawSeal, [])
  useEffect(() => () => texture?.dispose(), [texture])
  if (!texture) return null
  return <mesh position={[0, -0.36, 0.30]}>
    <circleGeometry args={[0.18, 48]} /><meshBasicMaterial map={texture} transparent />
  </mesh>
}

function Tiger({ action }: { action: HoyaAction }) {
  const root = useRef<Group>(null)
  const head = useRef<Group>(null)
  const cape = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const mouth = useRef<Mesh>(null)

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const d = Math.min(delta, 0.05)
    let x = 0, y = Math.sin(t * 1.8) * 0.015, roll = 0, pitch = 0, yaw = 0
    let headRoll = Math.sin(t * 0.75) * 0.013, headPitch = 0
    let left = 0, right = 0, legL = 0, legR = 0, capeRoll = Math.sin(t * 1.5) * 0.035
    let mouthOpen = 0.001
    switch (action) {
      case 'LISTENING': headRoll = -0.07; yaw = 0.04; break
      case 'TALKING': headPitch = Math.sin(t * 5) * 0.035; right = 0.16 + Math.sin(t * 4) * 0.12; mouthOpen = 0.4 + Math.abs(Math.sin(t * 7)) * 0.9; break
      case 'CHARGE': left = -0.52; right = 0.6; pitch = -0.07; capeRoll = 0.07; break
      case 'BEAM': right = 1.35; left = -0.25; roll = -0.07; capeRoll = -0.12; break
      case 'RELEASE': right = 0.63; headPitch = -0.06; capeRoll = 0.09; break
      case 'FLY': y = 0.28 + Math.sin(t * 4) * 0.07; left = -0.76; right = 0.95; legL = -0.23; legR = 0.24; capeRoll = -0.24 + Math.sin(t * 5) * 0.05; break
      case 'LAND': y = -0.12; left = -0.24; right = 0.29; legL = -0.12; legR = 0.12; capeRoll = 0.12; break
      case 'CAST': right = 1.54 + Math.sin(t * 5) * 0.15; left = -0.28; capeRoll = -0.09; break
      case 'ATTACK': x = 0.10 + Math.sin(t * 8) * 0.025; right = 1.12; pitch = -0.10; capeRoll = -0.14; break
      case 'WALK_TO': x = Math.sin(t * 2.5) * 0.12; left = Math.sin(t * 5) * 0.22; right = Math.sin(t * 5 + Math.PI) * 0.22; legL = Math.sin(t * 5) * 0.32; legR = -legL; capeRoll = Math.sin(t * 5) * 0.08; break
      case 'PICK_UP': pitch = 0.24; right = -0.58; headPitch = 0.09; break
      case 'PUT_IN_BAG': right = -0.95; headRoll = 0.06; break
      case 'WAVE': right = 2.05 + Math.sin(t * 8) * 0.20; headRoll = -0.04; break
      case 'CHEER': y = 0.08 + Math.abs(Math.sin(t * 7)) * 0.10; left = -1.08; right = 1.18; capeRoll = -0.09; break
      case 'ENCOURAGE': left = -0.34; right = 0.28; headPitch = Math.sin(t * 3) * 0.055; break
      case 'THINKING': headRoll = 0.10 + Math.sin(t * 0.8) * 0.015; right = -0.55; yaw = 0.06; break
      case 'IDLE': break
    }
    if (root.current) {
      root.current.position.x = MathUtils.damp(root.current.position.x, x, 10, d)
      root.current.position.y = MathUtils.damp(root.current.position.y, y, 10, d)
      root.current.rotation.z = MathUtils.damp(root.current.rotation.z, roll, 10, d)
      root.current.rotation.x = MathUtils.damp(root.current.rotation.x, pitch, 10, d)
      root.current.rotation.y = MathUtils.damp(root.current.rotation.y, yaw, 10, d)
    }
    if (head.current) {
      head.current.rotation.z = MathUtils.damp(head.current.rotation.z, headRoll, 9, d)
      head.current.rotation.x = MathUtils.damp(head.current.rotation.x, headPitch, 9, d)
    }
    if (leftArm.current) leftArm.current.rotation.z = MathUtils.damp(leftArm.current.rotation.z, left, 11, d)
    if (rightArm.current) rightArm.current.rotation.z = MathUtils.damp(rightArm.current.rotation.z, right, 11, d)
    if (leftLeg.current) leftLeg.current.rotation.z = MathUtils.damp(leftLeg.current.rotation.z, legL, 10, d)
    if (rightLeg.current) rightLeg.current.rotation.z = MathUtils.damp(rightLeg.current.rotation.z, legR, 10, d)
    if (cape.current) cape.current.rotation.z = MathUtils.damp(cape.current.rotation.z, capeRoll, 5, d)
    if (mouth.current) mouth.current.scale.y = MathUtils.damp(mouth.current.scale.y, mouthOpen, 12, d)
  })

  return <group ref={root}>
    <group ref={cape} position={[0.42, 0.20, -0.24]}>
      <Volume shape={CAPE_SHAPE} color={CAPE} depth={0.10} />
      <mesh position={[0, 0, 0.153]}><shapeGeometry args={[CAPE_LINING, 20]} /><meshBasicMaterial color={LINING} /></mesh>
      <mesh position={[0.16, -0.51, 0.16]}><shapeGeometry args={[CAPE_EDGE]} /><meshBasicMaterial color={INK} /></mesh>
    </group>

    <group ref={leftLeg} position={[-0.31, -1.19, 0.04]}>
      <Volume shape={LEG} depth={0.34} />
      <Stripe position={[-0.25, -0.21, 0.16]} side={1} body />
      <Stripe position={[-0.25, -0.44, 0.16]} side={1} body />
      <mesh position={[-0.16, -0.80, 0.16]}><boxGeometry args={[0.018, 0.07, 0.01]} /><meshBasicMaterial color={INK} /></mesh>
    </group>
    <group ref={rightLeg} position={[0.31, -1.19, 0.04]}>
      <Volume shape={LEG} depth={0.34} />
      <Stripe position={[0.25, -0.16, 0.16]} side={-1} body />
      <Stripe position={[0.25, -0.42, 0.16]} side={-1} body />
      <mesh position={[0.14, -0.80, 0.16]}><boxGeometry args={[0.018, 0.07, 0.01]} /><meshBasicMaterial color={INK} /></mesh>
    </group>

    <group position={[0, -0.53, 0.04]}>
      <mesh position={[0, -0.02, -0.12]} scale={[0.65, 0.72, 0.33]}>
        <sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color={FUR} roughness={1} />
      </mesh>
      <Volume shape={BODY} depth={0.50} />
    </group>
    <Stripe position={[-0.71, -0.43, 0.213]} side={1} body />
    <Stripe position={[-0.67, -0.79, 0.213]} side={1} body />
    <Stripe position={[0.68, -0.72, 0.213]} side={-1} body />
    <Stripe position={[0.60, -1.06, 0.213]} side={-1} body />

    <group ref={leftArm} position={[-0.58, -0.16, 0.14]}>
      <Volume shape={LEFT_ARM} depth={0.32} />
      <Stripe position={[-0.33, -0.22, 0.16]} side={1} body />
      <Stripe position={[-0.35, -0.48, 0.16]} side={1} body />
    </group>
    <group ref={rightArm} position={[0.58, -0.16, 0.14]}>
      <Volume shape={RIGHT_ARM} depth={0.32} />
      <Stripe position={[0.36, -0.22, 0.16]} side={-1} body />
      <Stripe position={[0.35, -0.46, 0.16]} side={-1} body />
    </group>

    <group position={[0, 0.09, 0.21]}>
      <group scale={[1, 0.7, 1]}><Volume shape={SCARF} color={CAPE} depth={0.10} /></group>
      <group position={[0.01, -0.10, 0.17]} scale={[0.65, 0.65, 1]}><Volume shape={SCARF_TAIL} color={CAPE} depth={0.07} /></group>
    </group>
    <ChestSeal />

    <group ref={head} position={[0, 0.97, 0.22]}>
      <group position={[-0.77, 0.63, -0.11]} rotation={[0, 0, 0.10]} scale={[0.70, 0.70, 1]}><Volume shape={EAR} depth={0.25} /></group>
      <group position={[0.77, 0.63, -0.11]} rotation={[0, 0, -0.10]} scale={[-0.70, 0.70, 1]}><Volume shape={EAR} depth={0.25} /></group>
      <mesh position={[0, 0, -0.13]} scale={[0.96, 0.73, 0.36]}>
        <sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color={FUR} roughness={1} />
      </mesh>
      <Volume shape={HEAD} depth={0.64} />
      {[[0, 0.67, 0.68], [0, 0.54, 0.54]].map(([sx, sy, width], i) => <mesh key={i} position={[sx, sy, 0.225]} scale={[width, 0.66, 1]}>
        <shapeGeometry args={[FOREHEAD_STRIPE]} /><meshBasicMaterial color={STRIPE} />
      </mesh>)}
      <mesh position={[0.015, 0.42, 0.225]} rotation={[0, 0, -0.13]} scale={[0.5, 0.7, 1]}>
        <shapeGeometry args={[BODY_STRIPE]} /><meshBasicMaterial color={STRIPE} />
      </mesh>
      <Stripe position={[-1.06, 0.22, 0.16]} side={1} />
      <Stripe position={[-1.08, -0.14, 0.16]} side={1} angle={-0.1} />
      <Stripe position={[-0.97, -0.47, 0.16]} side={1} angle={-0.25} />
      <Stripe position={[1.06, 0.22, 0.16]} side={-1} />
      <Stripe position={[1.08, -0.14, 0.16]} side={-1} angle={0.1} />
      <Stripe position={[0.97, -0.47, 0.16]} side={-1} angle={0.25} />
      <mesh position={[-0.32, 0.16, 0.20]} scale={[0.075, 0.12, 0.035]}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial color="#090a0a" /></mesh>
      <mesh position={[0.32, 0.16, 0.20]} scale={[0.075, 0.12, 0.035]}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial color="#090a0a" /></mesh>
      <mesh position={[-0.30, 0.21, 0.231]} scale={[0.019, 0.027, 0.007]}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh position={[0.34, 0.21, 0.231]} scale={[0.019, 0.027, 0.007]}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh position={[0, -0.08, 0.20]} scale={[0.19, 0.105, 0.05]}><sphereGeometry args={[1, 18, 12]} /><meshBasicMaterial color="#424244" /></mesh>
      <mesh position={[0, -0.24, 0.185]}><boxGeometry args={[0.018, 0.17, 0.01]} /><meshBasicMaterial color={INK} /></mesh>
      <mesh position={[0, 0, 0.185]}><tubeGeometry args={[SMILE, 32, 0.017, 8, false]} /><meshBasicMaterial color={INK} /></mesh>
      <mesh position={[0, 0, 0.185]}><tubeGeometry args={[BROW_LEFT, 12, 0.015, 8, false]} /><meshBasicMaterial color={INK} /></mesh>
      <mesh position={[0, 0, 0.185]}><tubeGeometry args={[BROW_RIGHT, 12, 0.015, 8, false]} /><meshBasicMaterial color={INK} /></mesh>
      <mesh ref={mouth} position={[0, -0.32, 0.193]} scale={[0.09, 0.001, 0.012]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color={INK} /></mesh>
      {action === 'THINKING' && <mesh position={[0.68, -0.45, 0.205]} scale={[0.115, 0.11, 0.05]}><sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color={FUR} /></mesh>}
    </group>

    {(['CHARGE', 'BEAM', 'CAST', 'ATTACK'] as HoyaAction[]).includes(action) &&
      <mesh position={action === 'BEAM' ? [1.36, -0.18, 0.42] : [0.88, -0.34, 0.40]}>
        <sphereGeometry args={[action === 'BEAM' ? 0.22 : 0.15, 16, 12]} />
        <meshBasicMaterial color="#a9f0fa" />
      </mesh>}
    {action === 'BEAM' && <mesh position={[1.82, -0.18, 0.40]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.08, 0.16, 0.8, 12]} /><meshBasicMaterial color="#86e3f5" />
    </mesh>}
    {(action === 'PICK_UP' || action === 'PUT_IN_BAG') && <mesh position={action === 'PICK_UP' ? [0.78, -1.60, 0.34] : [0.22, -0.74, 0.34]}>
      <sphereGeometry args={[0.13, 16, 12]} /><meshBasicMaterial color="#e95155" />
    </mesh>}
  </group>
}

const ACTION_TEXT: Partial<Record<HoyaAction, string>> = {
  LISTENING: '호야가 귀 기울이고 있어요', TALKING: '호야가 말하고 있어요', CHARGE: '호야가 힘을 모으고 있어요',
  BEAM: '호야가 빛을 쏘고 있어요', RELEASE: '호야가 빛을 놓았어요', FLY: '호야가 날고 있어요', LAND: '호야가 내려앉았어요',
  CAST: '호야가 주문을 외우고 있어요', ATTACK: '호야가 몬스터에게 마법을 보냈어요', WALK_TO: '호야가 걸어가고 있어요',
  PICK_UP: '호야가 물건을 집었어요', PUT_IN_BAG: '호야가 가방에 넣었어요', WAVE: '호야가 손을 흔들어요',
  CHEER: '호야가 신나 해요', ENCOURAGE: '호야가 응원하고 있어요', THINKING: '호야가 생각하고 있어요',
}

/** WebGL을 쓸 수 없을 때 보여 주는 간단한 대체 화면. 3D 렌더가 아니다. */
export function HoyaFallback({ action = 'IDLE' }: { action?: HoyaAction }) {
  return <div role="img" aria-label="두두 그림(간단한 대체 화면)" data-hoya-fallback="true"
    style={{ display: 'grid', placeItems: 'center', minHeight: 280, textAlign: 'center' }}>
    <span aria-hidden="true" style={{ fontSize: 120 }}>🐯</span>
    <p>{ACTION_TEXT[action] || '호야가 옆에 있어요'}</p>
    <p className="small">호야가 간단한 모습으로 함께해요. 게임은 그대로 할 수 있어요.</p>
  </div>
}

type CanvasDocument = { createElement(tag: 'canvas'): { getContext(kind: string): unknown } }

export function canUseWebGL(doc: CanvasDocument | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) return false
  try {
    const canvas = doc.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Canvas나 3D 장면에서 오류가 나도 아동 화면 전체가 깨지지 않게 대체 화면으로 바꾼다. */
export class HoyaErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.warn('3D 호야를 표시하지 못해 대체 화면을 사용합니다', error) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function Hoya3D({ action = 'IDLE', className = '' }: { action?: HoyaAction; className?: string }) {
  const [supported] = useState(() => canUseWebGL())
  const [lost, setLost] = useState(false)
  if (!supported || lost) return <HoyaFallback action={action} />
  return <div className={className} role="img" aria-label={`3D 두두: ${action}`} style={{ width: '100%', height: '100%', minHeight: 280 }}>
    <HoyaErrorBoundary fallback={<HoyaFallback action={action} />}>
      <Canvas camera={{ position: [0.30, 0.05, 8.2], fov: 35 }} shadows
        onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setLost(true) })}>
        <ambientLight intensity={1.8} /><directionalLight position={[3, 5, 5]} intensity={2} />
        <Tiger action={action} />
      </Canvas>
    </HoyaErrorBoundary>
  </div>
}
