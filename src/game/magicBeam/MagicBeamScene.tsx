import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DoubleSide, ExtrudeGeometry, Shape, type Group, type Mesh } from 'three'
import type { HoyaAction } from '../../control/speechGameSignal'
import type { SceneFx } from '../../child/ActivityScene'
import { DuduCharacter } from '../../tiger/DuduCharacter'
import { canUseWebGL, HoyaErrorBoundary, HoyaFallback } from '../../tiger/Hoya3D'
import { beamChapter, beamVisualState, type BeamVisualInput } from './sceneState'
import './magicBeamScene.css'

export interface MagicBeamSceneProps {
  action: HoyaAction
  roundIndex?: number
  targetMs?: number
  readInput?: () => BeamVisualInput
  paused?: boolean
  fx?: SceneFx | null
}

const EMPTY_INPUT = () => ({ active: false, durationMs: 0 })

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const change = () => setReduced(query.matches)
    change()
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return reduced
}

function Rice({ position }: { position: [number, number, number] }) {
  return <group position={position}>
    {[-0.16, 0, 0.16].map((offset, index) => <group key={offset} position={[offset, 0, index * 0.08]} rotation={[0, 0, offset * -1.5]}>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.015, 0.025, 0.84, 5]} /><meshStandardMaterial color="#658848" /></mesh>
      <mesh position={[0.08, 0.3, 0]} rotation={[0, 0, -0.7]} scale={[0.05, 0.24, 0.025]}><sphereGeometry args={[1, 6, 4]} /><meshStandardMaterial color="#7e9a46" /></mesh>
      <mesh position={[0.08, 0.82, 0]} rotation={[0, 0, -0.48]} scale={[0.09, 0.24, 0.07]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#eac679" roughness={0.9} /></mesh>
    </group>)}
  </group>
}

function Sparrow({ position }: { position: [number, number, number] }) {
  return <group position={position} rotation={[0, -0.5, 0]}>
    <mesh scale={[0.21, 0.16, 0.28]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#9a7653" /></mesh>
    <mesh position={[0, 0.15, 0.18]}><sphereGeometry args={[0.13, 10, 8]} /><meshStandardMaterial color="#c9ac7c" /></mesh>
    <mesh position={[0, 0.14, 0.32]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.055, 0.12, 5]} /><meshStandardMaterial color="#e5bc64" /></mesh>
    <mesh position={[0.1, 0.18, 0.25]}><sphereGeometry args={[0.024, 6, 4]} /><meshStandardMaterial color="#343f43" /></mesh>
    <mesh position={[0, 0, -0.25]} rotation={[-0.5, 0, 0]} scale={[0.08, 0.04, 0.19]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#715744" /></mesh>
  </group>
}

function Lantern({ position, lit }: { position: [number, number, number]; lit: boolean }) {
  return <group position={position}>
    <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.025, 0.03, 1.1, 6]} /><meshStandardMaterial color="#8e7154" /></mesh>
    <mesh position={[0, 1.16, 0]} scale={[0.18, 0.25, 0.18]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={lit ? '#ffe3a1' : '#c0b99c'} emissive="#ffd279" emissiveIntensity={lit ? 0.65 : 0} /></mesh>
    <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.07, 0.1, 0.05, 8]} /><meshStandardMaterial color="#6c695a" /></mesh>
  </group>
}

