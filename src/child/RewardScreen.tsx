import { Link } from 'react-router-dom'
import './duduAdventure.css'

interface RunReward { totalXp: number; heroLevel: number; badges: string[]; monsterCards: string[]; newBadges?: string[]; newMonsterCards?: string[];
  roundStars?: { index: number; stars: number; praise: string; successRate: number | null }[]; materialsEarned?: { rice: number; tuna: number } }

export function AdventureRewardDetails({ result }: { result: RunReward | null }) {
  return <>
    {!!result?.roundStars?.length && <section className="dudu-pantry" aria-label="라운드별 게임 별"><h2>다섯 라운드의 별</h2>{result.roundStars.map(value => <p key={value.index}>라운드 {value.index} · <span className="dudu-stars" aria-label={`별 ${value.stars}개`}>{'★'.repeat(value.stars)}{'☆'.repeat(3 - value.stars)}</span> {value.praise}</p>)}<p className="small">게임의 별은 임상 평가와 별도로 기록돼요.</p></section>}
    {result?.materialsEarned && (result.materialsEarned.rice > 0 || result.materialsEarned.tuna > 0) && <section className="dudu-pantry" aria-label="이번 모험에서 모은 재료"><h2>이번 모험에서 모은 재료</h2>{result.materialsEarned.rice > 0 && <p>밥 {result.materialsEarned.rice}개</p>}{result.materialsEarned.tuna > 0 && <p>참치 {result.materialsEarned.tuna}개</p>}<p>두두의 집에서 모은 재료로 참치초밥을 만들어요.</p></section>}
    <Link className="big-button" to="/play/home">소풍 가방 보러 가기</Link>
  </>
}

export default function RewardScreen() {
  const stored = sessionStorage.getItem('speechHero.result')
  let result: RunReward | null = null
  try { result = stored ? JSON.parse(stored) as RunReward : null } catch { /* 저장된 화면 상태가 없으면 집에서 서버 가방을 다시 읽는다. */ }
  const newTreasures = [...(result?.newBadges || []), ...(result?.newMonsterCards || [])]
  return <main className="child-screen reward-screen"><div className="child-shell"><header className="child-header"><span className="child-brand">D <span>두두의 모험</span></span><span className="child-header-status">모험 기록</span></header><section className="reward-content"><div className="reward-sun" aria-hidden="true"><span>✦</span></div><p className="eyebrow">JOURNEY COMPLETE</p><h1>오늘의 길을<br />끝까지 걸었어요.</h1><p className="reward-message">두두: 함께해 줘서 고마워! 다음 길도 천천히 가보자.</p><div className="reward-stats"><div><span>이번 모험의 반짝이</span><strong>+{result?.totalXp || 0}</strong></div><div><span>현재 레벨</span><strong>{result?.heroLevel || 1}</strong></div></div><div className="reward-treasure"><span className="eyebrow">NEW IN YOUR COLLECTION</span><h2>새로 모은 보물</h2><p>{newTreasures.join(' · ') || '오늘의 모험이 기록에 남았어요.'}</p></div><AdventureRewardDetails result={result} /><Link className="big-button" to="/play/map">다음 길 고르기 <span aria-hidden="true">→</span></Link></section></div></main>
}
