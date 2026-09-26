import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Shown as "updated" in the stats card.
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})
