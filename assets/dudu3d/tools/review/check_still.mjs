// 정지 규칙 확인: 빛의 마법 검토 화면에서 두두 영역이 1.6초 사이에 바뀌는 픽셀 수를 센다.
// 움직이는 동작(보상)은 0보다 크고, 듣기 자세는 0이어야 한다. 움직임 줄이기에서는 장면 효과(별)만 바뀔 수 있다.
import { chromium } from 'playwright-core'
import sharp from 'sharp'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] })
const clip = { x: 600, y: 380, width: 200, height: 220 } // 1280×860에서 두두가 서는 자리
async function changed(a, b) {
  const [x, y] = await Promise.all([sharp(a).ensureAlpha().raw().toBuffer(), sharp(b).ensureAlpha().raw().toBuffer()])
  let n = 0
  for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 24) n++
  return n
}
const reward = page => page.getByRole('button', { name: '보상 모양만 보기' }).click()
for (const [label, setup] of [
  ['보상(움직임)', reward],
  ['보상 뒤 듣기 자세', async page => { await reward(page); await page.waitForTimeout(1200); await page.getByRole('button', { name: '듣기 자세로' }).click() }],
  ['움직임 줄이기 + 보상', async page => { await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await page.waitForTimeout(2500); await reward(page) }],
]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  await page.goto(`${BASE}/magic-beam-review.html?round=1`)
  await page.waitForTimeout(3000)
  await setup(page)
  await page.waitForTimeout(1500)
  const a = await page.screenshot({ clip }); await page.waitForTimeout(1600); const b = await page.screenshot({ clip })
  console.log(`${label}: 바뀐 픽셀 ${await changed(a, b)} / ${clip.width * clip.height}`)
  await page.close()
}
await browser.close()
