import { extractFeatures } from './features'
import type { VadFrame } from './vad'

export class AudioCapture {
  private stream?: MediaStream
  private context?: AudioContext
  private timer?: number
  private disposed = false
  async start(onFrame: (frame: VadFrame) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (this.disposed) { this.stream.getTracks().forEach(track => track.stop()); return }
    this.context = new AudioContext()
    const source = this.context.createMediaStreamSource(this.stream)
    const analyser = this.context.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    const time = new Float32Array(analyser.fftSize)
    const freq = new Float32Array(analyser.frequencyBinCount)
    const zero = performance.now()
    this.timer = window.setInterval(() => { analyser.getFloatTimeDomainData(time); analyser.getFloatFrequencyData(freq); onFrame(extractFeatures(time, freq, this.context!.sampleRate, performance.now() - zero)) }, 20)
  }
  stop() { this.disposed = true; if (this.timer) clearInterval(this.timer); this.stream?.getTracks().forEach(t => t.stop()); void this.context?.close() }
}
