import type { SessionMode } from '../shared/levels'
import { AudioCapture } from './audioCapture'
import { VadStateMachine } from './vad'
import { DemoRecognizer } from './demoRecognizer'
import { WebSpeechRecognizer } from './webSpeechRecognizer'

export function createSpeechStack(mode: SessionMode) { return { capture: new AudioCapture(), vad: new VadStateMachine(), recognizer: mode === 'real' ? new WebSpeechRecognizer() : new DemoRecognizer() } }
