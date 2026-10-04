import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Link } from 'react-router-dom'

type Recommendation = { id: string; activity: string; clinical_purpose: string; reason: string; evidence: { observationId: string; sessionId: string }[]; confidence: string; status: string; selected_activity: string | null; decision_note: string }
const games = [
  { id: 'magic_beam', title: '빛의 마법' }, { id: 'sky_climb', title: '하늘 오르기' },
  { id: 'monster_adventure', title: '몬스터 모험' }, { id: 'conversation_quest', title: '두두와 소풍' },
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
      <p>관찰 목적: {row.clinical_purpose}</p><p>이유: {row.reason}</p><p>저장된 근거 링크: {row.evidence.length}건 · 확신도 {row.confidence}</p>
      <details><summary>활동 제안의 입력 · 적용 규칙 · 한계</summary>
        <p>입력: 생성 당시 실제·비샘플 회기의 확인·교정 관찰 후보 최대 10건. 저장된 링크는 최대 5건이며 전체 입력의 재현용 스냅숏은 아닙니다.</p>
        <ul>{row.evidence.map(item => <li key={item.observationId}><Link to={`/therapist/sessions/${item.sessionId}`}>근거 회기 열기</Link> · 관찰 {item.observationId}</li>)}</ul>
        <p>규칙(순서대로): SOUND 연속 발성 요약이 2건 이상이고 평균 1500ms 미만이면 빛의 마법, 단어·음절 평가 가능 자료가 2건 이상이고 성공이 절반 이하이면 몬스터 모험, 자발 발화 확인 자료가 없으면 두두와 소풍, 그 외에는 하늘 오르기를 제안합니다.</p>
        <p>한계: 발성 길이는 브라우저 보고값입니다. 기존 활동 제안은 음질 POOR를 별도로 거르지 않으므로 원 관찰의 품질과 조건을 검토하세요. 자료 없음은 0점이 아니며 효과나 적합성을 보장하지 않습니다. 수락·수정은 치료사가 선택합니다.</p>
      </details>
      {row.status === 'PENDING' ? <div><label>수정할 게임<select value={selected} onChange={event => setSelected(event.target.value)}>{games.map(game => <option key={game.id} value={game.id}>{game.title}</option>)}</select></label><label>결정 이유<input value={note} onChange={event => setNote(event.target.value)} maxLength={500} /></label><button onClick={() => { void decide(row.id, 'accept') }}>수락</button><button disabled={!note.trim()} onClick={() => { void decide(row.id, 'modify') }}>수정</button><button disabled={!note.trim()} onClick={() => { void decide(row.id, 'reject') }}>거부</button></div>
        : <p>적용 게임: {games.find(game => game.id === row.selected_activity)?.title || row.selected_activity || '없음'} · 결정 메모: {row.decision_note || '없음'}</p>}
    </article>)}
  </section>
}
