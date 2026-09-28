import { useEffect, useState } from 'react'
import { api } from '../api/client'

type Observation = {
  id: string; activity: string; round_index: number; difficulty: number; target_phoneme: string; word_position: string
  generalization_level: string; attempt_number: number; cue_type: string; independence: string
  duration_ms: number | null; audio_quality: string; ai_result: string; ai_confidence: string
  possible_error_pattern: string[]; verification_state: string; provenance: Record<string, string>
  evidence: { acoustic?: Record<string, number>; targetText?: string }
}

export default function ClinicalTimeline({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<Observation[]>([])
  const [breakdown, setBreakdown] = useState<{ roundIndex: number; clinicalFocus: string; n: number; demoN: number; aiSupportedSuccesses: number; uncertainN: number; verifiedN: number; verifiedEvaluatedN: number; verifiedObservedN: number; verifiedRate: number | null; limitedData: boolean }[]>([])
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  async function load() {
    const result = await api<{ observations: Observation[] }>(`/sessions/${sessionId}/timeline`)
    setRows(result.observations)
    const summary = await api<{ rounds: typeof breakdown }>(`/sessions/${sessionId}/clinical-summary`)
    setBreakdown(summary.rounds)
  }
  useEffect(() => { void load().catch(cause => setError(String(cause))) }, [sessionId])
  async function decide(id: string, action: 'confirm' | 'correct' | 'reject') {
    try {
      await api(`/observations/${id}/decision`, { method: 'POST', body: JSON.stringify({
        action, correctedResult: action === 'correct' ? corrections[id] || 'retry' : undefined,
        note: notes[id] || (action === 'reject' ? '근거 부족' : ''),
      }) })
      await load()
    } catch (cause) { setError(String(cause)) }
  }
  return <section className="card"><h2>임상 관찰 타임라인</h2><p>AI 분석은 기초 추정입니다. 치료사 확인 전에는 임상 검증 자료가 아닙니다.</p>
    {error && <p role="alert">{error}</p>}
    {breakdown.length > 0 && <div><h3>라운드별 근거</h3><table><thead><tr><th>라운드</th><th>관찰 초점</th><th>실제 표본</th><th>DEMO</th><th>AI 지지</th><th>불확실</th><th>치료사 확인</th><th>확인된 비율 (판정 가능 확인 기준)</th></tr></thead><tbody>{breakdown.map(row => <tr key={row.roundIndex}><td>{row.roundIndex}</td><td>{row.clinicalFocus}</td><td>{row.n === 0 ? '자료 없음' : `${row.n}${row.limitedData ? ' · 적은 자료' : ''}`}</td><td>{row.demoN}</td><td>{row.aiSupportedSuccesses}</td><td>{row.uncertainN}</td><td>{row.verifiedN}{row.verifiedObservedN ? ` · 목표 관찰 ${row.verifiedObservedN}` : ''}</td><td>{row.verifiedRate === null ? '자료 없음' : `${row.verifiedRate}% (${row.verifiedEvaluatedN}건)`}</td></tr>)}</tbody></table></div>}
    {rows.length === 0 ? <p>자료 없음</p> : rows.map(row => <article className="card" key={row.id}>
      <h3>{row.evidence.targetText || '발화'} · {row.activity} · 라운드 {row.round_index} · 난이도 {row.difficulty}</h3>
      <p>목표 /{row.target_phoneme}/ · 위치 {row.word_position} · 단계 {row.generalization_level} · 시도 {row.attempt_number}</p>
      <p>단서 {row.cue_type} · 독립성 {row.independence} · 지속 {row.duration_ms ?? '자료 없음'}ms</p>
      <p>음질 {row.audio_quality} · AI 추정 {row.ai_result} · 확신도 {row.ai_confidence}</p>
      <p>가능한 오류 유형 {row.possible_error_pattern.join(', ') || '자료 없음'} · 검증 {row.verification_state}</p>
      <p>출처: 음향 {row.provenance.acoustic} · AI 결과 {row.provenance.aiResult}</p>
      <details><summary>음향 근거</summary><pre>{JSON.stringify(row.evidence.acoustic || {}, null, 2)}</pre></details>
      <label>검토 메모<input value={notes[row.id] || ''} onChange={event => setNotes({ ...notes, [row.id]: event.target.value })} /></label>
      <label>교정 결과<select value={corrections[row.id] || 'retry'} onChange={event => setCorrections({ ...corrections, [row.id]: event.target.value })}><option value="success">성공</option><option value="retry">재시도</option><option value="uncertain">불확실</option><option value="no_speech">발화 없음</option></select></label>
      <div><button onClick={() => decide(row.id, 'confirm')}>확인</button><button onClick={() => decide(row.id, 'correct')}>교정</button><button onClick={() => decide(row.id, 'reject')}>거부</button></div>
    </article>)}
  </section>
}
