import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SessionPoint } from '../../shared/types'

export default function SessionTrendChart({ sessions }: { sessions: SessionPoint[] }) {
  if (!sessions.length) return null
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height={290}><LineChart data={sessions}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="index" /><YAxis domain={[0, 100]} unit="%" /><Tooltip /><Legend /><Line type="monotone" name="첫 시도 성공률" dataKey="firstTrySuccessRate" stroke="#6046c8" strokeWidth={3} /><Line type="monotone" name="재시도 비율" dataKey="retryRate" stroke="#e2933d" strokeWidth={2} />{sessions.filter((session, index) => index > 0 && session.goalVersion !== sessions[index - 1].goalVersion).map(session => <ReferenceLine key={session.sessionId} x={session.index} stroke="#80a276" strokeDasharray="4 4" label={`v${session.goalVersion}`} />)}</LineChart></ResponsiveContainer></div>
}
