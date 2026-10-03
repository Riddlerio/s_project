export default function Character({ line, mood = 'happy' }: { line: string; mood?: 'happy' | 'thinking' | 'cheer' }) {
  // 안내 음성은 회기 화면이 소유한다. 발화 중 상태 문구는 화면에만 표시한다.
  return <div className="character"><div className={`character-face ${mood}`} aria-hidden="true">🧚</div><p className="speech-bubble">{line}</p></div>
}
