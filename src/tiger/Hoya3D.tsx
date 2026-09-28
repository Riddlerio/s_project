import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { HoyaAction } from '../control/speechGameSignal'

function Tiger({ action }: { action: HoyaAction }) {
  const group = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.position.y = action === 'FLY' ? 0.35 + Math.sin(t * 4) * 0.15 : Math.sin(t * 2) * 0.035
    group.current.position.x = action === 'WALK_TO' ? Math.sin(t * 2) * 0.2 : action === 'ATTACK' ? 0.18 + Math.sin(t * 6) * 0.08 : 0
    group.current.rotation.z = action === 'BEAM' ? -0.12 : action === 'CHEER' || action === 'ENCOURAGE' ? Math.sin(t * 8) * 0.1 : 0
    group.current.rotation.x = action === 'PICK_UP' ? 0.32 : action === 'ATTACK' ? -0.2 : 0
    group.current.rotation.y = action === 'WALK_TO' ? -0.3 : action === 'LISTENING' ? 0.15 : Math.sin(t * 0.7) * 0.07
    if (rightArm.current) rightArm.current.rotation.z = action === 'WAVE' ? Math.sin(t * 8) * 0.65 : action === 'PICK_UP' ? -0.7 : action === 'PUT_IN_BAG' ? 0.75 : action === 'ATTACK' || action === 'CAST' || action === 'BEAM' ? -0.4 : 0
    if (leftArm.current) leftArm.current.rotation.z = action === 'CHEER' ? -0.4 + Math.sin(t * 8) * 0.15 : 0
  })
  const stripe = '#2b292a'
  return <group ref={group}>
    <mesh position={[0, -0.45, 0]}><capsuleGeometry args={[0.52, 0.75, 8, 18]} /><meshStandardMaterial color="#f6f3e9" /></mesh>
    <mesh position={[0, 0.54, 0.05]}><sphereGeometry args={[0.72, 24, 16]} /><meshStandardMaterial color="#faf8f1" /></mesh>
    <mesh position={[-0.52, 1.03, 0]}><sphereGeometry args={[0.24, 12, 10]} /><meshStandardMaterial color="#f8f5ea" /></mesh>
    <mesh position={[0.52, 1.03, 0]}><sphereGeometry args={[0.24, 12, 10]} /><meshStandardMaterial color="#f8f5ea" /></mesh>
    <mesh position={[-0.52, 1.04, 0.16]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color="#e8b4b0" /></mesh>
    <mesh position={[0.52, 1.04, 0.16]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color="#e8b4b0" /></mesh>
    <mesh position={[-0.26, 0.65, 0.65]}><sphereGeometry args={[0.08, 12, 10]} /><meshStandardMaterial color={stripe} /></mesh>
    <mesh position={[0.26, 0.65, 0.65]}><sphereGeometry args={[0.08, 12, 10]} /><meshStandardMaterial color={stripe} /></mesh>
    <mesh position={[0, 0.34, 0.72]}><sphereGeometry args={[0.13, 12, 10]} /><meshStandardMaterial color="#d78c81" /></mesh>
    <mesh position={[0, 0.12, 0.7]} scale={[1, action === 'TALKING' ? 1.8 : 0.5, 1]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color="#513944" /></mesh>
    {[-1, 1].map(side => <group key={side} ref={side === -1 ? leftArm : rightArm}>
      <mesh position={[side * 0.68, -0.32, 0]} rotation={[0, 0, side * 0.35]}><capsuleGeometry args={[0.17, 0.42, 6, 12]} /><meshStandardMaterial color="#f8f5eb" /></mesh>
      <mesh position={[side * 0.3, -1.14, 0]}><capsuleGeometry args={[0.18, 0.28, 6, 12]} /><meshStandardMaterial color="#f8f5eb" /></mesh>
      <mesh position={[side * 0.48, 0.91, 0.43]} rotation={[0, 0, side * 0.48]}><boxGeometry args={[0.11, 0.32, 0.05]} /><meshStandardMaterial color={stripe} /></mesh>
      <mesh position={[side * 0.49, 0.28, 0.44]} rotation={[0, 0, side * 0.55]}><boxGeometry args={[0.12, 0.3, 0.04]} /><meshStandardMaterial color={stripe} /></mesh>
    </group>)}
    <mesh position={[0, -0.18, 0.52]} rotation={[0, 0, 0.08]}><torusGeometry args={[0.37, 0.09, 8, 24]} /><meshStandardMaterial color="#52b8b2" /></mesh>
    <mesh position={[0, -0.62, 0.54]}><cylinderGeometry args={[0.13, 0.13, 0.035, 20]} /><meshStandardMaterial color="#f6cb60" metalness={0.4} roughness={0.4} /></mesh>
    <mesh position={[0, -0.62, -0.52]}><coneGeometry args={[0.58, 1.2, 3]} /><meshStandardMaterial color="#55acae" side={2} /></mesh>
    {(['BEAM', 'CHARGE', 'CAST', 'ATTACK'] as HoyaAction[]).includes(action) && <mesh position={[0.85, -0.25, 0.5]}><sphereGeometry args={[action === 'BEAM' || action === 'ATTACK' ? 0.28 : 0.18, 16, 10]} /><meshStandardMaterial color="#83e4f3" emissive="#3ebacf" emissiveIntensity={0.8} /></mesh>}
    {action === 'BEAM' && <mesh position={[1.7, -0.25, 0.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.15, 1.8, 12]} /><meshStandardMaterial color="#83e4f3" emissive="#3ebacf" emissiveIntensity={1.3} /></mesh>}
    {(action === 'PICK_UP' || action === 'PUT_IN_BAG') && <mesh position={action === 'PICK_UP' ? [0.9, -0.9, 0.5] : [0.2, -0.6, -0.3]}><sphereGeometry args={[0.18, 12, 10]} /><meshStandardMaterial color="#ed565d" /></mesh>}
  </group>
}

export function Hoya3D({ action = 'IDLE', className = '' }: { action?: HoyaAction; className?: string }) {
  if (typeof window === 'undefined' || !window.WebGLRenderingContext) {
    return <div role="img" aria-label={`호야: ${action}`} style={{ display: 'grid', placeItems: 'center', minHeight: 280, fontSize: 120 }}>🐯</div>
  }
  return <div className={className} role="img" aria-label={`3D 호야: ${action}`} style={{ width: '100%', height: '100%', minHeight: 280 }}>
    <Canvas camera={{ position: [0, 0.15, 4.7], fov: 40 }} shadows>
      <ambientLight intensity={1.8} /><directionalLight position={[3, 5, 5]} intensity={2} />
      <Tiger action={action} />
    </Canvas>
  </div>
}
