import { useId } from 'react'
import type { CrossingAnalytics } from '../../api/therapist'
import { shortDate } from './crossingAnalytics'
import { chartColumns, TREND_MAX_SESSIONS } from './TrendChart'

const TOP = 22, PLOT = 90, BOTTOM = 28
const MIN_BPM = 70, MAX_BPM = 100

/**
 * 회기를 시작할 때의 박자(서버 runtime_state.rhythm 스냅숏). 회기 안에서 바뀐 빠르기는 저장하지 않는다(설계).
 * 속이 찬 점은 '잘하면 빨라지기 켬', 빈 점은 '끔'이다. 가로 위치는 확인 비율 그래프와 같다.
 */
export default function TempoChart({ data }: { data: CrossingAnalytics }) {
  const id = useId()
  const sessions = data.sessions.slice(-TREND_MAX_SESSIONS)
  const { left, right, width, x } = chartColumns(sessions.length)
  const height = TOP + PLOT + BOTTOM
  const y = (bpm: number) => TOP + PLOT * (1 - (Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) - MIN_BPM) / (MAX_BPM - MIN_BPM))
  const known = sessions.map((session, index) => ({ index, rhythm: session.rhythm })).filter(item => item.rhythm)
  const summary = known.length
    ? known.map(item => `${shortDate(sessions[item.index].startedAt)} ${item.rhythm!.startBpm}BPM(빨라지기 ${item.rhythm!.allowFaster ? '켬' : '끔'})`).join(', ')
    : '박자 기록이 있는 회기가 없습니다'
  return <div className="ca-chart-scroll" tabIndex={0} role="region" aria-label="시작 박자 그래프(옆으로 넘겨 보기)">
    <svg className="ca-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
      <title id={`${id}-t`}>회기별 시작 박자</title>
      <desc id={`${id}-d`}>{summary}. 회기 안에서 바뀐 빠르기는 저장하지 않습니다.</desc>
      {[76, 84, 92, 100].map(bpm => <g key={bpm}>
        <line className="ca-grid" x1={left} x2={width - right} y1={y(bpm)} y2={y(bpm)} />
        <text className="ca-axis" x={left - 8} y={y(bpm) + 4} textAnchor="end">{bpm}</text>
      </g>)}
      <text className="ca-axis ca-axis-muted" x={width - right + 8} y={y(100) + 4}>BPM</text>
      {known.slice(1).map((item, order) => <line key={item.index} className="ca-line ca-line-tempo" x1={x(known[order].index)} y1={y(known[order].rhythm!.startBpm)} x2={x(item.index)} y2={y(item.rhythm!.startBpm)} />)}
      {sessions.map((session, index) => <g key={session.sessionId}>
        {session.rhythm
          ? <circle className={session.rhythm.allowFaster ? 'ca-tempo ca-tempo-faster' : 'ca-tempo'} cx={x(index)} cy={y(session.rhythm.startBpm)} r="6" />
          : <text className="ca-axis ca-axis-muted" x={x(index)} y={TOP + PLOT - 4} textAnchor="middle">기록 없음</text>}
        <text className="ca-axis" x={x(index)} y={TOP + PLOT + 20} textAnchor="middle">{shortDate(session.startedAt)}</text>
      </g>)}
    </svg>
  </div>
}
