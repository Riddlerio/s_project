// 휴대폰(아이폰) 마이크 시험용 HTTPS 개발 서버. 같은 와이파이에서만 쓴다. 배포용이 아니다.
// 휴대폰 브라우저는 https 주소에서만 마이크를 켜므로, 자체 서명 인증서로 개발 화면을 https로 연다.
//
// 사용(저장소 루트에서): node scripts/serve-phone.mjs <인증서 폴더> [백엔드 주소]
//   - 인증서 폴더에는 key.pem·cert.pem(자체 서명)을 둔다. 인증서는 저장소에 넣지 않는다.
//   - 백엔드 기본값은 README 실행 방법과 같은 http://127.0.0.1:8000이다.
//   - 휴대폰에서 https://<PC의 IP>:5183/play 를 연다. 처음 뜨는 '안전하지 않음' 경고는 이 PC의 인증서라서 나온다.
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const [certDir, backend = 'http://127.0.0.1:8000'] = process.argv.slice(2)
if (!certDir) {
  console.error('사용: node scripts/serve-phone.mjs <인증서 폴더> [백엔드 주소]')
  process.exit(1)
}
// 백엔드는 허용한 출처(기본 http://127.0.0.1:5173)에서 온 요청만 받는다. 휴대폰 주소 대신 이 출처로 바꿔 보낸다(개발용).
const allowedOrigin = process.env.PHONE_PROXY_ORIGIN ?? 'http://127.0.0.1:5173'

const server = await createServer({
  configFile: 'vite.config.ts',
  server: {
    port: 5183, strictPort: true, host: '0.0.0.0',
    https: { key: readFileSync(`${certDir}/key.pem`), cert: readFileSync(`${certDir}/cert.pem`) },
    proxy: {
      '/api': {
        target: backend,
        configure: proxy => proxy.on('proxyReq', req => { if (req.getHeader('origin')) req.setHeader('origin', allowedOrigin) }),
      },
    },
  },
})
await server.listen()
server.printUrls()
