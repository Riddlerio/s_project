import { useId } from 'react'
import { isReal, masteryWindow, percent, shortDate, SOURCE_SHORT } from './crossingAnalytics'
import type { CrossingAnalytics } from './crossingAnalytics'

/** 그래프에는 최근 12회기까지 그린다. 전체는 아래 표에 있다. */
export const TREND_MAX_SESSIONS = 12
/** 두 그래프(확인 비율·시작 박자)가 같은 회기를 같은 가로 위치에 놓도록 칸 너비를 함께 쓴다. 회기가 적으면 칸을 넓힌다. */
export function chartColumns(count: number) {
  const step = count <= 3 ? 130 : count <= 6 ? 100 : count <= 9 ? 84 : 72
  const left = 46, right = 88
  return { left, right, step, width: left + right + Math.max(count, 3) * step, x: (index: number) => left + step * (index + .5) }
}

const TOP = 30, PLOT = 150, BOTTOM = 46

/** 회기별 치료사 확인 비율(실제 회기만)과 숙달선. DEMO·샘플 회기는 자리만 보이고 비율을 그리지 않는다. */
export default function TrendChart({ data }: { data: CrossingAnalytics }) {
  const id = useId()
  const sessions = data.sessions.slice(-TREND_MAX_SESSIONS)
  const { left, right, step, width, x } = chartColumns(sessions.length)
  const height = TOP + PLOT + BOTTOM
  const y = (rate: number) => TOP + PLOT * (1 - rate)
  const threshold = data.mastery.threshold
  const window = new Set(masteryWindow(data).map(session => session.sessionId))
  const windowIndexes = sessions.map((session, index) => window.has(session.sessionId) ? index : -1).filter(index => index >= 0)
  // 실제 회기끼리만 잇는다. 확인 자료가 없는 실제 회기가 끼면 선을 끊는다.
  const segments: [number, number, number, number][] = []
  let previous: { index: number; rate: number } | null = null
  sessions.forEach((session, index) => {
    if (!isReal(session)) return
    if (session.confirmedRate === null) { previous = null; return }
    if (previous) segments.push([previous.index, previous.rate, index, session.confirmedRate])
    previous = { index, rate: session.confirmedRate }
  })
  const plotted = sessions.filter(session => isReal(session) && session.confirmedRate !== null)
  const probePlotted = sessions.filter(session => isReal(session) && session.probe?.confirmedRate != null)
  const probeSegments: [number, number, number, number][] = []
  previous = null
  sessions.forEach((session, index) => {
    if (!isReal(session)) return
    const rate = session.probe?.confirmedRate
    if (rate == null) { previous = null; return }
    if (previous) probeSegments.push([previous.index, previous.rate, index, rate])
    previous = { index, rate }
  })
  const summary = plotted.length
    ? `실제 회기 ${plotted.length}개의 확인 비율: ${plotted.map(session => `${shortDate(session.startedAt)} ${percent(session.confirmedRate)}`).join(', ')}. 숙달선 ${percent(threshold)}.`
    : '치료사가 확인한 실제 회기 자료가 아직 없습니다.'
  const probeSummary = probePlotted.length
    ? `새 낱말 확인 비율: ${probePlotted.map(session => `${shortDate(session.startedAt)} ${percent(session.probe?.confirmedRate)}`).join(', ')}.`
    : '새 낱말 확인 비율: 치료사가 확인한 실제 회기 자료가 아직 없습니다.'
  return <div className="ca-chart-scroll" tabIndex={0} role="region" aria-label="확인 비율 추이 그래프(옆으로 넘겨 보기)">
    <svg className="ca-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
      <title id={`${id}-t`}>회기별 치료사 확인 비율 · 연습과 새 낱말</title>
      <desc id={`${id}-d`}>{summary} {probeSummary} DEMO·샘플 회기는 비교에서 뺍니다. 숙달선은 연습 비율에만 적용합니다.</desc>
      {windowIndexes.length > 0 && <g>
        <rect className="ca-window" x={x(windowIndexes[0]) - step / 2 + 3} y={TOP - 24} width={x(windowIndexes[windowIndexes.length - 1]) - x(windowIndexes[0]) + step - 6} height={PLOT + 24} rx="8" />
        <text className="ca-window-label" x={x(windowIndexes[0]) - step / 2 + 10} y={TOP - 10}>숙달 판단 범위{data.mastery.met ? ' · 기준 충족' : ''}</text>
      </g>}
      {[0, .5, 1].map(value => <g key={value}>
        <line className="ca-grid" x1={left} x2={width - right} y1={y(value)} y2={y(value)} />
        <text className="ca-axis" x={left - 8} y={y(value) + 4} textAnchor="end">{percent(value)}</text>
      </g>)}
      <line className="ca-threshold" x1={left} x2={width - right} y1={y(threshold)} y2={y(threshold)} />
      <text className="ca-threshold-label" x={width - right + 8} y={y(threshold) + 4}>숙달선 {percent(threshold)}</text>
      {segments.map(([from, fromRate, to, toRate]) => <line key={`${from}-${to}`} className="ca-line" x1={x(from)} y1={y(fromRate)} x2={x(to)} y2={y(toRate)} />)}
      {probeSegments.map(([from, fromRate, to, toRate]) => <line key={`probe-${from}-${to}`} className="ca-probe-line" x1={x(from) + 10} y1={y(fromRate)} x2={x(to) + 10} y2={y(toRate)} />)}
      {sessions.map((session, index) => <g key={session.sessionId}>
        {!isReal(session) && <line className="ca-excluded" x1={x(index)} x2={x(index)} y1={TOP} y2={TOP + PLOT} />}
        {isReal(session) && session.confirmedRate !== null && <>
          <circle className="ca-point" cx={x(index)} cy={y(session.confirmedRate)} r="6" />
          <text className="ca-value" x={x(index)} y={y(session.confirmedRate) - 11} textAnchor="middle">{percent(session.confirmedRate)}</text>
        </>}
        {isReal(session) && session.probe?.confirmedRate != null && <>
          <rect className="ca-probe-point" x={x(index) + 5} y={y(session.probe.confirmedRate) - 5} width="10" height="10" transform={`rotate(45 ${x(index) + 10} ${y(session.probe.confirmedRate)})`} />
          <text className="ca-probe-value" x={x(index) + 22} y={y(session.probe.confirmedRate) + 4}>{percent(session.probe.confirmedRate)}</text>
        </>}
        <text className="ca-axis" x={x(index)} y={TOP + PLOT + 18} textAnchor="middle">{shortDate(session.startedAt)}</text>
        <text className={isReal(session) ? 'ca-axis' : 'ca-axis ca-axis-muted'} x={x(index)} y={TOP + PLOT + 34} textAnchor="middle">
          {!isReal(session) ? `${SOURCE_SHORT[session.source]} 제외` : session.reviewedN ? `확인 ${session.reviewedN}` : '확인 전'}
        </text>
      </g>)}
      {plotted.length === 0 && probePlotted.length === 0 && <text className="ca-empty" x={left + (width - left - right) / 2} y={TOP + PLOT / 2} textAnchor="middle">확인한 실제 회기 자료가 아직 없습니다</text>}
    </svg>
  </div>
}
