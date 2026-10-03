import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SessionPoint } from '../../shared/types'
import { sessionSourceText } from '../clinicalLabels'

/** x축 라벨에 회기 출처(실제·DEMO·샘플)를 붙인다. 계산은 바꾸지 않고 섞인 자료를 눈에 보이게만 한다. */
export const chartPoints = (sessions: SessionPoint[]) => sessions.map(session => ({ ...session, label: `${session.index} ${sessionSourceText(session)}` }))

export default function SessionTrendChart({ sessions }: { sessions: SessionPoint[] }) {
  if (!sessions.length) return null
  const points = chartPoints(sessions)
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height={290}><LineChart data={points}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis domain={[0, 100]} unit="%" /><Tooltip /><Legend /><Line type="monotone" name="첫 시도 성공률" dataKey="firstTrySuccessRate" stroke="#6046c8" strokeWidth={3} /><Line type="monotone" name="재시도 비율" dataKey="retryRate" stroke="#e2933d" strokeWidth={2} />{points.filter((session, index) => index > 0 && session.goalVersion !== points[index - 1].goalVersion).map(session => <ReferenceLine key={session.sessionId} x={session.label} stroke="#80a276" strokeDasharray="4 4" label={`v${session.goalVersion}`} />)}</LineChart></ResponsiveContainer></div>
}
