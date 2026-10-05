import { describe, expect, it } from 'vitest'
import TOKENS from '../../shared/design-tokens.json'

/*
 * 디자인 토큰(Phase 3, 2026-10-05): shared/design-tokens.json이 원본이고 src/styles/tokens.css는 생성 파일이다.
 * 스타일 파일에는 색을 직접 쓰지 않고 토큰 변수만 쓴다(값이 한곳에서 관리되게).
 */
const STYLE_FILES = ['src/styles/global.css', 'src/styles/child.css', 'src/styles/therapist.css', 'src/child/duduDemo.css']

async function read(path: string): Promise<string> {
  // 이 프로젝트는 node 타입 선언을 쓰지 않아 동적 import로 읽는다(테스트는 node 환경).
  const fs: { readFileSync(path: URL, encoding: 'utf8'): string } = await import(/* @vite-ignore */ `node:${'fs'}`)
  return fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

type ColorGroup = Record<string, { $value: string }>
const colorTokens = Object.entries(TOKENS.color as unknown as Record<string, ColorGroup>)
  .flatMap(([group, tokens]) => Object.entries(tokens).map(([name, token]) => [`--color-${group}-${name}`, token.$value] as const))

describe('디자인 토큰', () => {
  it('tokens.css가 JSON과 맞다(바꿨으면 node scripts/build-design-tokens.mjs)', async () => {
    const css = await read('src/styles/tokens.css')
    for (const [name, value] of colorTokens) expect(css, name).toContain(`  ${name}: ${value};`)
    expect(css).toContain('--font-family-base:')
  })

  it('스타일 파일에는 색을 직접 쓰지 않고, 쓰는 색 변수는 모두 토큰에 있다', async () => {
    const defined = new Set<string>(colorTokens.map(([name]) => name))
    for (const file of STYLE_FILES) {
      const css = await read(file)
      expect(css.match(/#[0-9a-fA-F]{3,8}\b/g), file).toBeNull()
      for (const [, name] of css.matchAll(/var\((--color-[a-z0-9-]+)\)/g)) expect(defined.has(name), `${file}: ${name}`).toBe(true)
    }
  })

  it('색 이름은 값이 같으면 하나다(같은 색에 이름 두 개를 만들지 않는다)', () => {
    const values = colorTokens.map(([, value]) => value)
    expect(new Set(values).size).toBe(values.length)
  })
})
