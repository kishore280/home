// Service worker for offline use, made with Workbox. Runs after the pre-render, so it sees the
// final files. Every page request goes to the network first (the real check, as Chrome does).
// When it fails, the visitor gets the offline version of /offline (offline-now.html), already
// rendered offline, so the first paint is right ("offline fallback page": Workbox, web.dev,
// Jake Archibald's Offline Cookbook). Other pages seen before also come from the page cache.
import { generateSW } from 'workbox-build'

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  // The offline version of /offline, the /log page, JS (with the lazy menu and toasts), the Latin
  // fonts, buttons and icons. CSS is inlined in each page. offline.html (the online version) is not
  // precached, so a cached copy can never stand in for the real check.
  globPatterns: ['offline-now.html', 'log.html', 'assets/*.js', 'assets/*-latin-wght-normal-*.woff2', '*.svg', '*.webmanifest'],
  // The terminal player (about 185 KB) loads only when a recording comes near the screen, and the
  // experiments' pages (/experiments, /experiments/split) are not linked from the site; do not
  // download them for every visitor.
  globIgnores: ['assets/terminal-player-*.js', 'assets/split-*.js', 'assets/experiments-*.js'],
  swDest: 'dist/sw.js',
  mode: 'production',
  inlineWorkboxRuntime: true,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  navigationPreload: true,
  runtimeCaching: [
    // /offline: always the real request; if it fails, the offline version.
    {
      urlPattern: ({ request, url }) => request.mode === 'navigate' && url.pathname === '/offline',
      handler: 'NetworkOnly',
      options: { precacheFallback: { fallbackURL: 'offline-now.html' } },
    },
    // /log (logging at the beach): the network, else the precached page, so it opens with no signal.
    {
      urlPattern: ({ request, url }) => request.mode === 'navigate' && url.pathname === '/log',
      handler: 'NetworkFirst',
      options: { cacheName: 'pages', networkTimeoutSeconds: 3, precacheFallback: { fallbackURL: 'log.html' } },
    },
    // The kinds and counts for /log: the network, else the last copy, so the buttons are there with
    // no signal.
    {
      urlPattern: ({ url }) => url.pathname === '/api/log',
      method: 'GET',
      handler: 'NetworkFirst',
      options: { cacheName: 'api', networkTimeoutSeconds: 3 },
    },
    // A log or undo sent with no signal waits in a queue and is sent when the network is back
    // (workbox-background-sync). 24 h, the oldest `at` the Worker accepts.
    {
      urlPattern: ({ url }) => url.pathname === '/api/log' || url.pathname === '/api/log/undo',
      method: 'POST',
      handler: 'NetworkOnly',
      options: { backgroundSync: { name: 'log', options: { maxRetentionTime: 24 * 60 } } },
    },
    // Other pages: the network, else the last copy seen, else the offline version of /offline.
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: { cacheName: 'pages', networkTimeoutSeconds: 3, precacheFallback: { fallbackURL: 'offline-now.html' } },
    },
  ],
})
for (const w of warnings) console.warn(w)
console.log(`Service worker: ${count} files, ${(size / 1024).toFixed(0)} kB precached`)
