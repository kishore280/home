// Pre-render: put the app's static HTML into dist/index.html (runs after both Vite builds).
// Parts that depend on the visitor's clock are left for the client (see src/lib/client.ts).
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const { render } = await import('../dist-server/entry-server.js')
const file = new URL('../dist/index.html', import.meta.url)
const html = readFileSync(file, 'utf8')
const marker = '<div id="root"></div>'
if (!html.includes(marker)) throw new Error('prerender: <div id="root"></div> not found in dist/index.html')

writeFileSync(file, html.replace(marker, `<div id="root">${render()}</div>`))
rmSync(new URL('../dist-server', import.meta.url), { recursive: true, force: true })
console.log('Pre-rendered dist/index.html')
