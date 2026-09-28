import { Link } from 'react-router-dom'

export default function RewardScreen() {
  const stored = sessionStorage.getItem('speechHero.result')
  const result = stored ? JSON.parse(stored) as { totalXp: number; heroLevel: number; badges: string[]; monsterCards: string[]; newBadges?: string[]; newMonsterCards?: string[] } : null
  return <main className="child-screen"><div className="hero-mark">✨</div><h1>모험 완료!</h1><p>루미: 다음에 또 만나!</p><p>반짝이 +{result?.totalXp || 0} · 레벨 {result?.heroLevel || 1}</p><h2>새로운 보물</h2><p>{[...(result?.newBadges || []), ...(result?.newMonsterCards || [])].join(' · ') || '모험을 해내고 성장했어요!'}</p><Link className="big-button" to="/play/map">모험 지도로</Link></main>
}
