import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KOREAN_TTS_RELEASE_DELAY_MS, KoreanTts, ONLINE_VOICE_SILENCE_MS, SYNTHESIS_START_MS } from './koreanTts'

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

describe('두두 음성 파일 재생', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function withClips(covered: boolean) {
    const hooks: { onStart(): void; onEnd(): void; onError(): void }[] = []
    const stop = vi.fn()
    const clips = { plan: (text: string) => covered ? [`/clip/${text}.wav`] : null, play: vi.fn((_urls: readonly string[], h: (typeof hooks)[number]) => { hooks.push(h); return { stop } }) }
    const synthesis = { cancel: vi.fn(), speak: vi.fn() }
    const utterances: SpeechSynthesisUtterance[] = []
    const tts = new KoreanTts({ synthesis, clips, timeoutMs: 5000, createUtterance: text => { const u = { text, onstart: null, onend: null, onerror: null } as unknown as SpeechSynthesisUtterance; utterances.push(u); return u } })
    return { tts, clips, hooks, stop, synthesis, utterances }
  }

  it('파일이 있으면 파일을 재생하고, 같은 차단·유예 규칙으로 끝낸다', async () => {
    const t = withClips(true)
    const events = { onStart: vi.fn(), onEnd: vi.fn() }
    const speech = t.tts.speak('정말 잘했어!', events)
    expect(t.tts.blocked).toBe(true)
    expect(t.synthesis.speak).not.toHaveBeenCalled()
    t.hooks[0].onStart(); expect(events.onStart).toHaveBeenCalledOnce()
    t.hooks[0].onEnd()
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(t.tts.blocked).toBe(false)
    expect(await speech.finished).toBe('ended')
    expect(events.onEnd).toHaveBeenCalledOnce()
  })

  it('파일을 못 틀면 같은 말을 브라우저 음성으로 하고, 취소하면 파일 재생도 멈춘다', async () => {
    const t = withClips(true)
    const first = t.tts.speak('정말 잘했어!')
    t.hooks[0].onError()
    expect(t.synthesis.speak).toHaveBeenCalledOnce()
    expect(t.utterances[0].text).toBe('정말 잘했어!')
    t.utterances[0].onend?.({} as SpeechSynthesisEvent)
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await first.finished).toBe('ended')
    const second = t.tts.speak('좋아!')
    second.cancel()
    expect(t.stop).toHaveBeenCalled()
    vi.advanceTimersByTime(KOREAN_TTS_RELEASE_DELAY_MS)
    expect(await second.finished).toBe('cancelled')
  })

  it('파일이 없는 말은 처음부터 브라우저 음성으로 한다', () => {
    const t = withClips(false)
    t.tts.speak('처음 듣는 말이야.')
    expect(t.clips.play).not.toHaveBeenCalled()
    expect(t.synthesis.speak).toHaveBeenCalledOnce()
  })

  it('파일로 말할지 미리 알려 준다(박에 맞춰 부를 때 얼마나 먼저 말할지 정한다)', () => {
    expect(withClips(true).tts.usesClip('사!')).toBe(true)
    expect(withClips(false).tts.usesClip('사!')).toBe(false)
  })

  it('브라우저 음성이 말을 시작하기까지 걸린 시간을 재고, 한 번 늦어진 값에 크게 흔들리지 않는다', () => {
    const t = withClips(false)
    let now = 1000
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    expect(t.tts.synthesisStartMs).toBe(SYNTHESIS_START_MS)
    t.tts.speak('두두 따라 해 봐.')
    now += 600; t.utterances[0].onstart?.({} as SpeechSynthesisEvent)
    expect(t.tts.synthesisStartMs).toBe(600)
    t.tts.speak('사!')
    now += 200; t.utterances[1].onstart?.({} as SpeechSynthesisEvent)
    expect(t.tts.synthesisStartMs).toBe(400)
    t.tts.speak('아주 늦은 말')
    now += 9000; t.utterances[2].onstart?.({} as SpeechSynthesisEvent)
    expect(t.tts.synthesisStartMs).toBe(600)
    clock.mockRestore()
  })

  it('온라인 음성은 재생이 시작된 뒤의 앞 무음까지 더해 말소리가 들리는 때를 잰다', () => {
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    const utterances: SpeechSynthesisUtterance[] = []
    const tts = new KoreanTts({ synthesis: { cancel: vi.fn(), speak: vi.fn() }, clips: null,
      voice: () => ({ voice: { name: 'Microsoft InJoon Online (Natural)', lang: 'ko-KR', localService: false } as SpeechSynthesisVoice, pitch: 1.15 }),
      createUtterance: text => { const u = { text, onstart: null, onend: null, onerror: null } as unknown as SpeechSynthesisUtterance; utterances.push(u); return u } })
    tts.speak('두두 따라 해 봐.')
    now += 100; utterances[0].onstart?.({} as SpeechSynthesisEvent)
    expect(tts.synthesisStartMs).toBe(100 + ONLINE_VOICE_SILENCE_MS)
    clock.mockRestore()
  })
})
