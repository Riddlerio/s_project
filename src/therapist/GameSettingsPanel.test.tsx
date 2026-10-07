import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CROSSING_PRESETS, GameSettingsView } from './GameSettingsPanel'
import { CrossingSessionSummary, ObservationEvidence } from './ClinicalTimeline'
import { childGameSettings, saveChildGameSettings } from '../api/therapist'
import type { DaeguCrossingGameSettings } from '../api/therapist'
import type { InsightObservation } from './insights'

const saved: DaeguCrossingGameSettings = { startBpm: 84, allowFaster: true, updatedAt: '2026-10-05T01:00:00Z', updatedBy: '두두 치료사' }
const props = { saved, values: saved, busy: false, loading: false, error: '', message: '', onChange: () => {}, onSave: () => {}, onRetry: () => {} }
const row: InsightObservation = {
  id: 'o', sessionId: 's', roundIndex: 1, attemptNumber: 1, targetText: '사', targetPhoneme: 'ㅅ',
  wordPosition: 'initial', level: 'syllable', activity: 'daegu_crossing', cue: 'AUDITORY_MODEL',
  independence: 'MODELED', durationMs: 1000, audioQuality: 'GOOD', aiResult: 'retry', result: 'retry',
  source: 'REAL', verification: 'PENDING', provenance: 'AI', measurementSource: 'CLIENT_REPORTED',
  qualityFlags: [], excludedReasons: ['PENDING'], included: false, reviewNote: '', acoustic: {},
}

afterEach(() => vi.unstubAllGlobals())

describe('아동별 대구대 건너기 설정', () => {
  it.each(['2026-10-05T09:42:00', '2026-10-05T09:42:00Z', '2026-10-05T09:42:00+00:00'])('최근 저장 시각 %s를 서울 시각으로 보여 준다', updatedAt => {
    const html = renderToStaticMarkup(<GameSettingsView {...props} saved={{ ...saved, updatedAt }} />)
    expect(html).toMatch(/최근 저장: 2026\.\s*10\.\s*5\.\s*오후\s*6:42 · 두두 치료사/)
  })

  it('서버가 보낸 임의 정수 박자를 보존하고 네 가지 선택과 적용 시점을 안내한다', () => {
    const html = renderToStaticMarkup(<GameSettingsView {...props} values={{ startBpm: 87, allowFaster: false }} />)
    for (const bpm of [76, 84, 92, 100]) expect(html).toContain(`value="${bpm}"`)
    expect(html).toContain('value="87" selected="">현재 설정 · 87 BPM')
    expect(html).toContain('다음 게임 시작부터 적용')
    expect(html).toContain('말더듬·마비말장애')
    expect(html).toContain('<strong>꺼짐</strong>')
    expect(html).toContain('<button type="submit">설정 저장')
  })

  it('불러오기 전과 저장 중에는 입력·저장을 막고 저장 실패에는 선택값과 오류를 유지한다', () => {
    const loading = renderToStaticMarkup(<GameSettingsView {...props} saved={null} loading />)
    expect(loading).toContain('<fieldset disabled="">')
    expect(loading).toContain('type="submit" disabled="">설정 저장')
    const busy = renderToStaticMarkup(<GameSettingsView {...props} busy values={{ startBpm: 92, allowFaster: false }} />)
    expect(busy).toContain('type="submit" disabled="">저장 중…')
    const failed = renderToStaticMarkup(<GameSettingsView {...props} values={{ startBpm: 92, allowFaster: false }} error="저장 실패" />)
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('저장 실패')
    expect(failed).toContain('value="92" selected=""')
    expect(failed).toContain('<button type="submit">설정 저장')
    const reload = renderToStaticMarkup(<GameSettingsView {...props} saved={null} error="불러오기 실패" />)
    expect(reload).toContain('다시 불러오기')
  })

  it('미저장 기본값은 저장할 수 있고 변경 없는 기존 설정은 중복 저장을 막는다', () => {
    const stored = renderToStaticMarkup(<GameSettingsView {...props} />)
    expect(stored).toContain('type="submit" disabled="">설정 저장')
    expect(stored).toContain('두두 치료사')
    const defaults = renderToStaticMarkup(<GameSettingsView {...props} saved={{ ...saved, updatedAt: null, updatedBy: null }} />)
    expect(defaults).toContain('<button type="submit">설정 저장')
    expect(defaults).toContain('기본값을 사용합니다')
  })

  it('설정 API는 치료사 경로와 CSRF를 쓰며 저장 메타데이터를 PUT에 보내지 않는다', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ daeguCrossing: saved }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('sessionStorage', { getItem: () => 'csrf-test' })
    expect(await childGameSettings('child-1')).toEqual({ daeguCrossing: saved })
    expect(await saveChildGameSettings('child-1', saved)).toEqual({ daeguCrossing: saved })
    expect(fetcher.mock.calls[0][0]).toBe('/api/therapist/children/child-1/game-settings')
    const [url, request] = fetcher.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/api/therapist/children/child-1/game-settings')
    expect(request).toMatchObject({ method: 'PUT', credentials: 'same-origin', headers: { 'X-CSRF-Token': 'csrf-test' } })
    expect(JSON.parse(String(request.body))).toEqual({ daeguCrossing: { startBpm: 84, allowFaster: true } })
  })
})

