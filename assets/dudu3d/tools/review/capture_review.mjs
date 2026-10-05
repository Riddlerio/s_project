// 두두 검토 화면(/dudu-review.html)을 동작별로 촬영한다. 개발 서버가 떠 있어야 한다.
// node capture_review.mjs <출력폴더> <접두사> <동작,동작,...> [쿼리 추가, 예: "&close"] [대기ms]
// BASE 환경 변수로 서버 주소를 바꾼다(기본 http://127.0.0.1:5173). 눈 깜박임(첫 회 약 2.5초)을 피하려면 대기 3200ms.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const [outDir, prefix, list, extra = '', wait = '3200'] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1500, height: 560 } })
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 300)))
for (const action of list.split(',')) {
  await page.goto(`${BASE}/dudu-review.html?action=${action}${extra}`)
  await page.waitForTimeout(Number(wait))
  await page.screenshot({ path: `${outDir}/${prefix}_${action}.png` })
}
await browser.close()
