import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { sessionInsights } from '../api/therapist'
import { verificationText } from './clinicalLabels'
import { CUE_NAMES, FLAG_LABELS, INDEPENDENCE_LABELS, insightRate, MEASUREMENT_SOURCE_LABELS, PROVENANCE_LABELS, QUALITY_LABELS, RESULT_LABELS, SOURCE_LABELS } from './insights'
import type { InsightObservation, Provenance, SessionInsights } from './insights'
import { ACTIVITY_LABELS, LEVEL_LABELS, POSITION_LABELS } from './planning'
import SessionNote from './SessionNote'

export function EvidenceSymbol({ kind }: { kind: Provenance }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" data-provenance={kind}>
    {kind === 'SYSTEM' ? <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      : kind === 'AI' ? <path d="M12 2 L23 21 H1 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        : <path d="M12 1 L23 12 L12 23 L1 12 Z" fill="currentColor" />}
  </svg>
}

export function RoundTimeline({ rows, selectedId, onSelect }: { rows: InsightObservation[]; selectedId: string; onSelect: (id: string) => void }) {
  const rounds = [...new Set([1, 2, 3, 4, 5, ...rows.map(row => row.roundIndex)])].sort((left, right) => left - right)
  return <div className="round-timeline">
    <p className="timeline-legend">{(['SYSTEM', 'AI', 'THERAPIST'] as const).map(kind => <span key={kind}><EvidenceSymbol kind={kind} /> {PROVENANCE_LABELS[kind]}</span>)}</p>
    <p className="small">시도 하나가 점 하나입니다. 좌우 순서는 관찰 기록 순서이며 간격은 시간 길이가 아닙니다. Tab 키와 Enter로도 선택할 수 있습니다.</p>
    {rounds.map(round => <div className="round-band" key={round}><strong>{round}라운드</strong><div className="round-attempts">
      {rows.filter(row => row.roundIndex === round).map((row, index) => <button key={row.id} type="button"
        aria-pressed={selectedId === row.id} aria-controls="selected-observation"
        aria-label={`${round}라운드 ${index + 1}번째 관찰 · ${row.targetText} · ${PROVENANCE_LABELS[row.provenance]} · ${row.included ? '비교 포함' : '분모 제외'}`}
        className={`attempt-point ${row.included ? '' : 'excluded'}`} onClick={() => onSelect(row.id)}>
        <EvidenceSymbol kind={row.provenance} /><span>{index + 1}</span>
      </button>)}
      {!rows.some(row => row.roundIndex === round) && <span className="muted">관찰 없음</span>}
    </div></div>)}
  </div>
}

export function ObservationEvidence({ row }: { row: InsightObservation }) {
  return <>
    <h3>{ACTIVITY_LABELS[row.activity as keyof typeof ACTIVITY_LABELS] || row.activity} · {row.targetText} · {row.roundIndex}라운드 · 시도 {row.attemptNumber}</h3>
    <p><strong>{SOURCE_LABELS[row.source]} · {PROVENANCE_LABELS[row.provenance]}</strong> · {verificationText(row.verification)}</p>
    {row.source !== 'REAL' && <p className="notice">실제 음성 임상 자료가 아닙니다. 검토해도 임상 비교에서는 제외됩니다.</p>}
    <p>목표 /{row.targetPhoneme}/ · {POSITION_LABELS[row.wordPosition] || row.wordPosition} · {LEVEL_LABELS[row.level] || row.level}</p>
    <p>단서 {CUE_NAMES[row.cue] || row.cue} · 독립성 {INDEPENDENCE_LABELS[row.independence] || row.independence} · 측정 지속시간 {row.durationMs === null ? '자료 없음' : `${row.durationMs}ms`}</p>
    <p>AI 추정: {RESULT_LABELS[row.aiResult] || row.aiResult} · 현재 검토 결과: {RESULT_LABELS[row.result] || row.result}</p>
    {row.activity === 'daegu_crossing' && <p>음향 근사: 시작 마찰음과 이후 유성 구간을 사용합니다. 정확한 발음 판정이 아니며 치료사 확인이 필요합니다.</p>}
    <p>음질 {QUALITY_LABELS[row.audioQuality] || row.audioQuality} · 음향 출처 {MEASUREMENT_SOURCE_LABELS[row.measurementSource] || row.measurementSource}</p>
    <div className="quality-flags">{row.qualityFlags.map(flag => <span key={flag}>{FLAG_LABELS[flag] || flag}</span>)}</div>
    <p className={row.included ? '' : 'notice'}>{row.included ? '확인된 성공률 분모에 포함' : `성공률 분모 제외: ${row.excludedReasons.map(reason => FLAG_LABELS[reason] || reason).join(' · ')}. 제외는 실패가 아닙니다.`}</p>
    {row.reviewNote && <p>최근 검토 메모: {row.reviewNote}</p>}
    <details><summary>저장된 측정 요약</summary><pre>{JSON.stringify(row.acoustic, null, 2)}</pre><p>브라우저에서 보고한 요약이며 원음 재생은 제공하지 않습니다.</p></details>
  </>
}

export default function ClinicalTimeline({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionInsights | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  useEffect(() => {
    let active = true
    void sessionInsights(sessionId).then(result => {
      if (active) { setData(result); setSelectedId(result.observations[0]?.id || '') }
    }).catch(cause => { if (active) setError(String(cause)) })
    return () => { active = false }
  }, [sessionId])
  async function decide(id: string, action: 'confirm' | 'correct' | 'reject') {
    setBusy(true); setError('')
    try {
      await api(`/observations/${id}/decision`, { method: 'POST', body: JSON.stringify({
        action, correctedResult: action === 'correct' ? corrections[id] || 'retry' : undefined, note: notes[id] || '',
      }) })
      setData(await sessionInsights(sessionId))
    } catch (cause) { setError(String(cause)) } finally { setBusy(false) }
  }
  const row = data?.observations.find(item => item.id === selectedId)
  return <section className="card"><h2>회기 관찰 타임라인</h2>
    <p>아동 음성 인식에는 오인식과 환경·기기 영향이 있습니다. AI 추정은 임상 진단이 아니며 치료사 확인 전에는 임상 근거가 아닙니다.</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">관찰을 불러오는 중입니다.</p>}
    {data && <>
      <p><strong>{SOURCE_LABELS[data.source]} 회기</strong> · 관찰 {data.summary.observedN}건 · 평가 가능 {data.summary.evaluableN}건 · 분모 제외 {data.summary.excludedN}건</p>
      <RoundTimeline rows={data.observations} selectedId={selectedId} onSelect={setSelectedId} />
      {data.observations.length === 0 && <p>관찰 자료가 없습니다.</p>}
      {row && <article className="card selected-observation" id="selected-observation">
        <ObservationEvidence row={row} />
        <label>검토 메모<input value={notes[row.id] || ''} maxLength={500} onChange={event => setNotes({ ...notes, [row.id]: event.target.value })} /></label>
        <label>교정 결과<select value={corrections[row.id] || 'retry'} onChange={event => setCorrections({ ...corrections, [row.id]: event.target.value })}>{['success', 'retry', 'uncertain', 'no_speech'].map(value => <option key={value} value={value}>{RESULT_LABELS[value]}</option>)}</select></label>
        <div><button disabled={busy} onClick={() => { void decide(row.id, 'confirm') }}>{row.source !== 'REAL' ? '연습 검토: 확인' : '확인'}</button>
          <button disabled={busy} onClick={() => { void decide(row.id, 'correct') }}>교정</button>
          <button disabled={busy || !notes[row.id]?.trim()} onClick={() => { void decide(row.id, 'reject') }}>사유를 기록하고 거부</button></div>
      </article>}
      <details><summary>라운드별 집계와 제외 기준</summary>
        <table><thead><tr><th>라운드</th><th>전체 관찰</th><th>평가 가능</th><th>분모 제외</th><th>확인된 성공</th></tr></thead><tbody>{data.rounds.map(round => <tr key={round.roundIndex}><td>{round.roundIndex}</td><td>{round.observedN}</td><td>{round.evaluableN}</td><td>{round.excludedN}</td><td>{insightRate(round)}</td></tr>)}</tbody></table>
        <ul>{data.limitations.map(item => <li key={item}>{item}</li>)}</ul>
      </details>
      <SessionNote text={data.note} />
    </>}
  </section>
}
