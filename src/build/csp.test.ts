import { describe, expect, it } from 'vitest'
import { injectCsp, PRODUCTION_CSP, productionCspPlugin } from './csp'

describe('프로덕션 CSP', () => {
  it('build에서만 적용되고 charset 뒤에 한 번만 들어간다', () => {
    const plugin = productionCspPlugin()
    expect(plugin.apply).toBe('build')
    const html = plugin.transformIndexHtml('<html><head><meta charset="UTF-8"/><title>t</title></head></html>')
    expect(html).toBe(`<html><head><meta charset="UTF-8"/><meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}"/><title>t</title></head></html>`)
    expect(injectCsp(html)).toBe(html)
  })

  it('외부 스크립트·inline script·object를 허용하지 않는다', () => {
    expect(PRODUCTION_CSP).toContain("script-src 'self'")
    expect(PRODUCTION_CSP).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(PRODUCTION_CSP).not.toContain('unsafe-eval')
    expect(PRODUCTION_CSP).toContain("object-src 'none'")
  })
})
