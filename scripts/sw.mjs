// Service worker for offline use, made with Workbox. Runs after the pre-render, so it sees
// the final files. Pages are network first, so visitors always get the latest deploy; offline,
// they get the last copy they saw, or the precached offline page as the fallback page
// (Workbox: "Managing fallback responses").
import { generateSW } from 'workbox-build'

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  // The /offline page, JS (with the lazy menu and toasts), the Latin fonts, buttons and icons.
  // CSS is inlined in each page.
  globPatterns: ['offline.html', 'assets/*.js', 'assets/*-latin-wght-normal-*.woff2', '*.svg', 'manifest.webmanifest'],
  swDest: 'dist/sw.js',
  mode: 'production',
  inlineWorkboxRuntime: true,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: { cacheName: 'pages', networkTimeoutSeconds: 3, precacheFallback: { fallbackURL: 'offline.html' } },
    },
  ],
})
for (const w of warnings) console.warn(w)
console.log(`Service worker: ${count} files, ${(size / 1024).toFixed(0)} kB precached`)
