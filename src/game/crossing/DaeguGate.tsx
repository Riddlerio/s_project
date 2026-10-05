import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'

/*
 * 대구대학교 정문(사용자가 준 사진 두 장을 참고해 코드로 만든 단순화 모형, 2026-10-05).
 * - 화강암 블록의 큰 가로 보와 "사랑 빛 자유 LOVE LIGHT FREEDOM" 글자판
 * - 오른쪽 큰 기둥: 세로 "대구대학교" 어두운 판, 위 네모 장식(공식 흉장)
 * - 왼쪽: 줄무늬 원통 탑, 둥근 캐노피와 유리 부스, 보를 받치는 가는 기둥
 * - 붉은 벽돌 광장, 문 너머 먼 건물
 * 실측 도면이 아니라 사진 비율을 장면에 맞춰 줄였다(두두가 보 아래에 서도록 보 아래 높이 약 3.3).
 */
const GRANITE = '#d3ccbf'
const GRANITE_DARK = '#bfb7a9'

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]): Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  draw(ctx)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  if (repeat) { texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(...repeat) }
  return texture
}

/** 엇갈려 쌓은 화강암 블록(블록마다 밝기가 조금씩 다름). */
function graniteTexture(repeat: [number, number]) {
  return canvasTexture(512, 512, ctx => {
    ctx.fillStyle = GRANITE; ctx.fillRect(0, 0, 512, 512)
    let seed = 7
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let row = 0; row < 8; row++) {
      const offset = row % 2 ? 64 : 0
      for (let col = -1; col < 5; col++) {
        const x = col * 128 + offset, y = row * 64
        ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '90,80,70'},${0.03 + rand() * 0.05})`
        ctx.fillRect(x, y, 128, 64)
        ctx.strokeStyle = GRANITE_DARK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, 126, 62)
      }
    }
  }, repeat)
}

const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'

/** 보 앞 글자판: 사랑 빛 자유 LOVE LIGHT FREEDOM(주황 글자). */
function mottoTexture() {
  return canvasTexture(1024, 140, ctx => {
    ctx.fillStyle = '#ddd6c9'; ctx.fillRect(0, 0, 1024, 140)
    ctx.strokeStyle = '#b3aa9b'; ctx.lineWidth = 6; ctx.strokeRect(5, 5, 1014, 130)
    ctx.fillStyle = '#d1772b'; ctx.textBaseline = 'middle'
    ctx.font = `900 74px ${FONT}`
    ctx.textAlign = 'right'; ctx.fillText('사랑 빛 자유', 470, 74)
    ctx.font = `700 50px ${FONT}`
    ctx.textAlign = 'left'; ctx.fillText('LOVE LIGHT FREEDOM', 505, 76)
  })
}

/** 오른쪽 기둥의 세로 이름판: 어두운 돌에 밝은 글자. */
function nameTexture() {
  return canvasTexture(160, 600, ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 160, 0)
    gradient.addColorStop(0, '#3f4244'); gradient.addColorStop(0.5, '#4d5153'); gradient.addColorStop(1, '#3f4244')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 160, 600)
    ctx.strokeStyle = '#2f3133'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 152, 592)
    ctx.fillStyle = '#efe7d3'; ctx.font = `800 92px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ;[...'대구대학교'].forEach((char, i) => ctx.fillText(char, 80, 78 + i * 112))
  })
}

/** 먼 건물의 유리창 격자. */
function windowTexture() {
  return canvasTexture(128, 256, ctx => {
    ctx.fillStyle = '#e8eef2'; ctx.fillRect(0, 0, 128, 256)
    for (let y = 8; y < 256; y += 24) for (let x = 8; x < 128; x += 30) {
      ctx.fillStyle = (x + y) % 3 ? '#7fa6c4' : '#94b8d2'; ctx.fillRect(x, y, 22, 16)
    }
  }, [2, 3])
}

/** 원통 탑의 가로 줄무늬. */
function bandTexture() {
  return canvasTexture(64, 256, ctx => {
    ctx.fillStyle = '#ddd8ce'; ctx.fillRect(0, 0, 64, 256)
    ctx.fillStyle = '#c3bcaf'
    for (let y = 0; y < 256; y += 32) ctx.fillRect(0, y, 64, 4)
  }, [6, 5])
}

