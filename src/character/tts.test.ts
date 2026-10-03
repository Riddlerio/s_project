import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CharacterVoice } from './tts'

const mock = vi.hoisted(() => ({ instances: [] as { blocked: boolean; release?: () => void; onBlockedChange?: (blocked: boolean) => void; speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[] }))
vi.mock('../speech/koreanTts', () => ({ KoreanTts: class {
  blocked = false
  release?: () => void
  onBlockedChange?: (blocked: boolean) => void
  speak = vi.fn(() => {
    this.blocked = true
    this.onBlockedChange?.(true)
    const finished = new Promise<string>(resolve => {
      this.release = () => { this.blocked = false; this.onBlockedChange?.(false); resolve('ended') }
    })
    return { cancel: vi.fn(), finished }
  })
  cancel = vi.fn()
  dispose = vi.fn()
  constructor(options: { onBlockedChange?: (blocked: boolean) => void }) { this.onBlockedChange = options.onBlockedChange; mock.instances.push(this) }
} }))

describe('기존 모험의 안내 음성과 아이 발화 교대', () => {
  beforeEach(() => { mock.instances.length = 0 })

  it('잡음 보정 중에는 안내도 발화 시작도 허용하지 않는다', () => {
    const voice = new CharacterVoice()
    voice.setCalibrating(true)
    expect(voice.speak('마이크 준비 중')).toBeNull()
    expect(voice.beginChildSpeech()).toBe(false)
    expect(mock.instances[0].speak).not.toHaveBeenCalled()
    voice.setCalibrating(false)
    expect(voice.beginChildSpeech()).toBe(true)
  })

  it('아이 발화 중 상태 문구는 음성을 만들지 않고, 발화 종료 뒤 결과 안내를 재생한다', () => {
    const voice = new CharacterVoice()
    expect(voice.beginChildSpeech()).toBe(true)
    expect(voice.beginChildSpeech()).toBe(false)
    expect(voice.speak('마법을 모으는 중이야!')).toBeNull()
    expect(mock.instances[0].speak).not.toHaveBeenCalled()
    voice.endChildSpeech()
    expect(voice.speak('멋진 마법이야!')).not.toBeNull()
    expect(mock.instances[0].speak).toHaveBeenCalledWith('멋진 마법이야!', undefined, { rate: 0.86 })
  })

  it('TTS 예약부터 잔향 차단이 해제될 때까지 새 아이 발화를 막는다', async () => {
    const blocks: boolean[] = []
    const voice = new CharacterVoice({ onBlockedChange: blocked => blocks.push(blocked) })
    const speech = voice.speak('주문을 들려줘!')!
    expect(blocks).toEqual([true])
    expect(voice.blocked).toBe(true)
    expect(voice.beginChildSpeech()).toBe(false)
    // onstart·onend 여부와 관계없이 공통 TTS가 잔향 유예를 끝낼 때까지 차단한다.
    expect(voice.beginChildSpeech()).toBe(false)
    mock.instances[0].release!()
    await speech.finished
    expect(blocks).toEqual([true, false])
    expect(voice.beginChildSpeech()).toBe(true)
  })

  it('화면이 사라지면 음성을 정리하고 늦은 결과가 재생되지 않는다', () => {
    const voice = new CharacterVoice()
    voice.speak('멋진 마법이야!')
    voice.dispose()
    expect(mock.instances[0].dispose).toHaveBeenCalledOnce()
    expect(voice.speak('늦게 온 안내')).toBeNull()
    expect(voice.beginChildSpeech()).toBe(false)
    expect(mock.instances[0].speak).toHaveBeenCalledTimes(1)
  })
})
