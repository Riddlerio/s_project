// 디자인 토큰(shared/design-tokens.json, DTCG 형식)으로 CSS 변수 파일 src/styles/tokens.css를 만든다.
// 토큰 값을 바꾸거나 더한 뒤 실행한다: node scripts/build-design-tokens.mjs  (테스트가 두 파일이 맞는지 확인한다)
import { readFileSync, writeFileSync } from 'node:fs'

const toCase = path => path.join('-')
/** {color.alpha.forest-a18} 같은 참조를 var(--color-alpha-forest-a18)로 바꾼다. */
const ref = value => typeof value === 'string' ? value.replace(/\{([^}]+)\}/g, (_, name) => `var(--${name.split('.').join('-')})`) : value

function cssValue(token) {
  const value = token.$value
  switch (token.$type) {
    case 'fontFamily': return value.map(name => /\s/.test(name) && name !== 'system-ui' ? `'${name}'` : name).join(', ')
    case 'shadow': return `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} ${ref(value.color)}`
    case 'cubicBezier': return `cubic-bezier(${value.join(', ')})`
    default: return ref(value)
  }
}

function walk(node, path, out) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    if (child && typeof child === 'object' && '$value' in child) out.push([`--${toCase([...path, key])}`, cssValue(child)])
    else if (child && typeof child === 'object') walk(child, [...path, key], out)
  }
  return out
}

export function renderTokensCss(tokens) {
  const lines = walk(tokens, [], []).map(([name, value]) => `  ${name}: ${value};`)
  return `/* 자동 생성 파일: shared/design-tokens.json → node scripts/build-design-tokens.mjs. 직접 고치지 않는다. */\n:root {\n${lines.join('\n')}\n}\n`
}

if (process.argv[1]?.endsWith('build-design-tokens.mjs')) {
  const tokens = JSON.parse(readFileSync('shared/design-tokens.json', 'utf8'))
  const css = renderTokensCss(tokens)
  writeFileSync('src/styles/tokens.css', css)
  console.log(`src/styles/tokens.css: 변수 ${css.split('\n').filter(line => line.startsWith('  --')).length}개`)
}
