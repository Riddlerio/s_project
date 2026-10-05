import { useEffect, useState } from 'react'
import { CUE_LABELS, LEVEL_LABELS, POSITION_LABELS, parseWords } from '../planning'
import { GOAL_SOURCE_LABELS } from '../clinicalLabels'

// 서버 GoalInput(snake_case)과 같은 필드. 목표 저장은 새 버전을 만든다(기존 버전 구조 유지).
export interface GoalRow { version: number; target_phoneme: string; target_sound: string; word_position: string; level: string; min_level: string; session_duration_min: number; repetition_target: number; priority: string; preferred_cue: string; excluded_words: string[]; excluded_games: string[]; priority_targets: string[]; note: string; source: string }

const EDITABLE = ['target_phoneme', 'target_sound', 'word_position', 'level', 'min_level', 'session_duration_min', 'repetition_target', 'priority', 'preferred_cue', 'excluded_words', 'excluded_games', 'priority_targets', 'note'] as const

export default function GoalPanel({ goal, history, onSave }: { goal: GoalRow | null; history: GoalRow[]; onSave: (values: Record<string, unknown>) => Promise<void> }) {
  const [draft, setDraft] = useState<GoalRow | null>(goal)
  useEffect(() => setDraft(goal), [goal])
  if (!draft) return <section className="card"><h2>치료 목표</h2><p>현재 목표가 없습니다.</p></section>
  const set = (key: keyof GoalRow, value: unknown) => setDraft({ ...draft, [key]: value })
  const save = () => onSave(Object.fromEntries(EDITABLE.map(key => [key, draft[key]])))
  return <section className="card"><h2>치료 목표 v{goal?.version}</h2>
    <p>현재 이 아동이 장기적으로 훈련 중인 목표입니다. 저장하면 새 버전이 되고 다음 회기부터 적용됩니다.</p>
    <div className="form-grid">
      <label>목표 음소 <select value={draft.target_phoneme} onChange={event => set('target_phoneme', event.target.value)}>{['ㅅ', 'ㅈ', 'ㄹ'].map(value => <option key={value} value={value}>/{value}/</option>)}</select></label>
      <label>위치 <select value={draft.word_position} onChange={event => set('word_position', event.target.value)}>{Object.entries(POSITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>목표 단계 <select value={draft.level} onChange={event => set('level', event.target.value)}>{['syllable', 'word', 'short_sentence'].map(value => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}</select></label>
      <label>최소 단계 <select value={draft.min_level} onChange={event => set('min_level', event.target.value)}>{['phoneme', 'syllable', 'word', 'short_sentence'].map(value => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}</select></label>
      <label>선호 단서 <select value={draft.preferred_cue} onChange={event => set('preferred_cue', event.target.value)}>{Object.entries(CUE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>목표 시도 횟수 <input type="number" min={10} max={60} value={draft.repetition_target} onChange={event => set('repetition_target', Number(event.target.value))} /></label>
      <label>세션 시간 <select value={draft.session_duration_min} onChange={event => set('session_duration_min', Number(event.target.value))}>{[5, 10, 15].map(value => <option key={value} value={value}>{value}분</option>)}</select></label>
      <label>우선 단어(쉼표로 구분) <input defaultValue={draft.priority_targets.join(', ')} key={`p-${draft.version}`} onBlur={event => set('priority_targets', parseWords(event.target.value))} /></label>
      <label>제외 단어(쉼표로 구분) <input defaultValue={draft.excluded_words.join(', ')} key={`e-${draft.version}`} onBlur={event => set('excluded_words', parseWords(event.target.value))} /></label>
    </div>
    <button onClick={() => { void save() }}>새 버전으로 목표 저장</button>
    <details><summary>목표 이력 {history.length}개</summary><ul>{history.map(row => <li key={row.version}>v{row.version} · /{row.target_phoneme}/ {LEVEL_LABELS[row.level] || row.level} · {GOAL_SOURCE_LABELS[row.source] || row.source}</li>)}</ul></details>
  </section>
}
