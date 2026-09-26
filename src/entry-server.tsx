// Build-time pre-render: turns the app into static HTML so search engines and AI
// crawlers that do not run JavaScript still see the content (see scripts/prerender.mjs).
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'

export { links, site } from './data'

export const render = () =>
  renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  )
