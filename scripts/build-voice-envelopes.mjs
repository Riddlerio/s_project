// 두두 음성 파일(public/assets/voice/dudu/*.wav)의 소리 크기 변화를 40ms마다 0~9 한 글자로 적어 shared/dudu_voice_envelopes.json에 쓴다.
// 화면은 재생 위치의 값으로 두두의 입을 연다(입 모양 맞추기). 새 음성 파일을 넣으면 이 스크립트를 다시 돌린다: node scripts/build-voice-envelopes.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

export const ENVELOPE_STEP_MS = 40
const DIR = 'public/assets/voice/dudu'
// 파일에서 가장 큰 소리보다 30dB 이상 작으면 입을 닫는다(숨·여운). 그 위는 0~9로 고르게 나눈다.
const RANGE_DB = 30

function samples(path) {
  const b = readFileSync(path); let p = 12, sr = 0, data = null, channels = 1
  while (p < b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4)
    if (id === 'fmt ') { channels = b.readUInt16LE(p + 10); sr = b.readUInt32LE(p + 12) }
    if (id === 'data') { data = b.subarray(p + 8, p + 8 + size); break }
    p += 8 + size + (size % 2)
  }
  const n = Math.floor(data.length / 2 / channels), x = new Float64Array(n)
  for (let i = 0; i < n; i++) x[i] = data.readInt16LE(i * 2 * channels) / 32768
  return { sr, x }
}

export function envelope(path) {
  const { sr, x } = samples(path), hop = Math.round(sr * ENVELOPE_STEP_MS / 1000), db = []
  for (let s = 0; s < x.length; s += hop) {
    let e = 0, n = 0
    for (let i = s; i < Math.min(x.length, s + hop); i++) { e += x[i] * x[i]; n++ }
    db.push(10 * Math.log10(Math.max(e / Math.max(n, 1), 1e-12)))
  }
  const peak = Math.max(...db)
  return db.map(v => Math.max(0, Math.min(9, Math.round((v - (peak - RANGE_DB)) / RANGE_DB * 9)))).join('')
}

if (process.argv[1]?.endsWith('build-voice-envelopes.mjs')) {
  const out = {}
  for (const file of readdirSync(DIR).filter(name => name.endsWith('.wav')).sort()) out[file.replace(/\.wav$/, '')] = envelope(`${DIR}/${file}`)
  writeFileSync('shared/dudu_voice_envelopes.json', JSON.stringify({ stepMs: ENVELOPE_STEP_MS, clips: out }, null, 1) + '\n')
  console.log(`${Object.keys(out).length}개 파일의 입 모양 값을 썼습니다.`)
}
