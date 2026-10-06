import type { CrossingAnalytics } from '../../api/therapist'
import RATIONALE from '../../../shared/daegu_crossing_rationale.json'
import { CUE_LABELS } from '../planning'
import CopyBox from './CopyBox'
import { homePracticeDraft, masteryWindow, percent, soapDraft } from './crossingAnalytics'
import type { CrossingGoal, CrossingSession } from './crossingAnalytics'

export type ProposalState =
  | { state: 'idle' } | { state: 'loading' } | { state: 'error' }
  | { state: 'ready'; suggestion: string; reasons: string[]; insufficient: boolean }

/** 앱에서 고를 수 있는 단서 종류(목표의 '선호 단서'). 순위가 아니라 종류다. */
const CUE_KINDS = ['auditory_model', 'visual_mouth', 'tactile_description', 'none'] as const
/** 게임 안의 단서 줄이기(근거 데이터의 라운드 단서): 1라운드 시범 → 2라운드 시범 없음 → 4라운드 그림 */
const FADING = [1, 2, 4].map(index => RATIONALE.rounds.find(round => round.index === index)!)
/** 단계 올리기 권장(근거 데이터 '조절 값'의 목표 단계) */
export const LEVEL_UP = RATIONALE.adjustable.find(entry => entry.name === '목표 단계')!.recommend

/**
 * 전문 정보: /ㅅ/ 발달 시기·오류 유형(근거 문서 출처), 단서, 다음 회기 제안(서버 계산), 가정 연습·회기 기록 초안.
 * 문구는 shared/daegu_crossing_rationale.json에서 온다(근거: docs/clinical/DAEGU_CROSSING_RATIONALE_2026-10-05.md).
 */
export default function ProfessionalInfo({ data, goal, session, proposal, onLoadProposal }: {
  data: CrossingAnalytics; goal: CrossingGoal | null; session: CrossingSession | null
  proposal: ProposalState; onLoadProposal: () => void
}) {
  const window = masteryWindow(data)
  const suggestion = proposal.state === 'ready' ? proposal.suggestion : null
  return <section className="ca-pro" aria-labelledby="ca-pro-title">
    <h3 id="ca-pro-title">전문 정보</h3>
    <div className="ca-pro-grid">
      <article>
        <h4>/ㅅ/ 발달 시기</h4>
        <p>{RATIONALE.development.text}</p>
        <p className="small">출처: {RATIONALE.development.sources.map((source, index) => <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></span>)}</p>
      </article>
      <article>
        <h4>흔한 오류와 자동 추정</h4>
        <table className="ca-error-table">
          <thead><tr><th scope="col">오류(예)</th><th scope="col">자동 추정에서</th></tr></thead>
          <tbody>{RATIONALE.errorTypes.map(error => <tr key={error.name}>
            <th scope="row">{error.name}<span className="small">{error.example}</span></th><td>{error.auto}</td>
          </tr>)}</tbody>
        </table>
      </article>
      <article>
        <h4>단서</h4>
        <p>앱에서 고를 수 있는 단서(목표 설정의 '선호 단서'):</p>
        <ul className="ca-chips">{CUE_KINDS.map(cue => <li key={cue} className={goal?.preferred_cue === cue ? 'current' : ''}>
          {cue === 'none' ? '단서 없음(혼자)' : CUE_LABELS[cue]}{goal?.preferred_cue === cue && <span className="small"> · 현재 목표</span>}
        </li>)}</ul>
        <p>게임 안의 단서 줄이기:</p>
        <ol className="ca-fading">{FADING.map(round => <li key={round.index}><strong>{round.index}라운드 {round.title}</strong> · {round.cue}</li>)}</ol>
        <p className="small">단서를 언제 얼마나 줄일지는 아동의 반응을 보고 치료사가 정합니다.</p>
      </article>
      <article>
        <h4>다음 회기 제안 <span className="small">서버 계산</span></h4>
        <p>숙달 표시(최근 실제 {data.mastery.consecutiveSessions}회기 각 {percent(data.mastery.threshold)} 이상): <strong>{data.mastery.met ? '기준 충족' : '아직 아님'}</strong>
          {window.length > 0 && <span className="small"> · 최근 실제 {window.length}회기 {window.map(item => percent(item.confirmedRate)).join(' → ')}</span>}</p>
        <p className="small">{LEVEL_UP} 목표는 자동으로 바뀌지 않고 치료사가 정합니다.</p>
        {proposal.state === 'ready' ? <div className="ca-proposal" role="status">
          {proposal.insufficient && <p className="notice">치료사가 확인한 실제 발화 자료가 부족합니다. 현재 목표를 유지하고 추가 관찰이 필요합니다.</p>}
          <p><strong>서버 제안:</strong> {proposal.suggestion}</p>
          {/* 서버 제안 문장에 이미 든 근거는 다시 적지 않는다. */}
          {proposal.reasons.some(reason => !proposal.suggestion.includes(reason)) && <ul>
            {proposal.reasons.filter(reason => !proposal.suggestion.includes(reason)).map(reason => <li key={reason}>{reason}</li>)}
          </ul>}
          <p className="small">계획 만들기·승인은 '다음 회기' 탭에서 합니다.</p>
        </div> : <>
          <button type="button" disabled={proposal.state === 'loading'} onClick={onLoadProposal}>{proposal.state === 'loading' ? '불러오는 중…' : '서버 제안 불러오기'}</button>
          {proposal.state === 'error' && <p role="alert">서버 제안을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.</p>}
        </>}
      </article>
    </div>
    <div className="ca-two-col">
      <CopyBox title="가정 연습 안내(초안)" text={homePracticeDraft(goal)} note={RATIONALE.homePractice.note} />
      <CopyBox title="회기 기록(SOAP) 초안" text={soapDraft(session, data, goal, suggestion)}
        note="고른 회기의 서버 집계 수치로 만든 초안입니다(LLM 미사용). S·A·P는 치료사가 씁니다. 회기를 바꾸거나 서버 제안을 불러오면 다시 만들어집니다." />
    </div>
  </section>
}
