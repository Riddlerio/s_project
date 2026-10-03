import { useEffect, useState } from 'react'
import { decideMagicBeam, getMagicBeamGrant, type SkillEvidence, type SkillStatus } from '../api/adventure'

const evidenceNames: Record<SkillEvidence, string> = { APP_OBSERVATION: '앱 관찰 검토', DIRECT_OBSERVATION: '치료실 직접 관찰' }

export function SkillGrantView({ status, busy, evidence, note, onEvidence, onNote, onDecision }: {
  status: SkillStatus | null; busy: boolean; evidence: SkillEvidence | ''; note: string
  onEvidence(value: SkillEvidence | ''): void; onNote(value: string): void; onDecision(action: 'grant' | 'revoke'): void
}) {
  return <section className="card" aria-label="매직빔 전투 스킬 승인">
    <h2>매직빔 전투 스킬</h2>
    <p>이 아동이 몬스터 모험(해변 낚시 데모)에서 선택할 수 있는 추가 공격입니다. 기본 공격으로도 같은 모험을 끝낼 수 있습니다.</p>
    <p className="small">연습 게임의 빛의 마법, 회기 계획 승인과 별도로 결정합니다. 점수·AI·게임 완료로 자동 승인되지 않습니다.</p>
    <p className="small">승인은 바로 쓸 수 있고, 철회는 아이가 진행 중인 라운드를 마친 뒤 다음 라운드부터 적용됩니다.</p>
    <p aria-live="polite">{status ? status.granted ? '현재 승인됨' : '현재 승인되지 않음' : '권한을 불러오는 중…'}</p>
    {status?.granted && <p className="small">승인자: {status.therapistName} · 승인 시각: {status.grantedAt ? new Date(status.grantedAt).toLocaleString('ko-KR') : '기록 없음'}</p>}
    <label>결정 근거<select value={evidence} onChange={event => onEvidence(event.target.value as SkillEvidence | '')} disabled={busy}>
      <option value="">근거 유형 선택</option><option value="APP_OBSERVATION">앱 관찰 검토</option><option value="DIRECT_OBSERVATION">치료실 직접 관찰</option>
    </select></label>
    <label>판단 메모<textarea value={note} onChange={event => onNote(event.target.value)} maxLength={500} disabled={busy} /></label>
    <button disabled={busy || !status || !evidence || status.granted} onClick={() => onDecision('grant')}>매직빔 승인</button>
    <button className="quiet" disabled={busy || !status?.granted || !evidence} onClick={() => onDecision('revoke')}>승인 철회</button>
    {!!status?.history.length && <details><summary>스킬 결정 이력</summary><ul>{status.history.map((row, index) => <li key={`${row.at}-${index}`}>
      {row.action === 'GRANT' ? '승인' : '철회'} · {row.therapistName} · {new Date(row.at).toLocaleString('ko-KR')} · {evidenceNames[row.evidenceKind]}{row.note && ` · ${row.note}`}
    </li>)}</ul></details>}
  </section>
}

export default function SkillGrantPanel({ childId }: { childId: string }) {
  const [status, setStatus] = useState<SkillStatus | null>(null)
  const [evidence, setEvidence] = useState<SkillEvidence | ''>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setStatus(null); setError(''); setEvidence(''); setNote('')
    void getMagicBeamGrant(childId).then(value => { if (active) setStatus(value) }).catch(cause => { if (active) setError(String(cause)) })
    return () => { active = false }
  }, [childId])
  async function decide(action: 'grant' | 'revoke') {
    if (!evidence || busy) return
    setBusy(true); setError('')
    try { setStatus(await decideMagicBeam(childId, action, { evidenceKind: evidence, note })); setNote('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '결정을 저장하지 못했습니다') }
    finally { setBusy(false) }
  }
  return <><SkillGrantView status={status} busy={busy} evidence={evidence} note={note} onEvidence={setEvidence} onNote={setNote} onDecision={action => { void decide(action) }} />
    {error && <p role="alert">{error}</p>}</>
}
