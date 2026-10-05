import type { MouthKind, RetryTip } from '../game/crossing/retryTips'

/*
 * 도움말 카드(2026-10-06): 입 모양 그림 + 짧은 제목 + 한두 줄 안내. 그림은 장식이고 같은 내용을 글이 말한다.
 * 색은 부드러운 분홍·하늘색만 쓴다(진한 빨강 없음). 움직임 줄이기 설정이면 나타나는 효과를 끈다(CSS).
 */
const LIP = '#f4a7ae'
const INSIDE = '#8c4253'
const TONGUE = '#f08c99'
const TOOTH = '#ffffff'
const AIR = '#5dbde6'
const INK = '#1f5c50'

function Mouth({ kind }: { kind: MouthKind }) {
  return <svg className="crossing-tip-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <circle cx="32" cy="32" r="31" fill="#fff7e8" />
    {(kind === 'teeth' || kind === 'long') && <g transform={kind === 'long' ? 'translate(-9 0) scale(.9)' : undefined}>
      <path d="M12 31 Q32 19 52 31 Q32 49 12 31Z" fill={LIP} />
      <rect x="20" y="27" width="24" height="9" rx="3" fill={TOOTH} />
      <path d="M20 31.5h24" stroke="#d8d8d8" strokeWidth="1" />
    </g>}
    {kind === 'teeth' && [24, 31, 38].map(y => <path key={y} d={`M52 ${y} q3 -2.5 6 0`} fill="none" stroke={AIR} strokeWidth="2.4" strokeLinecap="round" />)}
    {kind === 'long' && <path d="M40 31 q3 -4 6 0 t6 0 t6 0 M55 27 l4 4 -4 4" fill="none" stroke={AIR} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
    {kind === 'a' && <g>
      <ellipse cx="32" cy="33" rx="14" ry="17" fill={LIP} />
      <ellipse cx="32" cy="34" rx="10" ry="13" fill={INSIDE} />
      <rect x="25" y="21.5" width="14" height="4" rx="2" fill={TOOTH} />
      <ellipse cx="32" cy="42.5" rx="7" ry="4" fill={TONGUE} />
    </g>}
    {kind === 'o' && <g><circle cx="32" cy="32" r="14" fill={LIP} /><circle cx="32" cy="32" r="7.5" fill={INSIDE} /></g>}
    {kind === 'u' && <g>
      <ellipse cx="32" cy="32" rx="10" ry="11" fill={LIP} />
      <circle cx="32" cy="32" r="4" fill={INSIDE} />
      <path d="M14 26 l-5 -3 M14 38 l-5 3 M50 26 l5 -3 M50 38 l5 3" stroke={AIR} strokeWidth="2.2" strokeLinecap="round" />
    </g>}
    {kind === 'i' && <g>
      <path d="M8 32 Q32 22 56 32 Q32 42 8 32Z" fill={LIP} />
      <rect x="17" y="29" width="30" height="6" rx="2.5" fill={TOOTH} />
    </g>}
    {kind === 'mic' && <g>
      <rect x="25" y="13" width="14" height="24" rx="7" fill={INK} />
      <path d="M20 31 q0 11 12 11 q12 0 12 -11 M32 42 v8 M25 50 h14" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M46 20 h10 M52 16 l4 4 -4 4" fill="none" stroke={AIR} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>}
    {kind === 'beat' && <g>
      {[0, 1, 2].map(n => <circle key={n} cx={13 + n * 12} cy="32" r="4.5" fill="#cfe8de" />)}
      <circle cx="50" cy="32" r="8" fill="#f2b230" />
      <ellipse cx="50" cy="33" rx="3" ry="3.6" fill={INSIDE} />
    </g>}
  </svg>
}

export function RetryTipCard({ tip }: { tip: RetryTip }) {
  return <div className="crossing-tip" role="status">
    <Mouth kind={tip.mouth} />
    <div className="crossing-tip-text"><strong>{tip.title}</strong><span>{tip.body}</span></div>
  </div>
}
