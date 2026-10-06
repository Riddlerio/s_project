import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from './formatTime'

describe('치료사 화면 시각', () => {
  it('시간대가 없는 저장 시각을 UTC로 읽고 한국 시각으로 보여 준다', () => {
    const utcWithoutZone = formatDateTime('2026-10-05T09:42:00')
    expect(utcWithoutZone).toMatch(/2026\.\s*10\.\s*5\.\s*오후\s*6:42/)
    expect(formatDateTime('2026-10-05T09:42:00+00:00')).toBe(utcWithoutZone)
    expect(formatDate('2026-10-05T15:30:00')).toMatch(/2026\.\s*10\.\s*6\./)
  })

  it('날짜만 있는 값은 그대로 두고 빈 값이나 잘못된 값은 기록 없음으로 보여 준다', () => {
    expect(formatDate('2026-10-05')).toBe('2026-10-05')
    expect(formatDateTime('2026-10-05')).toBe('2026-10-05')
    for (const value of [undefined, null, '', '잘못된 값', '2026-02-30T09:42:00', '2026-02-30']) {
      expect(formatDateTime(value)).toBe('기록 없음')
      expect(formatDate(value)).toBe('기록 없음')
    }
  })
})
