// Makes public/og.png (1200×630 share card), public/apple-touch-icon.png and
// public/icon-512.png from scripts/og/template.html, and an animated GIF of each 88×31 button
// (public/<button>.gif) for other sites to embed. Run after adding or changing a button:
//   npm run og
// Needs a Chromium for Playwright (a dev dependency): npx playwright install chromium
// Or use a Chrome/Chromium you already have: CHROMIUM_PATH=/path/to/chrome npm run og
import { chromium } from '@playwright/test'
import gifenc from 'gifenc' // a CommonJS package: no named imports in Node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const { GIFEncoder, applyPalette, quantize } = gifenc
const root = fileURLToPath(new URL('../../', import.meta.url))
const file = (p) => pathToFileURL(join(root, p)).href


// The buttons, domain and description come from the site data, so the card stays in step.
const data = readFileSync(join(root, 'src/data.ts'), 'utf8')
const buttons = [...data.matchAll(/file: '([^']+)'/g)].map((m) => m[1])
const url = data.match(/url: '([^']+)'/)[1]
const description = data
  .match(/description:\s*'([^']+)'/)[1]
  .replace(/^Kishore’s corner of the internet: /, '')

const html = readFileSync(join(root, 'scripts/og/template.html'), 'utf8')
  .replaceAll('{{FONT_NUNITO}}', file('node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2'))
  .replaceAll('{{FONT_PIXELIFY}}', file('node_modules/@fontsource-variable/pixelify-sans/files/pixelify-sans-latin-wght-normal.woff2'))
  .replaceAll('{{MASCOT}}', file('scripts/og/mascot.svg'))
  .replaceAll('{{BUTTONS}}', buttons.map((b) => `<img src="${file(`public/${b}.svg`)}" alt="" />`).join(''))
  .replaceAll('{{DESCRIPTION}}', description)
  .replaceAll('{{DOMAIN}}', new URL(url).host)

const dir = mkdtempSync(join(tmpdir(), 'og-'))
const page = join(dir, 'og.html')
writeFileSync(page, html)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  // Still buttons on the card: each SVG stops its animation under reduced motion.
  const tab = await browser.newPage({ viewport: { width: 1300, height: 1500 }, reducedMotion: 'reduce' })
  await tab.goto(pathToFileURL(page).href)
  await tab.evaluate(() => document.fonts.ready)
  await tab.locator('#og').screenshot({ path: join(root, 'public/og.png') })
  await tab.locator('#icon').screenshot({ path: join(root, 'public/apple-touch-icon.png') })
  await tab.locator('#icon512').screenshot({ path: join(root, 'public/icon-512.png') })
  console.log('Wrote public/og.png, public/apple-touch-icon.png and public/icon-512.png')

  // Each button's GIF: open its SVG, stop its CSS animations at each frame time (Web Animations
  // API), take the frame, and encode it with gifenc. data-loop on the <svg> is the time after which
  // every animation repeats, so the GIF loops without a jump; data-frame, if set, is the frame time
  // of a sprite animation (the runner's 4 poses), so each pose is one GIF frame. Transparent corners
  // stay transparent.
  const svg = await browser.newPage({ viewport: { width: 88, height: 31 } })
  const pixels = await browser.newPage()
  for (const b of buttons) {
    await svg.goto(file(`public/${b}.svg`))
    const { loop, frame } = await svg.evaluate(() => ({
      loop: Number(document.documentElement.dataset.loop) || 0,
      frame: Number(document.documentElement.dataset.frame) || 0,
    }))
    // ms a frame (GIF counts in 10 ms): a sprite's own frame time (data-frame), else a smooth default
    const delay = frame ? frame * 1000 : loop > 2 ? 100 : 60
    const count = Math.max(1, Math.round((loop * 1000) / delay))
    const gif = GIFEncoder()
    for (let i = 0; i < count; i++) {
      await svg.evaluate((t) => {
        for (const a of document.getAnimations()) {
          a.pause()
          a.currentTime = t
        }
      }, i * delay)
      const png = (await svg.screenshot({ omitBackground: true })).toString('base64')
      const rgba = new Uint8Array(
        await pixels.evaluate(async (src) => {
          const img = new Image()
          img.src = `data:image/png;base64,${src}`
          await img.decode()
          const ctx = new OffscreenCanvas(88, 31).getContext('2d')
          ctx.drawImage(img, 0, 0)
          return [...ctx.getImageData(0, 0, 88, 31).data]
        }, png),
      )
      const palette = quantize(rgba, 256, { format: 'rgba4444', oneBitAlpha: true })
      const clear = palette.findIndex((c) => c[3] === 0)
      gif.writeFrame(applyPalette(rgba, palette, 'rgba4444'), 88, 31, {
        palette,
        delay,
        transparent: clear >= 0,
        transparentIndex: Math.max(clear, 0),
      })
    }
    gif.finish()
    writeFileSync(join(root, `public/${b}.gif`), gif.bytes())
  }
  console.log(`Wrote ${buttons.length} button GIFs`)
} finally {
  await browser.close()
  rmSync(dir, { recursive: true, force: true })
}
