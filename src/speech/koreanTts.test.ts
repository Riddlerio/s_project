import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KOREAN_TTS_RELEASE_DELAY_MS, KoreanTts } from './koreanTts'

function setup() {
  const utterances: SpeechSynthesisUtterance[] = []
  const blocked: boolean[] = []
  const synthesis = { cancel: vi.fn(), speak: vi.fn() }
  const tts = new KoreanTts({ synthesis, timeoutMs: 1000,
    createUtterance: text => {
      const utterance = { text, onstart: null, onend: null, onerror: null } as unknown as SpeechSynthesisUtterance
      utterances.push(utterance)
      return utterance
    },
    onBlockedChange: value => blocked.push(value),
  })
  const end = (index = utterances.length - 1) => utterances[index].onend?.({} as SpeechSynthesisEvent)
  const start = (index = utterances.length - 1) => utterances[index].onstart?.({} as SpeechSynthesisEvent)
  return { tts, utterances, blocked, synthesis, end, start }
}

describe('두두 한국어 음성의 입력 차단과 종료 유예', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('브라우저 onstart 이전부터 차단하고 아동이 말한 이름을 치환하지 않는다', async () => {
    const t = setup()
    const events = { onStart: vi.fn(), onEnd: vi.fn() }
    const speech = t.tts.speak('내 친구 호야와 루미 이야기야.', events, { rate: 0.8 })
    expect(t.tts.blocked).toBe(true)
    expect(events.onStart).not.toHaveBeenCalled()
    expect(t.utterances[0]).toMatchObject({ text: '내 친구 호야와 루미 이야기야.', lang: 'ko-KR', rate: 0.8 })
    t.start()
    expect(events.onStart).toHaveBeenCalledOnce()
    t.end()
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS - 1)
    expect(t.tts.blocked).toBe(true)
    expect(events.onEnd).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(t.tts.blocked).toBe(false)
    expect(events.onEnd).toHaveBeenCalledOnce()
    expect(await speech.finished).toBe('ended')
    expect(t.blocked).toEqual([true, false])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('종료 이벤트가 없는 음성은 실제로 취소한 뒤 유예를 거쳐 입력을 연다', async () => {
    const t = setup()
    const onEnd = vi.fn()
    const speech = t.tts.speak('긴 대답', { onEnd })
    const lateEnd = t.utterances[0].onend!
    const cancelCount = t.synthesis.cancel.mock.calls.length
    vi.advanceTimersByTime(1000)
    expect(t.synthesis.cancel).toHaveBeenCalledTimes(cancelCount + 1)
    expect(t.tts.blocked).toBe(true)
    expect(onEnd).not.toHaveBeenCalled()
    lateEnd.call(t.utterances[0], {} as SpeechSynthesisEvent)
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await speech.finished).toBe('timeout')
    expect(onEnd).toHaveBeenCalledOnce()
    expect(t.tts.blocked).toBe(false)
  })

  it('오류도 실제 음성을 비우고 종료 유예가 끝난 뒤에만 완료한다', async () => {
    const t = setup()
    const speech = t.tts.speak('답변')
    t.utterances[0].onerror?.({} as SpeechSynthesisErrorEvent)
    expect(t.synthesis.cancel).toHaveBeenCalledTimes(2)
    expect(t.tts.blocked).toBe(true)
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await speech.finished).toBe('error')
  })

  it('취소와 취소 이후의 늦은 start/end는 다음 차례를 호출하지 않는다', async () => {
    const t = setup()
    const events = { onStart: vi.fn(), onEnd: vi.fn() }
    const speech = t.tts.speak('답변', events)
    const lateStart = t.utterances[0].onstart!
    const lateEnd = t.utterances[0].onend!
    speech.cancel()
    lateStart.call(t.utterances[0], {} as SpeechSynthesisEvent); lateEnd.call(t.utterances[0], {} as SpeechSynthesisEvent)
    expect(t.tts.blocked).toBe(true)
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await speech.finished).toBe('cancelled')
    expect(events.onStart).not.toHaveBeenCalled()
    expect(events.onEnd).not.toHaveBeenCalled()
    expect(t.tts.blocked).toBe(false)
  })

  it('정상 종료 뒤 유예 중 취소해도 기존 onEnd를 호출하지 않는다', async () => {
    const t = setup()
    const onEnd = vi.fn()
    const speech = t.tts.speak('답변', { onEnd })
    t.end()
    vi.advanceTimersByTime(150)
    speech.cancel()
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await speech.finished).toBe('cancelled')
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('재생 교체는 입력을 계속 차단하며 이전 완료 이벤트를 버린다', async () => {
    const t = setup()
    const oldEnd = vi.fn()
    const first = t.tts.speak('이전 말', { onEnd: oldEnd })
    const lateEnd = t.utterances[0].onend!
    const second = t.tts.speak('다음 말')
    expect(await first.finished).toBe('cancelled')
    lateEnd.call(t.utterances[0], {} as SpeechSynthesisEvent)
    expect(t.blocked).toEqual([true])
    expect(oldEnd).not.toHaveBeenCalled()
    t.end()
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await second.finished).toBe('ended')
    expect(t.blocked).toEqual([true, false])
  })

  it('화면 이탈은 음성과 모든 timer를 정리하고 이후 재생을 받지 않는다', async () => {
    const t = setup()
    const onEnd = vi.fn()
    const speech = t.tts.speak('답변', { onEnd })
    const lateEnd = t.utterances[0].onend!
    t.tts.dispose()
    lateEnd.call(t.utterances[0], {} as SpeechSynthesisEvent)
    expect(await speech.finished).toBe('cancelled')
    expect(vi.getTimerCount()).toBe(0)
    expect(onEnd).not.toHaveBeenCalled()
    expect(await t.tts.speak('늦은 말').finished).toBe('cancelled')
    expect(t.synthesis.speak).toHaveBeenCalledOnce()
  })

  it('TTS 미지원 기기에서도 차례가 멈추지 않고 유예 뒤 완료한다', async () => {
    const onEnd = vi.fn()
    const tts = new KoreanTts({ synthesis: null })
    const speech = tts.speak('안녕!', { onEnd })
    expect(tts.blocked).toBe(true)
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await speech.finished).toBe('unavailable')
    expect(onEnd).toHaveBeenCalledOnce()
    expect(tts.blocked).toBe(false)
  })

  it('브라우저가 speak에서 예외를 던져도 입력을 영구히 닫지 않는다', async () => {
    const t = setup()
    t.synthesis.speak.mockImplementation(() => { throw new Error('오디오 출력 실패') })
    const speech = t.tts.speak('안녕!')
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await speech.finished).toBe('error')
    expect(t.tts.blocked).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
