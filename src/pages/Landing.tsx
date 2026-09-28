import { Link } from 'react-router-dom'
export default function Landing() { return <main className="landing"><div className="hero-mark">✨</div><h1>스피치 히어로</h1><p>루미와 함께 신나는 마법 모험!</p><Link className="big-button" to="/play">모험 시작</Link><Link className="quiet-link" to="/therapist/login">치료사 화면</Link></main> }
