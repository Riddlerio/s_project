import { useEffect, useState } from 'react'

/** 치료사가 고쳐서 복사해 쓰는 초안 상자. 원본 초안이 바뀌면(회기 선택·서버 제안) 다시 채운다. */
export default function CopyBox({ title, text, note }: { title: string; text: string; note: string }) {
  const [value, setValue] = useState(text)
  const [message, setMessage] = useState('')
  useEffect(() => { setValue(text); setMessage('') }, [text])
  async function copy() {
    try { await navigator.clipboard.writeText(value); setMessage('복사했습니다. 기록지·알림장에 붙여 넣으세요.') }
    catch { setMessage('자동 복사가 안 됩니다. 글을 선택해서 복사해 주세요.') }
  }
  return <section className="ca-copy">
    <h4>{title}</h4>
    <p className="small">{note}</p>
    <textarea aria-label={title} value={value} rows={8} onChange={event => { setValue(event.target.value); setMessage('') }} />
    <button type="button" onClick={() => { void copy() }}>{title.replace(/\(.*\)$/, '').trim()} 복사</button>
    {message && <p role="status" className="small">{message}</p>}
  </section>
}
