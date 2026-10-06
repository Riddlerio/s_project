import { useEffect, useState } from 'react'
import { childGameSettings, saveChildGameSettings } from '../api/therapist'
import type { DaeguCrossingGameSettings, DaeguCrossingSettingsInput } from '../api/therapist'
import { formatDateTime } from './formatTime'
import './crossingTherapist.css'

const TEMPO_OPTIONS = [
  { bpm: 76, name: '느리게' }, { bpm: 84, name: '보통' },
  { bpm: 92, name: '조금 빠르게' }, { bpm: 100, name: '빠르게' },
]

export function GameSettingsView({ saved, values, busy, loading, error, message, onChange, onSave, onRetry }: {
  saved: DaeguCrossingGameSettings | null; values: DaeguCrossingSettingsInput
  busy: boolean; loading: boolean; error: string; message: string
  onChange(values: DaeguCrossingSettingsInput): void; onSave(): void; onRetry(): void
}) {
  const changed = !!saved && (!saved.updatedAt || values.startBpm !== saved.startBpm || values.allowFaster !== saved.allowFaster)
  return <section className="card crossing-settings" aria-label="대구대 건너기 설정">
    <div className="crossing-panel-heading"><h2>대구대 건너기 설정</h2><span className="crossing-setting-badge">다음 게임 시작부터 적용</span></div>
    <p>아동이 편안하게 말할 수 있는 박자를 치료사가 정합니다. 현재 진행 중인 게임과 지난 회기 기록은 바뀌지 않습니다.</p>
    {loading && <p role="status">박자 설정을 불러오는 중입니다.</p>}
    {error && <div role="alert"><p>{error}</p>{!saved && !loading && <button type="button" className="quiet" onClick={onRetry}>다시 불러오기</button>}</div>}
    <form onSubmit={event => { event.preventDefault(); if (!busy && !loading && changed) onSave() }}>
      <fieldset disabled={loading || busy || !saved}>
        <legend className="crossing-visually-hidden">대구대 건너기 박자</legend>
        <label className="crossing-tempo-label">시작 박자
          <select value={values.startBpm} onChange={event => onChange({ ...values, startBpm: Number(event.target.value) })}>
            {!TEMPO_OPTIONS.some(option => option.bpm === values.startBpm) && <option value={values.startBpm}>현재 설정 · {values.startBpm} BPM</option>}
            {TEMPO_OPTIONS.map(option => <option key={option.bpm} value={option.bpm}>{option.name} · {option.bpm} BPM</option>)}
          </select>
        </label>
        <label className="crossing-faster-toggle"><input type="checkbox" checked={values.allowFaster}
          onChange={event => onChange({ ...values, allowFaster: event.target.checked })} aria-describedby="crossing-faster-guidance" />
          <span>잘하면 조금씩 빨라지기<strong>{values.allowFaster ? '켜짐' : '꺼짐'}</strong></span>
        </label>
        <p id="crossing-faster-guidance" className="small">말더듬·마비말장애 아동은 이 기능을 꺼두는 것을 권합니다. 아동의 반응을 살펴 치료사가 조절해 주세요.</p>
      </fieldset>
      <div className="crossing-settings-actions"><button type="submit" disabled={loading || busy || !changed}>{busy ? '저장 중…' : '설정 저장'}</button>
        <p className="small">{saved?.updatedAt ? `최근 저장: ${formatDateTime(saved.updatedAt)}${saved.updatedBy ? ` · ${saved.updatedBy}` : ''}` : saved ? '아직 저장한 설정이 없어 기본값을 사용합니다.' : '설정을 불러온 뒤 저장할 수 있습니다.'}</p>
      </div>
      {message && <p role="status" className="crossing-save-message">{message}</p>}
    </form>
  </section>
}

function ChildGameSettingsPanel({ childId }: { childId: string }) {
  const [saved, setSaved] = useState<DaeguCrossingGameSettings | null>(null)
  const [values, setValues] = useState<DaeguCrossingSettingsInput>({ startBpm: 84, allowFaster: true })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void childGameSettings(childId).then(data => {
      if (active) { setSaved(data.daeguCrossing); setValues(data.daeguCrossing) }
    }).catch(() => { if (active) setError('박자 설정을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [childId, reload])
  async function save() {
    if (!saved || loading || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await saveChildGameSettings(childId, { startBpm: values.startBpm, allowFaster: values.allowFaster })
      setSaved(data.daeguCrossing); setValues(data.daeguCrossing)
      setMessage('저장했습니다. 다음 게임 시작부터 적용됩니다.')
    } catch { setError('설정을 저장하지 못했습니다. 선택한 값은 유지됩니다. 다시 저장해 주세요.') }
    finally { setBusy(false) }
  }
  return <GameSettingsView saved={saved} values={values} busy={busy} loading={loading} error={error} message={message}
    onChange={next => { setValues(next); setMessage('') }} onSave={() => { void save() }} onRetry={() => setReload(value => value + 1)} />
}

/** 아동을 바꿀 때 폼과 진행 중 응답을 분리해 이전 아동의 설정이 새 아동에게 보이지 않게 한다. */
export default function GameSettingsPanel({ childId }: { childId: string }) {
  return <ChildGameSettingsPanel key={childId} childId={childId} />
}
