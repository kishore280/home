// Pre-render: put the app's static HTML into dist/index.html (runs after both Vite builds).
// Parts that depend on the visitor's clock are left for the client (see src/lib/client.ts).
// Then Beasties inlines the (small) stylesheet, so the first paint needs no extra request.
import Beasties from 'beasties'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const { render } = await import('../dist-server/entry-server.js')
const file = new URL('../dist/index.html', import.meta.url)
const html = readFileSync(file, 'utf8')
const marker = '<div id="root"></div>'
if (!html.includes(marker)) throw new Error('prerender: <div id="root"></div> not found in dist/index.html')

// Preload the two Latin fonts, so text does not wait for the CSS to find them.
const fonts = readdirSync(new URL('../dist/assets', import.meta.url))
  .filter((f) => /^(nunito|pixelify-sans)-latin-wght-normal-.+\.woff2$/.test(f))
  .map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin>`)
  .join('')
const rendered = html
  .replace(/<meta charset[^>]*>/, (m) => m + fonts)
  .replace(marker, `<div id="root">${render()}</div>`)
const beasties = new Beasties({
  path: 'dist',
  // Inline the whole stylesheet (about 4 kB gzipped), not only the critical rules:
  // the menu, toasts and clock need the rest after hydration.
  inlineThreshold: 50_000,
  reduceInlineStyles: false,
  logLevel: 'warn',
})
writeFileSync(file, await beasties.process(rendered))
rmSync(new URL('../dist-server', import.meta.url), { recursive: true, force: true })
console.log('Pre-rendered dist/index.html')
