import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import '@fontsource-variable/pixelify-sans'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// The build pre-renders the page into #root, so attach to that HTML instead of replacing it.
if (root.firstElementChild) hydrateRoot(root, app)
else createRoot(root).render(app)
