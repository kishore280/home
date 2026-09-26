// Build-time pre-render: turns each page into static HTML so search engines and AI
// crawlers that do not run JavaScript still see the content (see scripts/prerender.mjs).
import { StrictMode, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'
import { NotFoundPage } from './components/NotFoundPage'
import { OfflinePage } from './components/OfflinePage'

const html = (page: ReactNode) => () => renderToString(<StrictMode>{page}</StrictMode>)

// HTML file in dist/ → its pre-rendered #root.
export const pages: Record<string, () => string> = {
  'index.html': html(<App />),
  'offline.html': html(<OfflinePage />),
  '404.html': html(<NotFoundPage />),
}
