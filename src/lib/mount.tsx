import { StrictMode, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import '@fontsource-variable/pixelify-sans'
import '../index.css'

// Client start for every page (main.tsx, offline.tsx).
export function mount(page: ReactNode) {
  const root = document.getElementById('root')!
  const app = <StrictMode>{page}</StrictMode>
  // The build pre-renders each page into #root, so attach to that HTML instead of replacing it.
  if (root.firstElementChild) hydrateRoot(root, app)
  else createRoot(root).render(app)

  // Offline support (scripts/sw.mjs). Builds only: the dev server has no sw.js.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
}
