import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { seo } from './seo.ts'

const buildDate = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seo(buildDate)],
  define: {
    // Shown as "updated" in the stats card.
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
