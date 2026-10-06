import { useId } from 'react'
import { REASONS } from './crossingAnalytics'
import type { CrossingSession } from './crossingAnalytics'

const ROW = 42, LABEL = 168, BAR = 120, WIDTH = LABEL + BAR + 36

/**
 * 한 회기의 자동 추정 이유(서버 autoReasons)와 판단 보류. '의심'일 뿐 임상 판단이 아니다.
 * 보류·음질 불량·측정 누락은 실패 유형에 넣지 않는다(서버 규칙).
 */
export default function ReasonBars({ session }: { session: CrossingSession }) {
  const id = useId()
  const rows = [
    ...REASONS.map(reason => ({ key: reason.key as string, label: reason.label, note: reason.suspect, n: session.autoReasons[reason.key] })),
    { key: 'deferred', label: '판단 보류', note: '소리 작음·깨짐, 실패 아님', n: session.deferredN },
  ]
  const max = Math.max(1, ...rows.map(row => row.n))
  const height = rows.length * ROW + 6
  return <svg className="ca-bars" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
    <title id={`${id}-t`}>자동 추정 이유(의심)</title>
    <desc id={`${id}-d`}>{rows.map(row => `${row.label} ${row.n}건`).join(', ')}. 자동 추정은 음향 기준에 따른 의심이며 임상 판단이 아닙니다.</desc>
    {rows.map((row, index) => <g key={row.key} transform={`translate(0 ${index * ROW + 4})`}>
      <text className="ca-bar-label" x="0" y="14">{row.label}</text>
      <text className="ca-bar-note" x="0" y="30">{row.note}</text>
      <rect className="ca-bar-track" x={LABEL} y="6" width={BAR} height="18" rx="4" />
      {row.n > 0 && <rect className={`ca-bar ca-bar-${row.key}`} x={LABEL} y="6" width={Math.max(4, BAR * row.n / max)} height="18" rx="4" />}
      <text className="ca-bar-count" x={LABEL + BAR + 8} y="20">{row.n}</text>
    </g>)}
  </svg>
}
