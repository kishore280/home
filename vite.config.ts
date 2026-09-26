import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import csp from 'vite-plugin-csp-guard'
import { seo } from './seo.ts'

const buildDate = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    seo(buildDate),
    // Content-Security-Policy as a <meta> tag; the plugin adds the hash of the inline theme script.
    csp({
      override: true,
      policy: {
        'default-src': ["'self'"],
        // Cloudflare Web Analytics (Cloudflare adds its beacon) and Umami Cloud.
        'script-src': ["'self'", 'https://static.cloudflareinsights.com', 'https://cloud.umami.is'],
        // React style props and sonner's injected styles.
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'", 'data:'],
        // status.cafe is read directly by the browser; the analytics scripts report to their own hosts.
        'connect-src': ["'self'", 'https://status.cafe', 'https://cloudflareinsights.com', 'https://gateway.umami.is'],
        'object-src': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    }),
  ],
  define: {
    // Shown as "updated" in the stats card.
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
