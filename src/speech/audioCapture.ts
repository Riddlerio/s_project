import { extractFeatures } from './features'
import type { VadFrame } from './vad'

export class AudioCapture {
  private stream?: MediaStream
  private context?: AudioContext
  private timer?: number
  private disposed = false
  async start(onFrame: (frame: VadFrame) => void) {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') throw new Error('UNSUPPORTED')
    if (!window.isSecureContext) throw new Error('INSECURE_CONTEXT')
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1,
      } })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') throw new Error('PERMISSION_DENIED')
      if (error instanceof DOMException && error.name === 'NotFoundError') throw new Error('NO_DEVICE')
      throw error
    }
    if (this.disposed) { this.stream.getTracks().forEach(track => track.stop()); return }
    this.context = new AudioContext()
    const source = this.context.createMediaStreamSource(this.stream)
    const analyser = this.context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0
    source.connect(analyser)
    const time = new Float32Array(analyser.fftSize)
    const freq = new Float32Array(analyser.frequencyBinCount)
    const zero = performance.now()
    this.timer = window.setInterval(() => { analyser.getFloatTimeDomainData(time); analyser.getFloatFrequencyData(freq); onFrame(extractFeatures(time, freq, this.context!.sampleRate, performance.now() - zero)) }, 20)
  }
  stop() {
    this.disposed = true
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = undefined
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.context = undefined
  }
}
