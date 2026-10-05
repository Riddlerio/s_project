import { useState } from 'react'

export default function SessionNote({ text }: { text: string }) {
  const [message, setMessage] = useState('')
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage('세션 노트를 복사했습니다.') }
    catch { setMessage('자동 복사가 안 됩니다. 아래 글을 선택해서 복사해 주세요.') }
  }
  return <section><h3>세션 노트</h3><p>서버 집계로 만든 기록 초안입니다. LLM을 사용하지 않습니다. 치료사가 검토 후 기록지에 사용하세요.</p>
    <textarea aria-label="서버 계산 세션 노트" className="session-note" readOnly value={text} />
    <button onClick={() => { void copy() }}>세션 노트 복사</button>{message && <p role="status">{message}</p>}
  </section>
}
