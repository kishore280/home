// Service worker for offline use, made with Workbox. Runs after the pre-render, so it sees
// the final files. Pages are network first, so visitors always get the latest deploy; offline,
// they get the last page they saw, or the pre-rendered page from the precache.
import { generateSW } from 'workbox-build'

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  // JS (with the lazy menu and toasts), the Latin fonts, the buttons and icons. CSS is inlined.
  globPatterns: ['assets/*.js', 'assets/*-latin-wght-normal-*.woff2', '*.svg', 'manifest.webmanifest'],
  // The page itself, under a URL that is not a navigation target, so '/' stays network first.
  templatedURLs: { '/offline': ['index.html'] },
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
      options: { cacheName: 'pages', networkTimeoutSeconds: 3, precacheFallback: { fallbackURL: '/offline' } },
    },
  ],
})
for (const w of warnings) console.warn(w)
console.log(`Service worker: ${count} files, ${(size / 1024).toFixed(0)} kB precached`)