describe('대구대 건너기 치료사 근거', () => {
  it('서버의 보류·확인 수와 당시 박자를 보여 주며 자동 성공을 정확도로 바꾸지 않는다', () => {
    const html = renderToStaticMarkup(<CrossingSessionSummary summary={{ attemptN: 16, autoSuccessN: 8, deferredN: 4,
      confirmedN: 2, reviewTotalN: 16, rhythm: { startBpm: 87, allowFaster: false } }} />)
    expect(html).toContain('16회')
    expect(html).toContain('8회')
    expect(html).toContain('4회')
    expect(html).toContain('2 / 16')
    expect(html).toContain('실패가 아닙니다')
    expect(html).toContain('87 BPM')
    expect(html).toContain('빨라지기: 꺼짐')
    expect(html).not.toContain('50%')
    expect(html).toContain('게임의 박자 효과는 임상 근거가 아닙니다')
    // 판 수는 서버가 보낼 때만 보인다(이전 응답에는 없음). 여러 판의 시도는 합친다고 안내한다.
    expect(html).not.toContain('끝까지 건넌 판')
    expect(html).toContain('모든 판의 시도를 합칩니다')
    const laps = renderToStaticMarkup(<CrossingSessionSummary summary={{ attemptN: 30, autoSuccessN: 24, deferredN: 2,
      confirmedN: 0, reviewTotalN: 30, rhythm: null, lapN: 3 }} />)
    expect(laps).toContain('끝까지 건넌 판')
    expect(laps).toContain('3판')
  })

  it('이전 회기에 박자 기록이 없으면 기본값을 지어내지 않는다', () => {
    const html = renderToStaticMarkup(<CrossingSessionSummary summary={{ attemptN: 0, autoSuccessN: 0, deferredN: 0,
      confirmedN: 0, reviewTotalN: 0, rhythm: null }} />)
    expect(html).toContain('박자 설정: 기록 없음')
    expect(html).not.toContain('84 BPM')
  })

  it('시도 근거는 서버 설명 그대로 표시하고 기존 게임에는 추가하지 않는다', () => {
    const evidence = ['바람 소리 짧음(60ms, 기준 70ms)', '끝까지 모음 없음']
    const html = renderToStaticMarkup(<ObservationEvidence row={{ ...row, automaticEvidence: evidence }} />)
    expect(html).toContain('자동 추정 근거')
    for (const line of evidence) expect(html).toContain(line)
    expect(html).toContain('발음의 정오를 확정할 수 없습니다')
    const legacy = renderToStaticMarkup(<ObservationEvidence row={{ ...row, activity: 'sky_climb', automaticEvidence: evidence }} />)
    expect(legacy).not.toContain('자동 추정 근거')
    const missing = renderToStaticMarkup(<ObservationEvidence row={row} />)
    expect(missing).toContain('저장된 근거 설명이 없습니다')
    expect(missing).not.toContain('기준 70ms')
  })
})

describe('대상별 빠른 설정(근거 패널의 권장값)', () => {
  it('근거 데이터의 대상별 박자를 버튼으로 보이고, 저장은 따로 누르게 안내한다', () => {
    const html = renderToStaticMarkup(<GameSettingsView {...props} />)
    expect(html).toContain('id="crossing-settings"')
    for (const preset of CROSSING_PRESETS) {
      expect(html).toContain(`<strong>${preset.label}</strong><span>${preset.startBpm} BPM · 빨라지기 ${preset.allowFaster ? '켬' : '끔'}</span>`)
      expect(html).toContain(preset.basis)
    }
    expect(html.match(/class="crossing-preset"/g)).toHaveLength(CROSSING_PRESETS.length)
    expect(html.match(/<button type="button" class="crossing-preset"/g)).toHaveLength(CROSSING_PRESETS.length)
    expect(html).toContain('고른 뒤 &#x27;설정 저장&#x27;을 눌러야 적용됩니다')
  })

  it('설정을 불러오는 중이거나 저장 중에는 빠른 설정도 막힌다', () => {
    const html = renderToStaticMarkup(<GameSettingsView {...props} saved={null} loading />)
    expect(html).toMatch(/<fieldset disabled="">[\s\S]*class="crossing-preset"/)
  })
})
