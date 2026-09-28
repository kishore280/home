// Makes public/og.png (1200×630 share card), public/apple-touch-icon.png and
// public/icon-512.png from scripts/og/template.html, an animated GIF of each 88×31 button
// (public/<button>.gif) for other sites to embed, and the blinkies and stamps (SVG and GIF). Run after adding or changing a button:
//   npm run og
// Needs a Chromium for Playwright (a dev dependency): npx playwright install chromium
// Or use a Chrome/Chromium you already have: CHROMIUM_PATH=/path/to/chrome npm run og
import { chromium } from '@playwright/test'
import gifenc from 'gifenc' // a CommonJS package: no named imports in Node
import opentype from 'opentype.js'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const { GIFEncoder, applyPalette, quantize } = gifenc
const root = fileURLToPath(new URL('../../', import.meta.url))
const file = (p) => pathToFileURL(join(root, p)).href


// The buttons, domain and description come from the site data, so the card stays in step.
const data = readFileSync(join(root, 'src/data.ts'), 'utf8')
const list = (name) => data.slice(data.indexOf(`export const ${name}`)).split('\n]')[0]
const buttons = [...list('myButtons').matchAll(/file: '([^']+)'/g)].map((m) => m[1])
const stamps = [...list('myStamps').matchAll(/file: '([^']+)'.*?width: (\d+), height: (\d+)/g)].map((m) => ({ file: m[1], width: +m[2], height: +m[3] }))

// Blinkies and stamps: an SVG shown as an image cannot load a font, so each <text> in the sources
// (scripts/og/stamps/) becomes a <path> of the same words in Pixelify Sans Bold (opentype.js), with
// the text's other attributes (fill, stroke, class) kept.
const pixelify = opentype.parse(
  readFileSync(join(root, 'node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff')).buffer,
)
const entities = { '&gt;': '>', '&lt;': '<', '&amp;': '&' }
// One glyph after another (charToGlyph, advance width, kerning), not font.getPath: that applies the
// font's contextual substitutions, which this version of opentype.js cannot read yet, and a pixel
// font has none a word needs. With text-anchor="middle", x is the centre of the words, as in SVG.
const wordsPath = (words, x, y, size, middle) => {
  const scale = size / pixelify.unitsPerEm
  const glyphs = [...words].map((c) => pixelify.charToGlyph(c))
  const steps = glyphs.map((g, i) => (g.advanceWidth + (glyphs[i + 1] ? pixelify.getKerningValue(g, glyphs[i + 1]) : 0)) * scale)
  if (middle) x -= steps.reduce((a, b) => a + b, 0) / 2
  return glyphs
    .map((g, i) => {
      const d = g.getPath(x, y, size).toPathData(2)
      x += steps[i]
      return d
    })
    .join('')
}
for (const { file: name } of stamps) {
  const source = readFileSync(join(root, `scripts/og/stamps/${name}.svg`), 'utf8')
  const out = source.replace(/<text([^>]*)>([^<]*)<\/text>/g, (_, attrs, words) => {
    const num = (key) => Number(new RegExp(` ${key}="([\\d.]+)"`).exec(attrs)[1])
    const middle = attrs.includes('text-anchor="middle"')
    const d = wordsPath(words.replace(/&\w+;/g, (e) => entities[e]), num('x'), num('y'), num('font-size'), middle)
    return `<path d="${d}"${attrs.replace(/ (x|y|font-size|text-anchor)="[^"]*"/g, '')}/>`
  })
  writeFileSync(join(root, `public/${name}.svg`), out)
}
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
  const svg = await browser.newPage({ viewport: { width: 150, height: 56 } })
  const pixels = await browser.newPage()
  for (const { file: b, width, height } of [...buttons.map((b) => ({ file: b, width: 88, height: 31 })), ...stamps]) {
    await svg.setViewportSize({ width, height })
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
        await pixels.evaluate(async ({ src, w, h }) => {
          const img = new Image()
          img.src = `data:image/png;base64,${src}`
          await img.decode()
          const ctx = new OffscreenCanvas(w, h).getContext('2d')
          ctx.drawImage(img, 0, 0)
          return [...ctx.getImageData(0, 0, w, h).data]
        }, { src: png, w: width, h: height }),
      )
      const palette = quantize(rgba, 256, { format: 'rgba4444', oneBitAlpha: true })
      const clear = palette.findIndex((c) => c[3] === 0)
      gif.writeFrame(applyPalette(rgba, palette, 'rgba4444'), width, height, {
        palette,
        delay,
        transparent: clear >= 0,
        transparentIndex: Math.max(clear, 0),
      })
    }
    gif.finish()
    writeFileSync(join(root, `public/${b}.gif`), gif.bytes())
  }
  console.log(`Wrote ${buttons.length} button GIFs, and ${stamps.length} blinkies and stamps (SVG and GIF)`)
} finally {
  await browser.close()
  rmSync(dir, { recursive: true, force: true })
}
