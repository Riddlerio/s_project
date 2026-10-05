import { describe, expect, it } from 'vitest'
import { goodbyeLines } from '../child/DuduGoodbye'
import { isName } from '../child/koreanText'
import { listenAgainLine, MISS_LINE, modelLine, praiseLine, previewPlan, RETRY_LINE, retryLine } from '../game/crossing/crossingFlow'
import { clipPlan, DUDU_CLIPS, splitSentences } from './duduClips'

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

  it('대화 첫 인사와 게임 권유(Codex 대본, DEMO 아동 바람용사)도 파일로 말한다', () => {
    expect(clipPlan('안녕~ 만나서 반가워! 바람용사야. 나는 두두야.')).toHaveLength(3)
    expect(clipPlan("우리 게임 해 볼까? 아래 '대구대 건너기'를 눌러 볼래?")).toHaveLength(2)
  })
})
