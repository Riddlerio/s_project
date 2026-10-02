import { Link } from 'react-router-dom'

export default function RewardScreen() {
  const stored = sessionStorage.getItem('speechHero.result')
  const result = stored ? JSON.parse(stored) as { totalXp: number; heroLevel: number; badges: string[]; monsterCards: string[]; newBadges?: string[]; newMonsterCards?: string[] } : null
  const newTreasures = [...(result?.newBadges || []), ...(result?.newMonsterCards || [])]
  return <main className="child-screen reward-screen"><div className="child-shell"><header className="child-header"><span className="child-brand">D <span>두두의 모험</span></span><span className="child-header-status">모험 기록</span></header><section className="reward-content"><div className="reward-sun" aria-hidden="true"><span>✦</span></div><p className="eyebrow">JOURNEY COMPLETE</p><h1>오늘의 길을<br />끝까지 걸었어요.</h1><p className="reward-message">두두: 함께해 줘서 고마워! 다음 길도 천천히 가보자.</p><div className="reward-stats"><div><span>이번 모험의 반짝이</span><strong>+{result?.totalXp || 0}</strong></div><div><span>현재 레벨</span><strong>{result?.heroLevel || 1}</strong></div></div><div className="reward-treasure"><span className="eyebrow">NEW IN YOUR COLLECTION</span><h2>새로 모은 보물</h2><p>{newTreasures.join(' · ') || '오늘의 모험이 기록에 남았어요.'}</p></div><Link className="big-button" to="/play/map">다음 길 고르기 <span aria-hidden="true">→</span></Link></section></div></main>
}