export function DaeguGate({ position }: { position: [number, number, number] }) {
  const textures = useMemo(() => ({
    beam: graniteTexture([3.3, 0.6]), pillar: graniteTexture([1, 2.2]), motto: mottoTexture(), name: nameTexture(), band: bandTexture(), windows: windowTexture(),
  }), [])
  const [emblem, setEmblem] = useState<Texture | null>(null)
  useEffect(() => {
    let alive = true
    new TextureLoader().load('/assets/crossing/daegu_emblem.jpg', texture => { texture.colorSpace = SRGBColorSpace; if (alive) setEmblem(texture) })
    return () => { alive = false; Object.values(textures).forEach(texture => texture?.dispose()) }
  }, [textures])
  const stone = (map: Texture | null) => <meshStandardMaterial color={map ? '#ffffff' : GRANITE} map={map ?? undefined} roughness={0.85} />
  return <group position={position}>
    {/* 붉은 벽돌 광장과 가운데 회색 길 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.004, 0.2]}><planeGeometry args={[10, 6.5]} /><meshStandardMaterial color="#b8644f" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, -0.6]}><planeGeometry args={[2.6, 5]} /><meshStandardMaterial color="#cfcac2" roughness={1} /></mesh>
    {/* 가로 보와 글자판 */}
    <mesh position={[0.4, 3.9, 0]}><boxGeometry args={[6.9, 1.15, 1.3]} />{stone(textures.beam)}</mesh>
    {/* 글자판은 탑과 오른쪽 기둥 사이 보 앞면에 맞춘다 */}
    {textures.motto && <mesh position={[-0.62, 3.93, 0.66]}><planeGeometry args={[3.8, 0.52]} /><meshStandardMaterial map={textures.motto} roughness={0.8} /></mesh>}
    {/* 오른쪽 큰 기둥: 세로 이름판과 위 네모 장식(공식 흉장) */}
    <mesh position={[2.85, 2.26, 0]}><boxGeometry args={[2.1, 4.52, 1.6]} />{stone(textures.pillar)}</mesh>
    {textures.name && <mesh position={[2.85, 1.85, 0.81]}><planeGeometry args={[0.72, 2.6]} /><meshStandardMaterial map={textures.name} roughness={0.5} /></mesh>}
    <mesh position={[2.85, 3.62, 0.84]}><boxGeometry args={[0.66, 0.6, 0.08]} /><meshStandardMaterial color="#e4ded2" roughness={0.8} /></mesh>
    {emblem && <mesh position={[2.85, 3.62, 0.885]}><circleGeometry args={[0.24, 40]} /><meshStandardMaterial map={emblem} roughness={0.6} /></mesh>}
    {/* 왼쪽: 보를 받치는 가는 기둥, 줄무늬 원통 탑, 둥근 캐노피와 유리 부스 */}
    <mesh position={[-1.5, 1.66, 0.25]}><boxGeometry args={[0.3, 3.32, 0.3]} /><meshStandardMaterial color="#e7e3db" roughness={0.6} /></mesh>
    <mesh position={[-3.25, 2.6, -0.15]}><cylinderGeometry args={[0.6, 0.6, 5.2, 32]} /><meshStandardMaterial color="#ffffff" map={textures.band ?? undefined} roughness={0.85} /></mesh>
    <mesh position={[-3.25, 5.24, -0.15]}><cylinderGeometry args={[0.63, 0.63, 0.1, 32]} /><meshStandardMaterial color={GRANITE_DARK} /></mesh>
    {/* 둥근 캐노피(두꺼운 테두리, 밝은 아랫면)와 그 아래 유리 부스 */}
    <mesh position={[-3.0, 2.0, 0.8]}><cylinderGeometry args={[1.55, 1.48, 0.26, 48]} /><meshStandardMaterial color="#e9e6df" roughness={0.5} /></mesh>
    <mesh position={[-3.0, 1.86, 0.8]}><cylinderGeometry args={[1.4, 1.4, 0.03, 48]} /><meshStandardMaterial color="#f6f4ef" emissive="#fffaf0" emissiveIntensity={0.2} /></mesh>
    <mesh position={[-3.0, 0.93, 0.8]}><cylinderGeometry args={[0.52, 0.52, 1.86, 32]} /><meshStandardMaterial color="#8fbcb6" transparent opacity={0.6} roughness={0.15} metalness={0.3} /></mesh>
    {/* 문 너머 먼 건물(사진 속 높은 유리 건물) */}
    <mesh position={[0.4, 2.9, -15]}><boxGeometry args={[1.6, 5.8, 1.4]} /><meshStandardMaterial color="#ffffff" map={textures.windows ?? undefined} roughness={0.5} /></mesh>
    <mesh position={[0.4, 5.9, -15]}><boxGeometry args={[1.75, 0.22, 1.55]} /><meshStandardMaterial color="#6d8ba3" /></mesh>
  </group>
}
