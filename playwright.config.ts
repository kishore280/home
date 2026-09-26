// UI tests (npm run audit): tests/ui.spec.ts. See AGENTS.md → "Test".
// The built site runs with `wrangler dev`, and the test browser opens it as http://kichoow.com,
// mapped to the local server inside the browser only, so Umami's domain check and the service
// worker run unchanged.
import { defineConfig, devices } from '@playwright/test'

const PORT = 8787
const SCROBBLE_TOKEN = 'test-token' // also in tests/ui.spec.ts

export default defineConfig({
  testDir: 'tests',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '.context/playwright-report' }]],
  outputDir: '.context/test-results',
  use: {
    baseURL: 'http://kichoow.com',
    trace: 'retain-on-failure',
    launchOptions: {
      // Use a Chrome/Chromium you already have: CHROMIUM_PATH=/path/to/chrome npm run audit
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [`--host-resolver-rules=MAP kichoow.com 127.0.0.1:${PORT}`, '--unsafely-treat-insecure-origin-as-secure=http://kichoow.com'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // The local D1 gets the tables, and a test token for /api/scrobble (tests/ui.spec.ts).
    command: `npx wrangler d1 migrations apply home --local && npx wrangler dev --port ${PORT} --ip 127.0.0.1 --var SCROBBLE_TOKEN:${SCROBBLE_TOKEN}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
