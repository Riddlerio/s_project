import { useEffect, useState } from 'react'
import { api } from '../api/client'

type Recommendation = { id: string; activity: string; clinical_purpose: string; reason: string; evidence: { observationId: string; sessionId: string }[]; confidence: string; status: string; selected_activity: string | null; decision_note: string }
const games = [
  { id: 'magic_beam', title: '빛의 마법' }, { id: 'sky_climb', title: '하늘 오르기' },
  { id: 'monster_adventure', title: '몬스터 모험' }, { id: 'conversation_quest', title: '호야와 소풍' },
]

export default function ActivityRecommendationPanel({ childId }: { childId: string }) {
  const [rows, setRows] = useState<Recommendation[]>([])
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState('magic_beam')
  async function load() { setRows(await api<Recommendation[]>(`/children/${childId}/activity-recommendations`)) }
  useEffect(() => { void load().catch(cause => setMessage(String(cause))) }, [childId])
  async function generate() {
    try {
      const result = await api<{ status: string }>(`/children/${childId}/activity-recommendations`, { method: 'POST' })
      setMessage(result.status === 'INSUFFICIENT_DATA' ? '치료사가 확인한 실제 발화 자료가 부족합니다.' : '제안을 만들었습니다. 적용 전 검토해 주세요.')
      await load()
    } catch (cause) { setMessage(String(cause)) }
  }
  async function decide(id: string, action: 'accept' | 'modify' | 'reject') {
    try {
      await api(`/activity-recommendations/${id}/decision`, { method: 'POST', body: JSON.stringify({ action, modifiedGame: action === 'modify' ? selected : undefined, note }) })
      setMessage('치료사 결정을 저장했습니다.')
      setNote('')
      await load()
    } catch (cause) { setMessage(String(cause)) }
  }
  return <section className="card"><h2>다음 활동 제안</h2><p>치료사가 확인한 실제 발화 근거에서만 제안을 만듭니다. 수락 또는 수정 후 아동 화면에 반영됩니다.</p>
    <button onClick={() => { void generate() }}>근거로 제안 만들기</button>{message && <p role="status">{message}</p>}
    {rows.map(row => <article key={row.id}><h3>{games.find(game => game.id === row.activity)?.title || row.activity} · {row.status}</h3>
      <p>관찰 목적: {row.clinical_purpose}</p><p>이유: {row.reason}</p><p>근거: {row.evidence.length}건 · 확신도 {row.confidence}</p>
      {row.status === 'PENDING' ? <div><label>수정할 게임<select value={selected} onChange={event => setSelected(event.target.value)}>{games.map(game => <option key={game.id} value={game.id}>{game.title}</option>)}</select></label><label>결정 이유<input value={note} onChange={event => setNote(event.target.value)} maxLength={500} /></label><button onClick={() => { void decide(row.id, 'accept') }}>수락</button><button disabled={!note.trim()} onClick={() => { void decide(row.id, 'modify') }}>수정</button><button disabled={!note.trim()} onClick={() => { void decide(row.id, 'reject') }}>거부</button></div>
        : <p>적용 게임: {row.selected_activity || '없음'} · 결정 메모: {row.decision_note || '없음'}</p>}
    </article>)}
  </section>
}
