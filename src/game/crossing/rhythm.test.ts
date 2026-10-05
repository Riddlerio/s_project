import { describe, expect, it } from 'vitest'
import {
  bar, barMs, beatLeadMs, beatMs, beatPhase, BPM, DEFAULT_BEAT_LEAD_MS, DEFAULT_RHYTHM, nextBarStart, nextBeat, nextBpm,
  PERFECT_EARLY_MS, PERFECT_LATE_MS, rhythmSetting, TICK_MS, TICK_TAIL_MS, timingKind, WINDOW_BEATS,
} from './rhythm'

describe('대구대 건너기 박자', () => {
  it('84BPM이면 한 박 약 714ms, 한 마디 4박', () => {
    expect(beatMs(84)).toBeCloseTo(714.29, 1)
    expect(barMs(84)).toBeCloseTo(2857.14, 1)
  })

  it('다음 마디·다음 박은 같은 격자 위에 있다', () => {
    const anchor = 1000, bpm = 120 // 박 500ms, 마디 2000ms
    expect(nextBarStart(anchor, bpm, 500)).toBe(1000)
    expect(nextBarStart(anchor, bpm, 1000)).toBe(1000)
    expect(nextBarStart(anchor, bpm, 1001)).toBe(3000)
    expect(nextBarStart(anchor, bpm, 2700, 400)).toBe(5000)
    expect(nextBeat(anchor, bpm, 1250)).toBe(1500)
    expect(nextBeat(anchor, bpm, 1500)).toBe(1500)
    expect(beatPhase(anchor, bpm, 1250)).toBeCloseTo(0.5)
    expect(beatPhase(anchor, bpm, 900)).toBeCloseTo(0.8)
  })

  it('마디: 4박에 카드가 들어오고, 3박 똑 소리가 다 들린 뒤 4박 전에 마이크를 연다', () => {
    const b = bar(0, 84)
    expect(b.land).toBeCloseTo(3 * beatMs(84))
    expect(b.micOpen).toBeCloseTo(b.beats[2] + TICK_MS + TICK_TAIL_MS)
    expect(b.micOpen).toBeLessThan(b.land - PERFECT_EARLY_MS)
    expect(b.windowEnd).toBeCloseTo(b.land + WINDOW_BEATS * beatMs(84))
    // 출력 지연이 있으면 그만큼 늦게 열되 4박보다 늦지 않고, 지연은 400ms까지만 본다.
    expect(bar(0, 84, 100).micOpen).toBeCloseTo(b.micOpen + 100)
    expect(bar(0, 100, 5000).micOpen).toBe(bar(0, 100).land)
    expect(bar(0, 84, Number.NaN).micOpen).toBeCloseTo(b.micOpen)
  })

  it('가장 빠른 박자(100)에서도 마이크가 4박 전에 열린다', () => {
    const fast = bar(0, BPM.max)
    expect(fast.micOpen).toBeLessThan(fast.land - PERFECT_EARLY_MS)
  })

  it("박 맞춤: 4박 앞 300ms ~ 뒤 400ms면 '딱 맞았어!', 아니면 '펑!'", () => {
    expect(timingKind(1000, 1000)).toBe('perfect')
    expect(timingKind(1000 - PERFECT_EARLY_MS, 1000)).toBe('perfect')
    expect(timingKind(1000 + PERFECT_LATE_MS, 1000)).toBe('perfect')
    expect(timingKind(1000 - PERFECT_EARLY_MS - 1, 1000)).toBe('good')
    expect(timingKind(1000 + PERFECT_LATE_MS + 1, 1000)).toBe('good')
    expect(timingKind(null, 1000)).toBe('good')
  })

  it('빠르기: 8번 중 7번 성공이면 +4, 2번 연속 어려우면 -4, 범위 72~100', () => {
    const many = Array<'success'>(8).fill('success')
    expect(nextBpm(84, many, DEFAULT_RHYTHM)).toBe(88)
    expect(nextBpm(84, ['retry', ...many.slice(1)], DEFAULT_RHYTHM)).toBe(88)
    expect(nextBpm(84, ['success', 'retry', 'miss', 'success', 'success', 'success', 'success', 'success'], DEFAULT_RHYTHM)).toBe(84)
    expect(nextBpm(100, many, DEFAULT_RHYTHM)).toBe(100)
    expect(nextBpm(84, ['success', 'retry', 'miss'], DEFAULT_RHYTHM)).toBe(80)
    expect(nextBpm(84, ['uncertain', 'no_speech'], DEFAULT_RHYTHM)).toBe(80)
    expect(nextBpm(BPM.min, ['retry', 'retry'], DEFAULT_RHYTHM)).toBe(BPM.min)
    expect(nextBpm(84, ['success'], DEFAULT_RHYTHM)).toBe(84)
  })

  it('빨라지기를 끄면(말더듬·마비말장애) 시작 박자보다 빨라지지 않지만, 느려진 뒤 시작 박자로는 돌아온다', () => {
    const setting = { startBpm: 84, allowFaster: false }
    const many = Array<'success'>(8).fill('success')
    expect(nextBpm(84, many, setting)).toBe(84)
    expect(nextBpm(80, many, setting)).toBe(84)
    expect(nextBpm(84, ['retry', 'retry'], setting)).toBe(80)
  })

  it('서버 설정이 없거나 이상하면 기본값, 시작 박자는 76~100으로 자른다', () => {
    expect(rhythmSetting(undefined)).toEqual(DEFAULT_RHYTHM)
    expect(rhythmSetting(null)).toEqual(DEFAULT_RHYTHM)
    expect(rhythmSetting({ startBpm: 92, allowFaster: false })).toEqual({ startBpm: 92, allowFaster: false })
    expect(rhythmSetting({ startBpm: 40 })).toEqual({ startBpm: BPM.settingMin, allowFaster: true })
    expect(rhythmSetting({ startBpm: 300, allowFaster: 'no' })).toEqual({ startBpm: BPM.settingMax, allowFaster: true })
    expect(rhythmSetting({ startBpm: Number.NaN })).toEqual(DEFAULT_RHYTHM)
  })

  it('두두가 박에 맞춰 부를 때 음성 파일의 모음 시작만큼 먼저 튼다', () => {
    // '사!' 파일(w_sa)의 입 모양 값 0033469…에서 6 이상이 처음 나오는 것은 다섯째(200ms)다.
    expect(beatLeadMs('사!')).toBe(200)
    for (const text of ['소!', '시!', '수!', '사과!', '수박!', '소리!', '시소!']) {
      expect(beatLeadMs(text)).toBeGreaterThan(0)
      expect(beatLeadMs(text)).toBeLessThan(500)
    }
    expect(beatLeadMs('파일 없는 말')).toBe(DEFAULT_BEAT_LEAD_MS)
  })
})
