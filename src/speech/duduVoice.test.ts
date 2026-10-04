import { describe, expect, it } from 'vitest'
import { DUDU_PITCH, pickDuduVoice, readDuduVoiceSetting, saveDuduVoiceSetting } from './duduVoice'

const voices = [
  { name: 'Microsoft Heami - Korean (Korean)', lang: 'ko-KR' },
  { name: 'Microsoft SunHi Online (Natural) - Korean (Korea)', lang: 'ko-KR' },
  { name: 'Microsoft Hyunsu Multilingual Online (Natural) - Korean (Korea)', lang: 'ko-KR' },
  { name: 'Microsoft InJoon Online (Natural) - Korean (Korea)', lang: 'ko-KR' },
  { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
]

function memory() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}

describe('두두 목소리', () => {
  it('저장한 음성이 없으면 한국어 남성 음성(InJoon → Hyunsu)을 먼저 고른다', () => {
    expect(pickDuduVoice(voices)?.name).toContain('InJoon')
    expect(pickDuduVoice(voices.filter(v => !v.name.includes('InJoon')))?.name).toContain('Hyunsu')
  })

  it('남성 음성이 없으면 다른 한국어 음성, 한국어 음성이 없으면 null', () => {
    expect(pickDuduVoice([voices[0], voices[4]])?.name).toContain('Heami')
    expect(pickDuduVoice([voices[4]])).toBeNull()
    expect(pickDuduVoice([])).toBeNull()
  })

  it('이 기기에 저장한 음성을 우선하고, 사라진 음성이면 기본 규칙으로 돌아간다', () => {
    expect(pickDuduVoice(voices, voices[1].name)?.name).toContain('SunHi')
    expect(pickDuduVoice(voices, 'Missing Voice')?.name).toContain('InJoon')
  })

  it('설정은 저장·복원하고, 망가진 값은 기본 높이로 되돌린다', () => {
    const storage = memory()
    expect(readDuduVoiceSetting(storage)).toEqual({ name: null, pitch: DUDU_PITCH })
    saveDuduVoiceSetting({ name: voices[3].name, pitch: 1.3 }, storage)
    expect(readDuduVoiceSetting(storage)).toEqual({ name: voices[3].name, pitch: 1.3 })
    storage.setItem('speechHero.duduVoice', '{"pitch": 9}')
    expect(readDuduVoiceSetting(storage).pitch).toBe(DUDU_PITCH)
    storage.setItem('speechHero.duduVoice', 'not json')
    expect(readDuduVoiceSetting(storage)).toEqual({ name: null, pitch: DUDU_PITCH })
  })
})
