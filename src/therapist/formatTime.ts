const NO_RECORD = '기록 없음'
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/i

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric',
})
const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
})

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

function parseTime(value: string | null | undefined): Date | string | null {
  if (!value) return null
  const dateOnly = DATE_ONLY.exec(value)
  if (dateOnly) {
    return validCalendarDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])) ? value : null
  }

  const dateTime = DATE_TIME.exec(value)
  if (!dateTime) return null
  const [, year, month, day, hour, minute, second, zone] = dateTime
  if (!validCalendarDate(Number(year), Number(month), Number(day)) ||
      Number(hour) > 23 || Number(minute) > 59 || Number(second || 0) > 59) return null
  if (zone && zone !== 'Z' && zone !== 'z' &&
      (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return null

  const normalized = value.replace(' ', 'T') + (zone ? '' : 'Z')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateTime(value: string | null | undefined): string {
  const parsed = parseTime(value)
  if (typeof parsed === 'string') return parsed
  if (!parsed) return NO_RECORD
  return dateTimeFormatter.format(parsed).replace(/\bAM\b/i, '오전').replace(/\bPM\b/i, '오후')
}

export function formatDate(value: string | null | undefined): string {
  const parsed = parseTime(value)
  return typeof parsed === 'string' ? parsed : parsed ? dateFormatter.format(parsed) : NO_RECORD
}
