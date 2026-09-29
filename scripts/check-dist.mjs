// 배포되는 dist(JS·HTML·CSS 등)에 DEMO 샘플 계정 비밀번호나 계정 이름이 들어가면 빌드를 실패시킨다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FORBIDDEN = ['speechhero', 'HERO01']
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
}
if (found.length) {
  console.error(`dist에 DEMO 자격 증명 문자열이 있습니다:\n${found.join('\n')}`)
  process.exit(1)
}
console.log(`dist 자격 증명 검사 통과 (${files(root).length}개 파일, 금지 문자열 ${FORBIDDEN.length}개)`)
