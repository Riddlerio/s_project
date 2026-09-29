/**
 * 프로덕션 빌드의 index.html에 넣는 Content-Security-Policy.
 * 개발 서버(Vite HMR·React Refresh)는 inline script와 websocket이 필요하므로 build에서만 적용한다.
 * 정의는 shared/frontend_csp.json 하나이며, FastAPI 정적 서비스(app/static_site.py)가 같은 정책에
 * frame-ancestors 'none'을 더해 HTTP 헤더로 보낸다. frame-ancestors는 meta 태그로는 적용되지 않는다.
 */
import cspConfig from '../../shared/frontend_csp.json'

export const PRODUCTION_CSP = cspConfig.directives.join('; ')

export function cspMetaTag(policy = PRODUCTION_CSP): string {
  return `<meta http-equiv="Content-Security-Policy" content="${policy}"/>`
}

export function injectCsp(html: string, policy = PRODUCTION_CSP): string {
  if (html.includes('http-equiv="Content-Security-Policy"')) return html
  const charset = /<meta charset="[^"]*"\s*\/?>/i.exec(html)
  if (charset) return html.replace(charset[0], `${charset[0]}${cspMetaTag(policy)}`)
  return html.replace('<head>', `<head>${cspMetaTag(policy)}`)
}

export function productionCspPlugin() {
  return { name: 'speech-hero-production-csp', apply: 'build' as const, transformIndexHtml: (html: string) => injectCsp(html) }
}
