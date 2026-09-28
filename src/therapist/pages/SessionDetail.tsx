import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { feedback, sessionDetail } from '../../api/therapist'
import { getToken } from '../auth'
import ClinicalTimeline from '../ClinicalTimeline'

export default function SessionDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const token = getToken()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  async function load() { setData(await sessionDetail(id, token)) }
  useEffect(() => { if (!token) navigate('/therapist/login'); else void load().catch(cause => setError(String(cause))) }, [id, token, navigate])
  async function correct(utteranceId: string, action: string) {
    try { await feedback(utteranceId, { action, note: '' }, token); await load() }
    catch (cause) { setError(String(cause)) }
  }
  const v2 = Boolean(data?.session?.activityGame)
  return <main className="therapist-screen"><Link to="/therapist">← 아동 현황</Link><h1>세션 상세</h1>
    <p>{data?.session?.mode} · {data?.session?.status} · {data?.session?.isSeed ? '샘플 데이터' : '실제 진행'}</p>
    <p>목표 v{data?.goal?.version} · /{data?.goal?.target_phoneme}/ · {data?.goal?.level}</p>
    {error && <p role="alert">{error}</p>}
    {v2 ? <section className="card"><h2>게임 진행</h2><p>{data?.session?.activityGame} · 5라운드</p><p>게임 완료·별·XP는 임상 정확도 지표가 아닙니다. 아래 관찰 근거를 검토해 주세요.</p></section>
      : <section className="card"><h2>기존 모험 요약</h2><p>시도 {data?.metrics?.[0]?.attempts || 0} · 성공 {data?.metrics?.[0]?.successes || 0} · 재시도 {data?.metrics?.[0]?.retries || 0} · 힌트 {data?.metrics?.[0]?.hints || 0}</p><p>첫 시도 성공률 {data?.metrics?.[0]?.first_try_success_rate || 0}% · 소요 시간 {data?.session?.summary?.durationSec || 0}초</p></section>}
    {id && <ClinicalTimeline sessionId={id} />}
    {!v2 && <section className="card"><h2>기존 발화 기록</h2><p>점수는 ASR 기반 근사치이며 임상 진단이 아닙니다. DEMO 결과는 가상 입력입니다.</p><table><thead><tr><th>항목</th><th>시도</th><th>인식 결과</th><th>기초 분석</th><th>최종 결과</th><th>교정</th></tr></thead><tbody>{data?.utterances?.map((u: any) => <tr key={u.id}><td>{u.itemText} · {u.level}</td><td>{u.attemptIndex}</td><td>{u.transcript || '인식 없음'}</td><td>{u.analysis?.ai_result === 'uncertain' || u.analysis?.ai_result === 'no_speech' ? '평가 보류' : `${u.analysis?.ai_score} · ${u.analysis?.target_status}`}</td><td>{u.analysis?.final_result}{u.analysis?.therapist_override ? ' · 치료사 교정' : ''}</td><td><button onClick={() => { void correct(u.id, 'not_error') }}>오류 아님</button><button onClick={() => { void correct(u.id, 'allowed_at_stage') }}>현재 단계 허용</button></td></tr>)}</tbody></table></section>}
    <section className="card"><h2>이벤트 로그</h2><ol>{data?.events?.map((event: any) => <li key={event.id}>{event.type} · {event.therapist_text}</li>)}</ol></section>
    <section className="card"><h2>관찰 메모</h2>{data?.insight?.map((insight: string, i: number) => <p key={i}>{insight}</p>)}</section>
  </main>
}