function useStarGeometry() {
  const geometry = useMemo(() => {
    const shape = new Shape()
    for (let pointIndex = 0; pointIndex < 10; pointIndex++) {
      const angle = Math.PI / 2 + pointIndex * Math.PI / 5
      const radius = pointIndex % 2 ? 0.12 : 0.27
      const horizontal = Math.cos(angle) * radius
      const vertical = Math.sin(angle) * radius
      if (pointIndex === 0) shape.moveTo(horizontal, vertical)
      else shape.lineTo(horizontal, vertical)
    }
    shape.closePath()
    return new ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false })
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function BeamWorld({ action, roundIndex = 1, targetMs = 1, readInput = EMPTY_INPUT, paused = false, fx, reduced }: MagicBeamSceneProps & { reduced: boolean }) {
  const chapter = beamChapter(roundIndex)
  const field = useRef<Group>(null)
  const beam = useRef<Group>(null)
  const mist = useRef<Group>(null)
  const response = useRef<Group>(null)
  const elapsed = useRef(0)
  const starGeometry = useStarGeometry()
  const lit = fx?.result === 'hit'
  const quiet = beamVisualState(action, readInput(), targetMs, reduced, paused).quiet
  useEffect(() => { elapsed.current = 0 }, [fx?.id])
  useFrame((_, delta) => {
    const input = readInput()
    const state = beamVisualState(action, input, targetMs, reduced, paused)
    if (beam.current) {
      beam.current.visible = state.showBeam
      beam.current.scale.x = Math.max(0.02, state.progress)
    }
    if (mist.current) mist.current.children.forEach(child => {
      const material = (child as Mesh).material
      if (!Array.isArray(material) && 'opacity' in material) material.opacity = 0.34 - state.progress * 0.22
    })
    if (beamVisualState(action, input, targetMs, false, paused).quiet) {
      if (response.current) response.current.visible = false
      return
    }
    elapsed.current += Math.min(delta, 0.05)
    if (field.current && !reduced) field.current.rotation.z = Math.sin(elapsed.current * 1.2) * 0.012
    if (response.current) {
      response.current.visible = !!fx && (lit || !!fx.stars) && elapsed.current < 2.8
      response.current.position.y = reduced ? 0 : Math.min(0.4, elapsed.current * 0.24)
    }
  })
  return <>
    <color attach="background" args={[chapter.sky]} />
    <fog attach="fog" args={[chapter.sky, 12, 32]} />
    <hemisphereLight args={['#fff8e9', chapter.ground, 1.6]} />
    <directionalLight position={[4, 7, 6]} intensity={roundIndex === 5 ? 1 : 1.8} color={chapter.light} />
    <mesh position={[0, -0.22, 0]}><cylinderGeometry args={[4.7, 4.3, 0.45, 48]} /><meshStandardMaterial color={chapter.ground} roughness={1} /></mesh>
    <mesh position={[-1.8, 0.03, 0.25]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.3, 3.8]} /><meshStandardMaterial color="#82a391" roughness={0.45} /></mesh>
    {[-3.4, -0.2].map(horizontal => <mesh key={horizontal} position={[horizontal, 0.06, 0.25]}><boxGeometry args={[0.2, 0.18, 4]} /><meshStandardMaterial color="#b7ab73" /></mesh>)}
    {[-1.75, 2.25].map(depth => <mesh key={depth} position={[-1.8, 0.06, depth]}><boxGeometry args={[3.4, 0.18, 0.2]} /><meshStandardMaterial color="#b7ab73" /></mesh>)}
    {[-6, -3, 1, 5].map((horizontal, index) => <mesh key={horizontal} position={[horizontal, -0.25, -5 - index % 2]} scale={[3, 1.8 + index * 0.25, 2]}><sphereGeometry args={[1, 16, 10]} /><meshStandardMaterial color={roundIndex === 5 ? '#415b57' : '#9bb5a2'} /></mesh>)}
    {chapter.sun && <mesh position={[-3.8, 4.5, -6]}><sphereGeometry args={[0.65, 20, 14]} /><meshBasicMaterial color={chapter.light} /></mesh>}
    {!chapter.sun && <mesh position={[-3.8, 4.5, -6]}><sphereGeometry args={[0.45, 20, 14]} /><meshBasicMaterial color="#f2efd4" /></mesh>}
    {[[-2.8, 3.5, -4], [1.8, 4, -5]].map(([horizontal, vertical, depth]) => <group key={horizontal} position={[horizontal, vertical, depth]}>
      {[-0.4, 0, 0.4].map(offset => <mesh key={offset} position={[offset, 0, 0]} scale={[0.65, 0.3, 0.35]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={chapter.mist} /></mesh>)}
    </group>)}
    <group ref={field}>
      {[-2.8, -1.9, -1].flatMap(horizontal => [-1.1, 0, 1.1].map(depth => <Rice key={`${horizontal}:${depth}`} position={[horizontal, 0.12, depth]} />))}
    </group>
    {roundIndex === 2 && <><Sparrow position={[-3, 0.3, 2.1]} /><Sparrow position={[-0.5, 0.3, 2.1]} /></>}
    {roundIndex === 3 && [-2.7, -1.7, -0.6, 0.2].map((horizontal, index) => <mesh key={horizontal} position={[horizontal, 1.3 + index % 2 * 0.3, -0.8]}><sphereGeometry args={[0.05, 8, 6]} /><meshBasicMaterial color="#fff0a4" /></mesh>)}
    {roundIndex === 4 && <group position={[-3.4, 0, -1.8]}>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.035, 0.045, 2.4, 8]} /><meshStandardMaterial color="#88705c" /></mesh>
      <mesh position={[0.32, 2.12, 0]}><boxGeometry args={[0.6, 0.3, 0.025]} /><meshStandardMaterial color="#e8d6a1" /></mesh>
    </group>}
    {roundIndex === 5 && [-3.2, -2, -0.8, 0.4, 2].map(horizontal => <Lantern key={horizontal} position={[horizontal, 0.1, -2.2]} lit={lit} />)}
    <group position={[1.65, 1.62, 0.9]} scale={0.78} rotation={[0, -0.25, 0]}><DuduCharacter action={action} animate={!quiet} /></group>
    <group ref={mist}>
      {[-2.8, -1.8, -0.8].map(horizontal => <mesh key={horizontal} position={[horizontal, 0.7, -0.5]} scale={[0.9, 0.16, 1.25]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color={chapter.mist} transparent opacity={0.34} depthWrite={false} /></mesh>)}
    </group>
    <group position={[1.1, 1.2, 1.65]} rotation={[0, Math.PI, 0]}>
      <group ref={beam} visible={false}>
        <mesh position={[1.6, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[0.065, 0.065, 3.2, 12]} /><meshBasicMaterial color="#fff7ce" /></mesh>
        <mesh position={[1.6, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 3.2, 12]} /><meshBasicMaterial color={chapter.light} transparent opacity={0.26} depthWrite={false} /></mesh>
        <mesh position={[3.2, 0, 0]}><sphereGeometry args={[0.19, 12, 8]} /><meshBasicMaterial color={chapter.light} /></mesh>
      </group>
    </group>
    <group ref={response} visible={false}>
      {!!fx?.stars && [-0.55, 0, 0.55].map((horizontal, index) => <mesh key={horizontal} geometry={starGeometry} position={[1.65 + horizontal, 3.15, 1]}><meshStandardMaterial color={index < (fx.stars ?? 0) ? '#f5cc69' : '#c5c7ba'} metalness={0.1} roughness={0.6} /></mesh>)}
      {lit && [-2.7, -2, -1.3].map(horizontal => <mesh key={horizontal} position={[horizontal, 1.4, 1]} scale={[0.08, 0.13, 0.08]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#efc777" /></mesh>)}
      {fx?.material === 'rice' && <group position={[0, 2, 1.4]}>
        <mesh><sphereGeometry args={[0.24, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color="#7496b1" side={DoubleSide} /></mesh>
        <mesh scale={[0.21, 0.1, 0.21]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#fff6df" /></mesh>
      </group>}
    </group>
  </>
}

export function MagicBeamScene(props: MagicBeamSceneProps) {
  const chapter = beamChapter(props.roundIndex ?? 1)
  const [supported] = useState(() => canUseWebGL())
  const [lost, setLost] = useState(false)
  const reduced = useReducedMotion()
  const previousRound = useRef(props.roundIndex)
  const previousFx = useRef(props.fx?.id)
  const staleFx = useRef<number | undefined>(undefined)
  if (previousRound.current !== props.roundIndex) {
    staleFx.current = previousFx.current
    previousRound.current = props.roundIndex
  }
  previousFx.current = props.fx?.id
  const currentFx = props.fx?.id === staleFx.current ? null : props.fx
  const fallback = <div className="magic-beam-fallback"><HoyaFallback action={props.action} /><p>빛의 길 대신 두두와 천천히 연습해요.</p></div>
  return <div className="activity-stage-art dudu-scene magic-beam-scene" data-beam-round={props.roundIndex ?? 1}>
    <div className="magic-beam-chapter"><small>빛의 마법</small><strong>{chapter.title}</strong></div>
    <div className="magic-beam-world" role="img" aria-label={`빛의 마법: ${chapter.title}. 소리를 이어 가는 시간에 맞춰 빛의 길이 늘어나요.`}>
      {!supported || lost ? fallback : <HoyaErrorBoundary fallback={fallback}>
        <Canvas camera={{ position: [6, 4.6, 10], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true }} onCreated={({ camera, gl }) => {
          camera.lookAt(0, 1.1, 0)
          gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setLost(true) }, { once: true })
        }}>
          <BeamWorld {...props} fx={currentFx} reduced={reduced} />
        </Canvas>
      </HoyaErrorBoundary>}
    </div>
    <span className="activity-art-caption">벼 수확 · 2·4라운드에 밥 · 빛의 길이는 발음 점수가 아니에요</span>
  </div>
}
