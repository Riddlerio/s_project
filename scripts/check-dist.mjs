// 배포되는 dist(JS·HTML·CSS 등)에 DEMO 샘플 계정 비밀번호나 계정 이름, LLM API key가 들어가면 빌드를 실패시킨다.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const FORBIDDEN = ['speechhero', 'HERO01', 'OPENAI_API_KEY', 'HOYA_CHAT_', 'VITE_OPENAI']
// 로컬 backend/.env에 실제 key가 있으면 그 값도 dist에 없어야 한다. 값은 출력하지 않는다.
const SECRET_NAMES = ['OPENAI_API_KEY', 'SECRET_KEY']
const secrets = existsSync('backend/.env') ? readFileSync('backend/.env', 'utf8').split(/\r?\n/)
  .map(line => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(match => match && SECRET_NAMES.includes(match[1]))
  .map(match => match[2].replace(/^["']|["']$/g, '')).filter(value => value.length >= 8) : []
const root = process.argv[2] || 'dist'

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const found = []
for (const path of files(root)) {
  const text = readFileSync(path).toString('latin1')
  for (const word of FORBIDDEN) if (text.includes(word)) found.push(`${path}: ${word}`)
  if (secrets.some(value => text.includes(value))) found.push(`${path}: backend/.env의 비밀 값`)
  if (basename(path).startsWith('.env')) found.push(`${path}: 환경 변수 파일`)
}
if (found.length) {
  console.error(`dist에 자격 증명 문자열이 있습니다:\n${found.join('\n')}`)
  process.exit(1)
}
console.log(`dist 자격 증명 검사 통과 (${files(root).length}개 파일, 금지 문자열 ${FORBIDDEN.length}개, 로컬 비밀 값 ${secrets.length}개)`)
