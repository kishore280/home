// Build-time pre-render: turns each page into static HTML so search engines and AI
// crawlers that do not run JavaScript still see the content (see scripts/prerender.mjs).
import { StrictMode, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'
import { LogPage } from './components/LogPage'
import { NotFoundPage } from './components/NotFoundPage'
import { OfflinePage } from './components/OfflinePage'

const html = (page: ReactNode) => () => renderToString(<StrictMode>{page}</StrictMode>)

// HTML file in dist/ → its pre-rendered #root, and the built page it starts from (default: itself).
// /offline is built twice: online (offline.html) and offline (offline-now.html, which the service
// worker serves when the real request fails).
export const pages: Record<string, { render: () => string; from?: string }> = {
  'index.html': { render: html(<App />) },
  'offline.html': { render: html(<OfflinePage initial="online" />) },
  'offline-now.html': { render: html(<OfflinePage initial="offline" />), from: 'offline.html' },
  '404.html': { render: html(<NotFoundPage />) },
  'log.html': { render: html(<LogPage />) },
}
