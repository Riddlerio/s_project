import { KoreanTts } from '../speech/koreanTts'

type VoiceOptions = ConstructorParameters<typeof KoreanTts>[0]

/** 기존 모험도 보정·아동 발화·두두 음성이 겹치지 않게 교대로 진행한다. */
export class CharacterVoice {
  private readonly tts: KoreanTts
  private calibrating = false
  private childSpeaking = false
  private disposed = false

  constructor(options: VoiceOptions = {}) { this.tts = new KoreanTts(options) }
  get blocked() { return this.tts.blocked }
  setCalibrating(active: boolean) { this.calibrating = active }
  beginChildSpeech() {
    if (this.disposed || this.calibrating || this.childSpeaking || this.tts.blocked) return false
    this.childSpeaking = true
    return true
  }
  endChildSpeech() { this.childSpeaking = false }
  speak(text: string) {
    if (this.disposed || this.calibrating || this.childSpeaking) return null
    return this.tts.speak(text, undefined, { rate: 0.86 })
  }
  cancel() { this.tts.cancel() }
  dispose() { this.disposed = true; this.childSpeaking = false; this.tts.dispose() }
}

let defaultVoice: CharacterVoice | undefined
export function speak(text: string) {
  defaultVoice ??= new CharacterVoice()
  return defaultVoice.speak(text)
}
