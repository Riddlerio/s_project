import { CanvasTexture, SRGBColorSpace } from 'three'

/*
 * 두두 가슴의 대구대학교 원형 흉장을 캔버스로 다시 그린다. 사용자 제공 조형 도면의 흉장 상세(368C 표기)를 보고 만든
 * 근사 재현이며 공식 원본 파일이 아니다. 공개 전시·배포 전에 대학의 사용 권한과 공식 규정을 확인한다.
 * 구성: 두 겹 원 테두리, 위쪽 호의 "대구대학교", 아래쪽 호의 "DAEGU UNIVERSITY 1956", 가운데 펄럭이는 깃발 모양 심벌.
 */
const INK = '#2b2f30'
const COLORS = { light: '#7dc243', yellow: '#e4d826', mid: '#45ab4f', deep: '#00806d' }

type P = [number, number]

/** 반지름 1 기준 좌표를 캔버스 좌표로 바꾼다. */
function mapper(c: number, r: number) { return ([x, y]: P): P => [c + x * r, c + y * r] }

function arcText(ctx: CanvasRenderingContext2D, text: string, c: number, radius: number, from: number, to: number, outward: boolean) {
  const chars = [...text]
  chars.forEach((char, i) => {
    const angle = from + ((to - from) * i) / Math.max(1, chars.length - 1)
    ctx.save()
    ctx.translate(c + Math.cos(angle) * radius, c + Math.sin(angle) * radius)
    // 위쪽 글자는 머리가 바깥, 아래쪽 글자는 머리가 가운데를 향해 모두 바로 읽힌다.
    ctx.rotate(outward ? angle + Math.PI / 2 : angle - Math.PI / 2)
    if (outward) ctx.strokeText(char, 0, 0)
    ctx.fillText(char, 0, 0)
    ctx.restore()
  })
}

/** 깃발 모양 마름모. 네 변을 S자로 휘게 해 펄럭임을 준다. 좌표는 안쪽 원 반지름 1 기준(도면 실측 근사). */
function flag(ctx: CanvasRenderingContext2D, m: (p: P) => P) {
  const top: P = [-0.16, -0.9], right: P = [0.8, -0.32], bottom: P = [0.48, 0.6], left: P = [-0.84, -0.02]
  ctx.beginPath()
  ctx.moveTo(...m(left))
  ctx.bezierCurveTo(...m([-0.6, -0.4]), ...m([-0.46, -0.8]), ...m(top))
  ctx.bezierCurveTo(...m([0.16, -0.72]), ...m([0.38, -0.2]), ...m(right))
  ctx.bezierCurveTo(...m([0.72, 0.04]), ...m([0.56, 0.28]), ...m(bottom))
  ctx.bezierCurveTo(...m([0.12, 0.44]), ...m([-0.44, 0.36]), ...m(left))
  ctx.closePath()
}

function letterD(ctx: CanvasRenderingContext2D, m: (p: P) => P, grow = 0) {
  const top: P = [-0.34 - grow * 0.4, -0.64 - grow], bottom: P = [-0.48 - grow * 0.4, 0.14 + grow]
  ctx.beginPath()
  ctx.moveTo(...m(top))
  ctx.bezierCurveTo(...m([0.12 + grow, -0.76 - grow]), ...m([0.44 + grow, -0.3]), ...m([0.24 + grow, -0.08]))
  ctx.bezierCurveTo(...m([0.1 + grow, 0.12 + grow]), ...m([-0.2, 0.22 + grow]), ...m(bottom))
  ctx.closePath()
}

export function drawEmblem(size = 1024): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const c = size / 2, R = size * 0.48
  // 바탕과 두 겹 테두리
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = size * 0.016; ctx.beginPath(); ctx.arc(c, c, R - size * 0.008, 0, Math.PI * 2); ctx.stroke()
  ctx.lineWidth = size * 0.011; ctx.beginPath(); ctx.arc(c, c, R * 0.79, 0, Math.PI * 2); ctx.stroke()
  // 글자 띠
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.lineWidth = size * 0.006; ctx.lineJoin = 'round' // 한글 글꼴이 얇게 나오는 기기에서도 굵기를 맞춘다.
  ctx.font = `900 ${Math.round(size * 0.1)}px "Malgun Gothic", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`
  arcText(ctx, '대구대학교', c, R * 0.895, -Math.PI * 0.79, -Math.PI * 0.21, true)
  ctx.beginPath(); ctx.arc(c + Math.cos(-Math.PI * 0.07) * R * 0.895, c + Math.sin(-Math.PI * 0.07) * R * 0.895, size * 0.012, 0, Math.PI * 2); ctx.fill()
  ctx.font = `800 ${Math.round(size * 0.07)}px "Arial Black", "Malgun Gothic", sans-serif`
  arcText(ctx, 'DAEGU UNIVERSITY 1956', c, R * 0.895, Math.PI * 0.97, Math.PI * 0.05, false)
  // 가운데 심벌: 연두 깃발 → 노랑 아래쪽 → 초록 띠 → 짙은 청록 D
  const m = mapper(c, R * 0.79)
  ctx.save()
  flag(ctx, m); ctx.fillStyle = COLORS.light; ctx.fill(); ctx.clip()
  ctx.beginPath()
  ctx.moveTo(...m([-0.26, 0.44])); ctx.bezierCurveTo(...m([0.0, 0.14]), ...m([0.44, 0.14]), ...m([0.86, -0.36]))
  ctx.lineTo(...m([0.9, 0.9])); ctx.lineTo(...m([-0.3, 0.9])); ctx.closePath()
  ctx.fillStyle = COLORS.yellow; ctx.fill()
  letterD(ctx, m, 0.09); ctx.fillStyle = COLORS.mid; ctx.fill()
  letterD(ctx, m); ctx.fillStyle = COLORS.deep; ctx.fill()
  ctx.restore()
  return canvas
}

export function emblemTexture(): CanvasTexture | null {
  const canvas = drawEmblem()
  if (!canvas) return null
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
