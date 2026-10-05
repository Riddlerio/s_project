import { Link } from 'react-router-dom'
import { ACTIVITY_LABELS, LEVEL_LABELS, POSITION_LABELS } from '../planning'
import { cueText, insightRate, SOURCE_LABELS } from '../insights'
import type { GoalTrend, GoalTrends } from '../insights'

export function GoalChart({ group }: { group: GoalTrend }) {
  const points = [...(group.baseline ? [group.baseline] : []), ...group.recent]
  const cues = [...new Set(points.flatMap(point => Object.keys(point.cueCounts)))].sort()
  const pointX = (index: number) => 65 + index * 95
  const height = 200 + cues.length * 28
  return <>
    <div className="insight-chart-scroll"><svg role="img" aria-label="회기별 확인된 성공 비율과 단서 유형별 건수. 아래 표에 동일한 수치가 있습니다." viewBox={`0 0 ${Math.max(320, points.length * 95 + 100)} ${height}`} className="goal-trend-svg">
      {[0, 50, 100].map(value => <g key={value}><line x1="50" x2={Math.max(290, points.length * 95 + 70)} y1={135 - value} y2={135 - value} stroke="#ccd8d0" /><text x="5" y={139 - value}>{value}%</text></g>)}
      {points.map((point, index) => <g key={point.sessionId}>
        {index > 0 && point.successRate !== null && points[index - 1].successRate !== null && <line x1={pointX(index - 1)} x2={pointX(index)} y1={135 - points[index - 1].successRate!} y2={135 - point.successRate} stroke="#34664e" strokeWidth="2" />}
        {point.successRate !== null ? <circle cx={pointX(index)} cy={135 - point.successRate} r="5" fill="#34664e"><title>{insightRate(point)}</title></circle> : <text x={pointX(index)} y="95" textAnchor="middle">자료 없음</text>}
        <text x={pointX(index)} y="158" textAnchor="middle">{index === 0 && group.baseline ? '기준선' : '최근'} {point.startedAt.slice(5, 10)}</text>
        {cues.map((cue, cueIndex) => <g key={cue}><rect x={pointX(index) - 20} y={183 + cueIndex * 28} width="40" height="21" rx="3" fill={point.cueCounts[cue] ? '#e3eee5' : '#f6f6f6'} /><text x={pointX(index)} y={198 + cueIndex * 28} textAnchor="middle">{point.cueCounts[cue] || 0}</text></g>)}
      </g>)}
      {cues.map((cue, index) => <text key={cue} x={Math.max(255, points.length * 95 + 30)} y={198 + index * 28}>{cue}</text>)}
    </svg></div>
    <table><caption>회기별 수치 · 단서 건수는 평가 가능 표본 기준</caption><thead><tr><th>회기</th><th>확인된 성공</th><th>분모 제외</th><th>단서 유형·단계</th></tr></thead><tbody>{points.map(point => <tr key={point.sessionId}><td><Link to={`/therapist/sessions/${point.sessionId}`}>{point === group.baseline ? '기준선 · ' : ''}{point.startedAt.slice(0, 10)}</Link></td><td>{insightRate(point)}</td><td>{point.excludedN}건</td><td>{cueText(point.cueCounts)}</td></tr>)}</tbody></table>
  </>
}

export default function GoalTrendChart({ data }: { data: GoalTrends | null }) {
  if (!data) return <p role="status">목표별 추이를 불러오는 중입니다.</p>
  return <section className="card"><h2>목표별 기준선 · 최근 회기</h2>
    <div className="insight-source-grid">{data.sources.map(source => <p key={source.source}><strong>{SOURCE_LABELS[source.source]}</strong><br />{source.sessionN}회기 · 관찰 {source.observationN}건{source.source !== 'REAL' && <small> · 임상 비교 제외</small>}</p>)}</div>
    <p>{data.baselineRule}</p><p>실제·비샘플·치료사 확인 자료만 비교합니다. 자료 없음은 0%가 아닙니다.</p>
    {data.groups.length === 0 && <p>비교할 실제 관찰 자료가 없습니다. DEMO·샘플은 실제 기준선으로 사용하지 않습니다.</p>}
    {data.groups.map(group => <article key={[group.targetPhoneme, group.wordPosition, group.level, group.activity].join(':')} className="insight-goal">
      <h3>/{group.targetPhoneme}/ · {POSITION_LABELS[group.wordPosition] || group.wordPosition} · {LEVEL_LABELS[group.level] || group.level} · {ACTIVITY_LABELS[group.activity as keyof typeof ACTIVITY_LABELS] || group.activity}</h3>
      <p>기준선 {group.baseline ? insightRate(group.baseline) : '자료 없음'} → 최근 {insightRate(group.recentSummary)}{group.delta !== null && ` · ${group.delta > 0 ? '+' : ''}${group.delta}%p`}</p>
      {group.baseline || group.recent.length ? <GoalChart group={group} /> : <p>평가 가능한 확인 자료가 없습니다.</p>}
      <p className="muted">단서 유형은 숫자 순위로 환산하지 않습니다. 조건·표본 수가 다른 회기의 차이를 치료 효과로 단정하지 마세요.</p>
    </article>)}
    <details><summary>집계 규칙과 해석 한계</summary><ul>{data.limitations.map(item => <li key={item}>{item}</li>)}</ul></details>
  </section>
}
