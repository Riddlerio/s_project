import { afterEach, describe, expect, it, vi } from 'vitest'
import { goodbyeLines } from '../child/DuduGoodbye'
import { isName } from '../child/koreanText'
import { listenAgainLine, MISS_LINE, modelLine, praiseLine, previewPlan, RETRY_LINE, retryLine } from '../game/crossing/crossingFlow'
import { clipPlan, DUDU_CLIPS, splitSentences } from './duduClips'
import ENVELOPES from '../../shared/dudu_voice_envelopes.json'

describe('두두 음성 파일(VOLI 하람)', () => {
  it('문장은 마침표·느낌표·물음표에서 나누고, 따옴표·물결·쉼표는 문장 안에 둔다', () => {
    expect(splitSentences('도착! 정말 잘했어! 역시 바람용사야!')).toEqual(['도착!', '정말 잘했어!', '역시 바람용사야!'])
    expect(splitSentences("안녕~ 만나서 반가워! 바람용사야. 나는 두두야.")).toEqual(['안녕~ 만나서 반가워!', '바람용사야.', '나는 두두야.'])
    expect(splitSentences("바람 소리 '스~'를 먼저 내 볼까?")).toEqual(["바람 소리 '스~'를 먼저 내 볼까?"])
  })

  it('모든 문장에 파일이 있을 때만 재생 목록을 주고, 하나라도 없으면 브라우저 음성으로 넘긴다', () => {
    expect(clipPlan('두두 따라 해 봐. 사!')).toEqual(['/assets/voice/dudu/c_model.wav', '/assets/voice/dudu/w_sa.wav'])
    expect(clipPlan('두두 따라 해 봐. 바다!')).toBeNull()
    expect(clipPlan('')).toBeNull()
  })

  it('모든 음성 파일에 입 모양 값이 있다(scripts/build-voice-envelopes.mjs)', () => {
    const clips = ENVELOPES.clips as Record<string, string>
    expect(Object.keys(clips).sort()).toEqual(DUDU_CLIPS.map(([, id]) => id).sort())
    for (const [, id] of DUDU_CLIPS) expect(clips[id], id).toMatch(/^[0-9]+$/)
  })

  it('목록의 파일이 모두 있고 16kHz 모노 WAV다', async () => {
    // 이 프로젝트는 node 타입 선언을 쓰지 않아 동적 import로 읽는다(테스트는 node 환경).
    const fs: { readFileSync(path: URL): Uint8Array } = await import(/* @vite-ignore */ `node:${'fs'}`)
    for (const [, id] of DUDU_CLIPS) {
      const bytes = fs.readFileSync(new URL(`../../public/assets/voice/dudu/${id}.wav`, import.meta.url))
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      expect(new TextDecoder().decode(bytes.subarray(0, 4)), id).toBe('RIFF')
      expect(view.getUint16(22, true), id).toBe(1)
      expect(view.getUint32(24, true), id).toBe(16000)
    }
  })

  it('대구대 건너기·마무리에서 두두가 하는 말은 모두 파일로 말한다(한 말 안에서 목소리가 섞이지 않게)', () => {
    const words = [...new Set([...previewPlan('syllable'), ...previewPlan('word')].map(item => item.text))]
    const lines = [
      RETRY_LINE, MISS_LINE, '남은 길은 두두랑 같이 가자!',
      ...words.flatMap(word => [modelLine(word), listenAgainLine(word), retryLine('short_frication', word), retryLine('no_vowel', word)]),
      ...[0, 1, 2, 3].flatMap(i => [praiseLine(i), `딱 맞았어! ${praiseLine(i)}`]),
      `도착! 정말 잘했어! 역시 ${isName('바람용사')}!`, '도착! 정말 잘했어! 역시 최고야!',
      ...goodbyeLines({ attempts: 12, word: '사과' }), ...goodbyeLines({ attempts: 0 }),
    ]
    expect(lines.filter(line => clipPlan(line) === null)).toEqual([])
  })

  it('대화 첫 인사와 게임 권유도 파일로 말한다(대화 유도 문장 전체는 백엔드 test_dudu_voice_lines.py가 확인)', () => {
    expect(clipPlan('안녕~ 만나서 반가워! 바람용사야. 나는 두두야.')).toHaveLength(3)
    // 시연 전용 DEMO 아동(DEMO-CROSSING) 별명도 인사·도착 칭찬을 파일로 말한다.
    expect(clipPlan('안녕~ 만나서 반가워! 두두친구야. 나는 두두야.')).toHaveLength(3)
    expect(clipPlan(`도착! 정말 잘했어! 역시 ${isName('두두친구')}!`)).toHaveLength(3)
    expect(clipPlan("우리 게임 해 볼까? 아래 '대구대 건너기'를 눌러 볼래?")).toHaveLength(2)
  })
})

