import { useEffect, useState } from 'react'
import { childConversationInsights, gameChildConversationInsights } from '../api/therapist'
import type { ConversationInsightsData } from '../api/therapist'
import { SOURCE_LABELS } from './insights'

export function ConversationSessionList({ data }: { data: ConversationInsightsData }) {
  return <>
    <p>{data.limitation}</p>
    {!data.sessions.length && <p>대화 기록이 없습니다.</p>}
    {data.sessions.map(session => <article className="card" key={session.sessionId}>
      <h3>{new Date(session.startedAt).toLocaleString()} · {SOURCE_LABELS[session.source]} 대화</h3>
      <p><strong>대화 중 목표 낱말 시도 {session.targetObservedN}회</strong></p>
      <p>완료된 대화 턴 {session.completedTurnN}회 · 불확실 {session.uncertainN}회 · 무발화 {session.noSpeechN}회</p>
      {session.source !== 'REAL' && <p className="notice">실제 임상 비교에서 제외되는 연습 자료입니다.</p>}
    </article>)}
  </>
}

type Props = { childId: string; sessionId?: never } | { sessionId: string; childId?: never }
export default function ConversationInsights({ childId, sessionId }: Props) {
  const [data, setData] = useState<ConversationInsightsData | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setData(null); setError('')
    const request = childId !== undefined ? childConversationInsights(childId) : gameChildConversationInsights(sessionId!)
    void request.then(value => { if (active) setData(value) }).catch(cause => { if (active) setError(String(cause)) })
    return () => { active = false }
  }, [childId, sessionId])
  return <section className="card"><h2>아동의 대화 회기 기록</h2>
    <p>게임 회기와 구분하여 보는 읽기 전용 기록입니다.</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">대화 기록을 불러오는 중입니다.</p>}
    {data && <ConversationSessionList data={data} />}
  </section>
}
