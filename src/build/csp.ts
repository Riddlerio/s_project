/**
 * 프로덕션 빌드의 index.html에 넣는 Content-Security-Policy.
 * 개발 서버(Vite HMR·React Refresh)는 inline script와 websocket이 필요하므로 build에서만 적용한다.
 * frame-ancestors는 meta 태그로 적용되지 않으므로 배포 서버 헤더로 설정해야 한다(README 참고).
 */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React style 속성과 three.js/R3F가 요소에 직접 넣는 style 때문에 필요하다.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

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
