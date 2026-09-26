// UI tests (npm run audit): tests/ui.spec.ts. See AGENTS.md → "Test".
// The built site runs with `wrangler dev`, and the test browser opens it as http://kichoow.com,
// mapped to the local server inside the browser only, so Umami's domain check and the service
// worker run unchanged.
import { defineConfig, devices } from '@playwright/test'

const PORT = 8787

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
    command: `npx wrangler dev --port ${PORT} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
