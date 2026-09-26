import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import csp from 'vite-plugin-csp-guard'
import { seo } from './seo.ts'

const buildDate = new Date().toISOString()

// Every page gets the same icons, theme script and analytics from src/head.html.
const sharedHead = (): Plugin => ({
  name: 'shared-head',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace('<!-- head -->', readFileSync('src/head.html', 'utf8')),
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    sharedHead(),
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
  build: {
    // The home page, /offline and the 404 page.
    rollupOptions: { input: ['index.html', 'offline.html', '404.html'] },
  },
  define: {
    // Shown as "updated" in the stats card.
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
