import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sessionPlanProposal } from '../../api/therapist'
import { formatDate } from '../formatTime'
import ProfessionalInfo, { LEVEL_UP } from './ProfessionalInfo'
import type { ProposalState } from './ProfessionalInfo'
import ReasonBars from './ReasonBars'
import TempoChart from './TempoChart'
import TrendChart from './TrendChart'
import { childCrossingAnalyticsWithProbe, isReal, LEVEL_TEXT, levelTotals, masteryWindow, percent, realSessions, sessionLabel, SOURCE_TEXT } from './crossingAnalytics'
import type { CrossingAnalytics, CrossingGoal, CrossingSession } from './crossingAnalytics'
import './analytics.css'

type ViewProps = {
  data: CrossingAnalytics; goal: CrossingGoal | null; selectedId: string | null; onSelect: (sessionId: string) => void
  proposal: ProposalState; onLoadProposal: () => void
}

function MasteryDots({ data }: { data: CrossingAnalytics }) {
  const window = masteryWindow(data)
  const slots = Array.from({ length: data.mastery.consecutiveSessions }, (_, index) => window[window.length - data.mastery.consecutiveSessions + index] ?? null)
  return <span className="ca-dots" aria-hidden="true">{slots.map((session, index) => <span key={index} className={
    !session || session.confirmedRate === null ? 'ca-dot empty' : session.confirmedRate >= data.mastery.threshold ? 'ca-dot met' : 'ca-dot'} />)}</span>
}

function LevelPositionTable({ sessions, goalLevel }: { sessions: CrossingSession[]; goalLevel?: string }) {
  const totals = levelTotals(sessions)
  return <table className="ca-level-table">
    <caption>{sessions.length ? `최근 실제 ${sessions.length}회기 · 치료사 확인 기록(확인 성공/확인)` : '실제 회기의 치료사 확인 기록이 아직 없습니다(DEMO·샘플은 비교 제외)'}</caption>
    <thead><tr><th scope="col">단계</th><th scope="col">어두</th><th scope="col">어중</th><th scope="col">어말</th></tr></thead>
    <tbody>{(['syllable', 'word'] as const).map(level => {
      const row = totals[level]
      return <tr key={level} className={goalLevel === level ? 'current' : ''}>
        <th scope="row">{LEVEL_TEXT[level]}{goalLevel === level && <span className="small"> · 현재 목표</span>}</th>
        <td>{row.reviewedN ? <><strong>{percent(row.confirmedSuccessN / row.reviewedN)}</strong> <span className="small">{row.confirmedSuccessN}/{row.reviewedN}</span></> : <span className="small">확인 자료 없음</span>}</td>
        <td className="small">다루지 않음</td><td className="small">다루지 않음</td>
      </tr>
    })}</tbody>
  </table>
}

function ConfirmedLine({ session }: { session: CrossingSession }) {
  if (!isReal(session)) return <p className="small">{SOURCE_TEXT[session.source]} 회기라 확인 비율과 숙달 계산에서 뺍니다.</p>
  if (!session.reviewedN) return <p className="small">치료사가 확인한 평가 가능 기록이 아직 없습니다. <Link to={`/therapist/sessions/${session.sessionId}`}>회기 화면에서 확인·교정하기</Link></p>
  return <p><strong>치료사 확인</strong> {session.reviewedN}건 중 성공 {session.confirmedSuccessN}건({percent(session.confirmedRate)}) · <Link to={`/therapist/sessions/${session.sessionId}`}>회기 자세히 보기</Link></p>
}

