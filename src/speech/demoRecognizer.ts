import type { PlayItem } from '../shared/events'
import type { RecognitionResult, SpeechRecognizer } from './recognizer'

export class DemoRecognizer implements SpeechRecognizer {
  readonly id = 'demo_script'
  private item?: PlayItem
  private counts = new Map<string, number>()
  isAvailable() { return true }
  start(item: PlayItem) { this.item = item }
  async stop(): Promise<RecognitionResult> {
    if (!this.item) throw new Error('인식할 항목이 없습니다')
    const count = (this.counts.get(this.item.itemId) || 0) + 1
    this.counts.set(this.item.itemId, count)
    const substitutions: Record<string, string> = { '사과': '따과', '사자': '따자', '소리': '또리' }
    const transcript = this.item.level === 'word' && this.item.displayText === '사과' && count <= 3 ? substitutions['사과'] : this.item.level === 'word' && count === 1 ? substitutions[this.item.displayText] || this.item.displayText : this.item.displayText
    return { transcript, alternatives: [transcript], confidence: null, recognizer: this.id }
  }
}
