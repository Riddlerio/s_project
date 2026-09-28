import { useEffect, useRef } from 'react'

export default function BeamCanvas({ voicedMs, targetMs }: { voicedMs: number; targetMs: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const node = canvas.current
    const context = node?.getContext('2d')
    if (!node || !context) return
    let frame = 0
    const draw = () => {
      const width = node.width, height = node.height
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#252c59'; context.fillRect(0, 0, width, height)
      context.fillStyle = '#fff4a5'; context.font = '42px sans-serif'; context.fillText('✨', width - 80, 68)
      context.strokeStyle = '#ffffff88'; context.setLineDash([7, 7]); context.beginPath(); context.moveTo(width * .75, 0); context.lineTo(width * .75, height); context.stroke(); context.setLineDash([])
      if (voicedMs > 0) {
        const length = Math.min(width * .9, width * .75 * voicedMs / Math.max(1, targetMs))
        const gradient = context.createLinearGradient(0, 0, length, 0)
        gradient.addColorStop(0, '#9a72ff'); gradient.addColorStop(1, '#fff19b')
        context.fillStyle = gradient; context.shadowColor = '#bbaaff'; context.shadowBlur = 22
        context.fillRect(10, height / 2 - 16, length, 32); context.shadowBlur = 0
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [voicedMs, targetMs])
  return <canvas ref={canvas} width={600} height={150} role="img" aria-label="발성하는 동안 빛의 길이가 늘어납니다" className="beam-canvas" />
}
