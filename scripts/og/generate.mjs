// Makes public/og.png (1200×630 share card), public/apple-touch-icon.png and
// public/icon-512.png from scripts/og/template.html. Run after adding a button:
//   npm run og
// Needs Playwright with a Chromium browser (not a project dependency, to keep installs small):
//   npm i -D playwright && npx playwright install chromium
// Or use a Chrome/Chromium you already have: CHROMIUM_PATH=/path/to/chrome npm run og
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const file = (p) => pathToFileURL(join(root, p)).href

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('Playwright is missing. Run: npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}

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
  const tab = await browser.newPage({ viewport: { width: 1300, height: 1500 } })
  await tab.goto(pathToFileURL(page).href)
  await tab.evaluate(() => document.fonts.ready)
  await tab.locator('#og').screenshot({ path: join(root, 'public/og.png') })
  await tab.locator('#icon').screenshot({ path: join(root, 'public/apple-touch-icon.png') })
  await tab.locator('#icon512').screenshot({ path: join(root, 'public/icon-512.png') })
  console.log('Wrote public/og.png, public/apple-touch-icon.png and public/icon-512.png')
} finally {
  await browser.close()
  rmSync(dir, { recursive: true, force: true })
}
