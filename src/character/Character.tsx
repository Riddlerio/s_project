import { useEffect } from 'react'
import { speak } from './tts'

export default function Character({ line, mood = 'happy' }: { line: string; mood?: 'happy' | 'thinking' | 'cheer' }) { useEffect(() => { speak(line) }, [line]); return <div className="character"><div className={`character-face ${mood}`} aria-hidden="true">🧚</div><p className="speech-bubble">{line}</p></div> }