describe('두두 음성 재생기(오디오 하나를 다시 씀, iOS 대응)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  class FakeAudio {
    static instances: FakeAudio[] = []
    src = ''; muted = false; paused = true; dataset: Record<string, string> = {}
    onplaying: (() => void) | null = null; onended: (() => void) | null = null; onerror: (() => void) | null = null
    played: { src: string; muted: boolean }[] = []
    rejectNext = false
    constructor() { FakeAudio.instances.push(this) }
    play() {
      this.played.push({ src: this.src, muted: this.muted }); this.paused = false
      if (this.rejectNext) { this.rejectNext = false; return Promise.reject(new Error('AbortError')) }
      queueMicrotask(() => this.onplaying?.())
      return Promise.resolve()
    }
    pause() { this.paused = true }
  }
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

  async function load() {
    FakeAudio.instances = []
    vi.stubGlobal('window', {})
    vi.stubGlobal('Audio', FakeAudio)
    return import('./duduClips')
  }

  it('누름 처리기에서 무음으로 한 번 깨우고, 문장들은 같은 오디오로 차례로 재생한다', async () => {
    const { unlockDuduAudio, browserClipPlayer } = await load()
    unlockDuduAudio()
    await flush()
    const audio = FakeAudio.instances[0]
    expect(audio.played[0]).toMatchObject({ muted: true })
    expect(audio.dataset.unlocked).toBe('1')
    unlockDuduAudio()
    expect(audio.played).toHaveLength(1)

    const hooks = { onStart: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }
    browserClipPlayer(0)!.play(['/a.wav', '/b.wav'], hooks)
    await flush()
    expect(hooks.onStart).toHaveBeenCalledOnce()
    audio.onended?.(); await new Promise(resolve => setTimeout(resolve, 0)); await flush()
    audio.onended?.(); await new Promise(resolve => setTimeout(resolve, 0))
    expect(hooks.onEnd).toHaveBeenCalledOnce()
    expect(FakeAudio.instances).toHaveLength(1)
    expect(audio.played.slice(1).map(row => [row.src, row.muted])).toEqual([['/a.wav', false], ['/b.wav', false]])
  })

  it('재생 위치의 소리 크기로 입 모양 값을 알려 주고, 쉼에는 0, 다 말하면 null이다', async () => {
    const { browserClipPlayer, envelopeLevel, speakingLevel } = await load()
    expect(speakingLevel()).toBeNull()
    const hooks = { onStart: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }
    browserClipPlayer(0)!.play(['/assets/voice/dudu/w_sa.wav', '/assets/voice/dudu/p_good.wav'], hooks)
    const audio = FakeAudio.instances[0] as FakeAudio & { currentTime: number }
    audio.currentTime = 0.3
    expect(speakingLevel()).toBe(envelopeLevel('w_sa', 0.3))
    expect(envelopeLevel('w_sa', 0.3)).toBeGreaterThan(0.5)  // '사'의 모음 부분
    expect(envelopeLevel('w_sa', 0)).toBe(0)                  // 시작 전 무음
    audio.onended?.()
    expect(speakingLevel()).toBe(0)                            // 문장 사이 쉼
    await new Promise(resolve => setTimeout(resolve, 0)); await flush()
    audio.onended?.(); await new Promise(resolve => setTimeout(resolve, 0))
    expect(hooks.onEnd).toHaveBeenCalledOnce()
    expect(speakingLevel()).toBeNull()
  })

  it('다른 말로 바뀌며 끊긴 재생은 실패로 세지 않고, 진짜 재생 실패만 onError로 알린다', async () => {
    const { browserClipPlayer } = await load()
    const player = browserClipPlayer(0)!
    const first = { onStart: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }
    const audio = (player.play(['/a.wav'], first), FakeAudio.instances[0])
    audio.rejectNext = true
    const handle = player.play(['/b.wav'], first)
    handle.stop()
    await flush()
    expect(first.onError).not.toHaveBeenCalled()
    expect(audio.paused).toBe(true)
    const broken = { onStart: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }
    audio.rejectNext = true
    player.play(['/c.wav'], broken)
    await flush()
    expect(broken.onError).toHaveBeenCalledOnce()
  })
})