/** 대구대 건너기 분석(읽기 전용). 수치는 서버 집계만 쓰고 화면은 다시 판정하지 않는다. */
export function CrossingAnalyticsView({ data, goal, selectedId, onSelect, proposal, onLoadProposal }: ViewProps) {
  const sessions = data.sessions
  const real = realSessions(data)
  const excludedN = sessions.length - real.length
  const latestReal = real[real.length - 1] ?? null
  const latest = sessions[sessions.length - 1] ?? null
  const selected = sessions.find(session => session.sessionId === selectedId) ?? latest
  const window = masteryWindow(data)
  return <section className="card crossing-analytics" aria-labelledby="ca-title">
    <div className="crossing-panel-heading"><h2 id="ca-title">대구대 건너기 분석</h2><span className="crossing-setting-badge">읽기 전용 · 서버 집계</span></div>
    <p>확인 비율과 숙달 표시는 치료사가 확인·교정한 <strong>실제 회기</strong> 기록만 씁니다. 자동 추정은 '의심'이고 임상 판단이 아닙니다. <strong>회기 간 변화는 치료 효과의 증명이 아닙니다.</strong></p>
    <p className="small">연습하지 않은 낱말로 일반화를 보는 값이며, 치료사가 확인한 기록만 셉니다</p>
    {!latest ? <p className="ca-empty-state">대구대 건너기 기록이 아직 없습니다. 아동 화면에서 게임을 하면 여기에 쌓입니다.</p> : <>
      <dl className="ca-summary">
        <div><dt>실제 회기</dt><dd><strong>{real.length}회</strong>
          <span className="small">{excludedN ? `DEMO·샘플 ${excludedN}회는 비교 제외` : '비교에서 뺀 회기 없음'}</span></dd></div>
        <div><dt>최근 실제 회기 확인 비율(연습)</dt><dd><strong>{latestReal ? percent(latestReal.confirmedRate) : '자료 없음'}</strong>
          <span className="small">{latestReal ? `${formatDate(latestReal.startedAt)} · 확인 ${latestReal.reviewedN}건` : '실제 회기가 아직 없습니다'}</span></dd></div>
        <div><dt>새 낱말 확인 비율</dt><dd><strong>{latestReal ? percent(latestReal.probe?.confirmedRate) : '자료 없음'}</strong>
          <span className="small">{latestReal ? `${formatDate(latestReal.startedAt)} · 확인 ${latestReal.probe?.reviewedN ?? 0}건 · 피드백 없음` : '실제 회기가 아직 없습니다'}</span></dd></div>
        <div><dt>숙달 표시 · 제품 규칙</dt><dd><strong>{data.mastery.met ? '기준 충족' : '아직 아님'} <MasteryDots data={data} /></strong>
          <span className="small">최근 실제 {data.mastery.consecutiveSessions}회기 각 {percent(data.mastery.threshold)} 이상{window.length ? ` · ${window.map(item => percent(item.confirmedRate)).join(' → ')}` : ''}</span></dd></div>
        <div><dt>최근 시작 박자</dt><dd><strong>{latest.rhythm ? `${latest.rhythm.startBpm} BPM` : '기록 없음'}</strong>
          <span className="small">{latest.rhythm ? `잘하면 빨라지기 ${latest.rhythm.allowFaster ? '켬' : '끔'}` : '박자 스냅숏이 없는 회기'}</span></dd></div>
      </dl>

      <h3>회기별 연습·새 낱말 확인 비율</h3>
      <p className="small">새 낱말 확인은 연습·숙달 집계에서 따로 셉니다. DEMO·샘플은 비교에서 제외하며 불확실·무발화·목표 관찰·음질 불량은 분모에서 뺍니다. 확인 자료가 없으면 ‘자료 없음’으로 표시합니다.</p>
      <TrendChart data={data} />
      <p className="small ca-scroll-hint" aria-hidden="true">← 그래프는 옆으로 넘겨 볼 수 있습니다 →</p>
      <p className="small ca-legend"><span className="ca-key ca-key-point" aria-hidden="true" /> 실제 회기 연습 확인 비율 <span className="ca-key ca-key-probe" aria-hidden="true" /> 새 낱말 확인 비율(피드백 없음) <span className="ca-key ca-key-threshold" aria-hidden="true" /> 연습 숙달선 <span className="ca-key ca-key-window" aria-hidden="true" /> 숙달 판단 범위(최근 실제 {data.mastery.consecutiveSessions}회기) <span className="ca-key ca-key-excluded" aria-hidden="true" /> DEMO·샘플(비교 제외)</p>

      <div className="ca-two-col">
        <section aria-labelledby="ca-level-title">
          <h3 id="ca-level-title">단계 × 위치</h3>
          <LevelPositionTable sessions={window} goalLevel={goal?.level} />
          <p className="small">건너기 낱말은 모두 첫소리(어두) /ㅅ/라 위치별로 나누지 않습니다. '시소'의 둘째 /ㅅ/(어중)는 5라운드에서 미리 봅니다. 단계 올리기 권장: {LEVEL_UP}</p>
        </section>
        <section aria-labelledby="ca-reason-title">
          <h3 id="ca-reason-title">오류 유형(자동 추정 · 의심)</h3>
          {selected && <>
            <label className="ca-session-select">회기 고르기
              <select value={selected.sessionId} onChange={event => onSelect(event.target.value)}>
                {[...sessions].reverse().map(session => <option key={session.sessionId} value={session.sessionId}>{sessionLabel(session)} · 시도 {session.attemptN}</option>)}
              </select>
            </label>
            <ReasonBars session={selected} />
            <ConfirmedLine session={selected} />
          </>}
          <p className="small">자동 추정은 음향 기준에 따른 의심입니다. 혀 위치 오류(치간음화·측음화)는 가르지 못하므로 치료사가 듣고 확인합니다.</p>
        </section>
      </div>

      <h3>시작 박자</h3>
      <TempoChart data={data} />
      <p className="small"><span className="ca-key ca-key-faster" aria-hidden="true" /> 잘하면 빨라지기 켬 <span className="ca-key ca-key-steady" aria-hidden="true" /> 끔 · 회기 안에서 바뀐 빠르기(끝 박자)는 저장하지 않습니다(설계). 다음 게임의 시작 박자는 '치료 목표' 탭에서 정합니다.</p>

      <details className="ca-table-details">
        <summary>회기별 수치 표({sessions.length}회기)</summary>
        <table className="ca-session-table">
          <thead><tr><th scope="col">회기</th><th scope="col">연습 확인 비율</th><th scope="col">새 낱말 확인 비율</th><th scope="col">연습 시도·보류</th><th scope="col">시작 박자</th></tr></thead>
          <tbody>{[...sessions].reverse().map(session => <tr key={session.sessionId}>
            <th scope="row"><Link to={`/therapist/sessions/${session.sessionId}`}>{formatDate(session.startedAt)}</Link> <span className="small">{SOURCE_TEXT[session.source]}</span></th>
            <td>{isReal(session) ? <>{percent(session.confirmedRate)} <span className="small">{session.confirmedSuccessN}/{session.reviewedN}</span></> : <span className="small">비교 제외</span>}</td>
            <td>{isReal(session) ? <>{percent(session.probe?.confirmedRate)} <span className="small">{session.probe?.confirmedSuccessN ?? 0}/{session.probe?.reviewedN ?? 0}</span></> : <span className="small">비교 제외</span>}</td>
            <td>{session.attemptN} · {session.deferredN}</td>
            <td>{session.rhythm ? `${session.rhythm.startBpm}${session.rhythm.allowFaster ? '↑' : ''}` : '—'}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </>}

    <ProfessionalInfo data={data} goal={goal} session={selected} proposal={proposal} onLoadProposal={onLoadProposal} />

    <details>
      <summary>집계 규칙과 해석 한계(서버)</summary>
      <ul>{data.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </details>
  </section>
}

function ChildCrossingAnalytics({ childId, goal }: { childId: string; goal: CrossingGoal | null }) {
  const [data, setData] = useState<CrossingAnalytics | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [proposal, setProposal] = useState<ProposalState>({ state: 'idle' })
  useEffect(() => {
    let active = true
    setError('')
    void childCrossingAnalyticsWithProbe(childId).then(result => { if (active) setData(result) })
      .catch(() => { if (active) setError('건너기 분석 자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.') })
    return () => { active = false }
  }, [childId, reload])
  async function loadProposal() {
    setProposal({ state: 'loading' })
    try {
      const result = await sessionPlanProposal(childId)
      setProposal({ state: 'ready', suggestion: result.summary.nextSessionSuggestion,
        reasons: result.proposal.rationale.map(reason => reason.text), insufficient: result.status === 'INSUFFICIENT_DATA' })
    } catch { setProposal({ state: 'error' }) }
  }
  if (!data) return <section className="card crossing-analytics" aria-label="대구대 건너기 분석">
    <h2>대구대 건너기 분석</h2>
    {error ? <div role="alert"><p>{error}</p><button type="button" className="quiet" onClick={() => setReload(value => value + 1)}>다시 불러오기</button></div>
      : <p role="status">건너기 분석을 불러오는 중입니다.</p>}
  </section>
  return <CrossingAnalyticsView data={data} goal={goal} selectedId={selectedId} onSelect={setSelectedId}
    proposal={proposal} onLoadProposal={() => { void loadProposal() }} />
}

/** 아동을 바꾸면 자료·선택·서버 제안을 모두 새로 시작한다(이전 아동 자료가 보이지 않게). */
export default function CrossingAnalyticsPanel({ childId, goal }: { childId: string; goal: CrossingGoal | null }) {
  return <ChildCrossingAnalytics key={childId} childId={childId} goal={goal} />
}
