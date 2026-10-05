/*
 * 게임 카드(2026-10-05, 사용자가 준 참고 디자인: 위는 그림, 아래는 이름·설명·둥근 화살표 버튼인 큰 카드).
 * 잠겨 있으면(두두가 아직 권하지 않음) 흐리게 보이고 안내 문구를 보인다. 열리면 테두리가 빛나고 눌러 보라고 알린다.
 * 그림은 image(생성한 그림 파일)가 있으면 그것을, 없으면 코드로 그린 장면을 쓴다.
 */
export function CrossingCardArt() {
  return <svg className="game-card-svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="gc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fd3f4" /><stop offset="1" stopColor="#e6f7ff" /></linearGradient>
      <linearGradient id="gc-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5f676c" /><stop offset="1" stopColor="#4a5155" /></linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#gc-sky)" />
    <circle cx="268" cy="34" r="18" fill="#fff1a8" /><circle cx="268" cy="34" r="28" fill="#fff1a8" opacity=".35" />
    {[[56, 34, 26], [96, 28, 20], [210, 52, 18], [236, 48, 14]].map(([x, y, r]) => <circle key={`${x}`} cx={x} cy={y} r={r} fill="#ffffff" opacity=".92" />)}
    <path d="M0 108 Q60 84 120 100 T240 96 T320 104 V180 H0Z" fill="#9fd88a" />
    <path d="M0 122 Q80 104 160 118 T320 116 V180 H0Z" fill="#7cc66f" />
    {/* 정문: 가로 보와 오른쪽 기둥, 왼쪽 원통 탑 */}
    <rect x="170" y="62" width="104" height="16" rx="3" fill="#e9e3d6" /><rect x="176" y="66" width="56" height="7" rx="2" fill="#f2a83b" />
    <rect x="252" y="62" width="22" height="56" rx="3" fill="#ddd5c6" /><rect x="258" y="70" width="10" height="38" rx="2" fill="#4d5153" />
    <rect x="160" y="54" width="14" height="64" rx="7" fill="#e6e1d6" /><rect x="190" y="78" width="3" height="40" fill="#efebe3" />
    {/* 횡단보도 길(원근) */}
    <path d="M70 180 L150 118 L270 118 L330 180Z" fill="url(#gc-road)" />
    {Array.from({ length: 7 }, (_, i) => {
      const t = i / 6, top = 118 + t * 0, x0 = 92 + i * 30, x1 = 160 + i * 16
      return <path key={i} d={`M${x0} 180 L${x1} ${top} L${x1 + 8} ${top} L${x0 + 18} 180Z`} fill="#f7f7f2" opacity={0.95 - t * 0.2} />
    })}
    {/* 음표 */}
    <text x="40" y="78" fontSize="28" fill="#13a389">♪</text><text x="122" y="64" fontSize="22" fill="#f2a83b">♫</text>
  </svg>
}

export function GameCard({ title, subtitle, badge, image, open, lockedText, onClick }: {
  title: string; subtitle: string; badge?: string; image?: string; open: boolean; lockedText: string; onClick(): void
}) {
  return <button className={`game-card${open ? ' open' : ''}`} onClick={onClick} disabled={!open}>
    <span className="game-card-art">
      {image ? <img src={image} alt="" /> : <CrossingCardArt />}
      {badge && <span className="game-card-badge">{badge}</span>}
    </span>
    <span className="game-card-body">
      <span className="game-card-text"><strong>{title}</strong><small>{open ? subtitle : lockedText}</small></span>
      <span className="game-card-go" aria-hidden="true">›</span>
    </span>
  </button>
}
