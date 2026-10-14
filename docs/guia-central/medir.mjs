import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW)
const browser = await chromium.launch()
// largura útil do A4 com 15 mm de margem: 180 mm = 680 px a 96 dpi; altura útil 266 mm = 1005 px
const page = await browser.newPage({ viewport: { width: 680, height: 1005 } })
await page.emulateMedia({ media: 'print' })
await page.goto('file://' + process.env.HTML, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
const r = await page.evaluate(() => [...document.querySelectorAll('section.pagina')].map((s, i) => {
  const t = (s.querySelector('h2, h3')?.textContent || '').slice(0, 40)
  return { i: i + 2, t, h: Math.round(s.getBoundingClientRect().height) }
}))
for (const x of r) console.log(`${x.h > 1005 ? '❌' : x.h < 700 ? '◽' : '✅'} p${x.i} ${x.h}px ${x.t}`)
await browser.close()
