// Pre-render: put each page's static HTML into dist/<page>.html (runs after both Vite builds).
// Parts that depend on the visitor's clock are left for the client (see src/lib/client.ts).
// Then Beasties inlines the (small) stylesheet, so the first paint needs no extra request.
import Beasties from 'beasties'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const { pages } = await import('../dist-server/entry-server.js')
const marker = '<div id="root"></div>'

// Preload the two Latin fonts, so text does not wait for the CSS to find them.
const fonts = readdirSync(new URL('../dist/assets', import.meta.url))
  .filter((f) => /^(nunito|pixelify-sans)-latin-wght-normal-.+\.woff2$/.test(f))
  .map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin>`)
  .join('')
const beasties = new Beasties({
  path: 'dist',
  // Inline the whole stylesheet (about 4 kB gzipped), not only the critical rules:
  // the menu, toasts and clock need the rest after hydration.
  inlineThreshold: 50_000,
  reduceInlineStyles: false,
  logLevel: 'warn',
})

// The loading lines of the counts card match the live log at build time: as many rows as kinds
// logged, and the clock only if chai has hours (CSS in src/index.css hides the other lines). The
// head script (src/head.html) uses the visitor's last visit instead when there is one. Without the
// live answer (no network), nothing is set and all the lines show.
async function logShape() {
  try {
    const res = await fetch(process.env.LOG_SHAPE_URL ?? 'https://kichoow.com/api/log', { signal: AbortSignal.timeout(5000) })
    if (res.status !== 200) return ''
    const logged = (await res.json()).kinds.filter((k) => k.last)
    const clock = logged.some((k) => k.kind === 'chai' && k.hours?.some(Boolean)) ? 1 : 0
    return ` data-log-rows="${logged.length}" data-log-clock="${clock}"`
  } catch {
    return ''
  }
}
const shape = await logShape()
console.log(`Counts loading lines: ${shape.trim() || 'all (live log not reached)'}`)

// Read every built page first: a page can start from another one (offline-now.html from offline.html).
const built = Object.fromEntries(Object.entries(pages).map(([page, { from = page }]) => [page, readFileSync(new URL(`../dist/${from}`, import.meta.url), 'utf8')]))

for (const [page, { render }] of Object.entries(pages)) {
  const file = new URL(`../dist/${page}`, import.meta.url)
  const html = built[page]
  if (!html.includes(marker)) throw new Error(`prerender: ${marker} not found in the page for dist/${page}`)
  const rendered = html
    .replace(/<html([^>]*)>/, (_, attrs) => `<html${attrs}${shape}>`)
    .replace(/<meta charset[^>]*>/, (m) => m + fonts)
    .replace(marker, `<div id="root">${render()}</div>`)
  writeFileSync(file, await beasties.process(rendered))
  console.log(`Pre-rendered dist/${page}`)
}
rmSync(new URL('../dist-server', import.meta.url), { recursive: true, force: true })
