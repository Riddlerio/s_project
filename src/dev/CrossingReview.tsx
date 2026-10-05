import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DaeguCrossing from '../child/DaeguCrossing'
import '../styles/global.css'
import '../styles/child.css'

/*
 * 개발 서버 전용(/crossing-review.html). 서버 없이 '대구대 건너기' 장면·흐름을 미리 본다.
 * 판정은 화면의 음향 근사(미리보기)이며 서버 판정·발음 평가가 아니다. 배포 빌드에 들어가지 않는다.
 */
function Done() {
  return <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}><h1>미리보기 끝</h1><p>실제 앱에서는 여기서 두두의 마무리 인사(/play/goodbye)로 갑니다.</p><a href="/crossing-review.html">다시 보기</a></main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><MemoryRouter initialEntries={['/play/crossing']}><Routes>
  <Route path="/play/crossing" element={<DaeguCrossing preview />} />
  <Route path="*" element={<Done />} />
</Routes></MemoryRouter></StrictMode>)
