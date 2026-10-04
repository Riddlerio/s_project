// 홈·빛의 마법(검토 화면과 실제 활동)을 데스크톱(1280)·휴대폰(390) 폭으로 촬영하고 가로 넘침을 확인한다.
// DEMO 서버(SEED_DEMO_DATA=true)와 개발 서버가 필요하다. node check_scenes.mjs <출력폴더>
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const out = process.argv[2]
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--mute-audio'] })
for (const [name, viewport] of [['desktop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, locale: 'ko-KR', deviceScaleFactor: name === 'phone' ? 2 : 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  await page.goto(BASE + '/play')
  await page.getByRole('button', { name: 'DEMO 아동으로 시작' }).click()
  await page.waitForURL('**/play/home')
  await page.waitForTimeout(3500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${out}/home_${name}.png`, fullPage: true })
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  for (const round of [1, 5]) {
    await page.goto(`${BASE}/magic-beam-review.html?round=${round}`)
    await page.waitForTimeout(3500)
    await page.screenshot({ path: `${out}/beam_r${round}_${name}.png` })
  }
  await page.goto(BASE + '/play/map')
  await page.getByRole('button', { name: '빛의 마법 5라운드 시작' }).click()
  await page.waitForURL('**/play/activity/**')
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `${out}/activity_${name}.png`, fullPage: true })
  const activityOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  console.log(name, '홈 가로 넘침', homeOverflow, '활동 가로 넘침', activityOverflow, '오류', errors.length ? errors : '없음')
  await context.close()
}
await browser.close()
