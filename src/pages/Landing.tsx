import { Link } from 'react-router-dom'
import { Hoya3D } from '../tiger/Hoya3D'

export default function Landing() {
  return <main className="landing">
    <header className="site-header">
      <Link className="wordmark" to="/" aria-label="스피치 히어로 홈"><span className="wordmark-symbol">D</span><span>두두의 모험</span></Link>
      <Link className="header-link" to="/therapist/login">치료사 공간 <span aria-hidden="true">↗</span></Link>
    </header>
    <section className="landing-hero">
      <div className="landing-copy">
        <p className="eyebrow">SPEECH HERO · 작은 소리에서 시작되는 모험</p>
        <h1>한 마디가<br /><em>다음 장면을 연다.</em></h1>
        <p className="landing-intro">두두와 함께 천천히 말하고, 듣고, 다시 시도해요. 아이의 속도에 맞춰 이어지는 발음 연습 모험입니다.</p>
        <div className="landing-actions"><Link className="big-button" to="/play">모험 시작하기 <span aria-hidden="true">→</span></Link><Link className="text-link" to="/therapist/login">치료사로 들어가기</Link></div>
        <div className="landing-meta"><span>01 / 소리를 내고</span><span>02 / 함께 움직이고</span><span>03 / 다음 장면으로</span></div>
      </div>
      <div className="landing-art" aria-label="두두 캐릭터 3D 미리보기">
        <div className="landing-art-ring" aria-hidden="true" />
        <div className="landing-art-label">YOUR ADVENTURE COMPANION <span>↘</span></div>
        <Hoya3D action="IDLE" />
        <span className="landing-art-footnote">두두와 함께, 오늘의 한 걸음</span>
      </div>
    </section>
    <footer className="landing-footer"><span>말의 속도는 아이가 정해요.</span><span>© Speech Hero</span></footer>
  </main>
}
