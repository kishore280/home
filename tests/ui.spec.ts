// UI tests: every tap target, the ⌘K menu, the offline page, the 404 page, layout width,
// accessibility and analytics events. Runs on "desktop" and "mobile" (playwright.config.ts).
// Method: .claude/skills/ui-test (adversarial checks) and .claude/skills/webapp-testing.
import AxeBuilder from '@axe-core/playwright'
import { test as base, expect, type Locator, type Page } from '@playwright/test'

declare global {
  interface Window {
    __copies: string[]
  }
}

// Umami's real script, so its click tracking runs. Events are captured, never sent.
// Without the script (no network), the event checks are skipped, not failed.
const umamiScript = fetch('https://cloud.umami.is/script.js').then(
  (r) => (r.ok ? r.text() : null),
  () => null,
)

type Log = { events: string[]; posts: string[] }

const test = base.extend<{ log: Log; press: (target: Locator) => Promise<void> }>({
  log: [
    async ({ context }, use) => {
      const log: Log = { events: [], posts: [] }
      const script = await umamiScript
      if (script) await context.route('https://cloud.umami.is/script.js', (r) => r.fulfill({ contentType: 'text/javascript', body: script }))
      await context.route('https://gateway.umami.is/api/send', (r) => {
        const { payload } = r.request().postDataJSON()
        if (payload.name) log.events.push(payload.name)
        return r.fulfill({ json: {} })
      })
      await context.route(/github\.com|linkedin\.com/, (r) => r.fulfill({ contentType: 'text/html', body: 'ok' }))
      context.on('request', (r) => {
        if (r.url().endsWith('/api/counters') && r.method() === 'POST') log.posts.push(r.postDataJSON().key)
      })
      await context.addInitScript(() => {
        window.__copies = []
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => window.__copies.push(t) } })
      })
      await use(log)
    },
    { auto: true },
  ],
  // A tap on touch screens, a click with a mouse.
  press: async ({ isMobile }, use) => use((target) => (isMobile ? target.tap() : target.click())),
})

// The Umami events that arrive, in order.
async function expectEvents(log: Log, events: string[]) {
  if (!(await umamiScript)) return test.info().annotations.push({ type: 'skip', description: 'Umami events: script not reachable' })
  await expect.poll(() => log.events).toEqual(events)
}

// For "nothing happened" checks there is no event to wait for, so give any stray request a
// moment to show up. (Everything that can be waited for uses web-first assertions.)
const settle = (page: Page) => page.waitForTimeout(600)

const menu = (page: Page) => page.locator('.cmdk-content')
async function openMenu(page: Page, press: (t: Locator) => Promise<void>) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
  await press(page.locator('.link-button'))
  await expect(menu(page)).toBeVisible()
}

test.describe('home page', () => {
  test('a visit counts one view, a reload in the same session none', async ({ page, log }) => {
    await page.goto('/')
    await expect.poll(() => log.posts).toEqual(['views'])
    await page.reload()
    await settle(page)
    expect(log.posts).toEqual(['views'])
  })

  for (const name of ['GitHub', 'LinkedIn']) {
    test(`${name} link opens a new tab and counts its event`, async ({ page, log, press }) => {
      await page.goto('/')
      const tab = page.waitForEvent('popup')
      await press(page.locator('nav.links a', { hasText: name }))
      await tab
      await expectEvents(log, [`${name} link`])
    })
  }

  test('mascot: each tap is one pat and one event', async ({ page, log, press }) => {
    await page.goto('/')
    const mascot = page.getByRole('button', { name: 'Pat the mascot' })
    await press(mascot)
    await expect(page.locator('.bubble.show')).toBeVisible()
    await press(mascot)
    await expect.poll(() => log.posts).toEqual(['views', 'pats', 'pats'])
    await expectEvents(log, ['Mascot pat', 'Mascot pat'])
  })

  test('88×31 button copies its embed code and counts it', async ({ page, log, press, isMobile }) => {
    await page.goto('/')
    const button = page.locator('.b88').nth(4)
    const label = await button.getAttribute('data-caption')
    await press(button)
    await expect(page.locator('[data-sonner-toast]')).toContainText('copied')
    const copied = await page.evaluate(() => window.__copies)
    expect(copied).toHaveLength(1)
    expect(copied[0]).toContain('http://kichoow.com/button-parotta.png')
    expect(copied[0]).toContain('width="88" height="31"')
    await expectEvents(log, isMobile ? [`Button copy: ${label}`] : [`Button hover: ${label}`, `Button copy: ${label}`])
  })

  test('a tap on a toast presses nothing under it', async ({ page, log, press }) => {
    await page.goto('/')
    await press(page.locator('.b88').first())
    const toast = page.locator('[data-sonner-toast]').first()
    await expect(toast).toBeVisible()
    const before = [...log.events]
    await press(toast)
    await settle(page)
    expect(await page.evaluate(() => window.__copies.length)).toBe(1)
    expect(log.events).toEqual(before)
  })
})

test.describe('⌘K menu', () => {
  test('the button opens it, Escape closes it, focus goes back', async ({ page, log, press }) => {
    await page.goto('/')
    await openMenu(page, press)
    await expect(page.getByPlaceholder('Type to search…')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu(page)).toHaveCount(0)
    await expect(page.locator('.link-button')).toBeFocused()
    await expectEvents(log, ['Menu open'])
  })

  test('Ctrl+K opens and closes it; only opening is counted', async ({ page, log, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcut')
    await page.goto('/')
    await page.keyboard.press('Control+k')
    await expect(menu(page)).toBeVisible()
    await page.keyboard.press('Control+k')
    await expect(menu(page)).toHaveCount(0)
    await expectEvents(log, ['Menu shortcut ⌘K'])
  })

  for (const [name, selector] of [
    ['the mascot', '.mascot-button'],
    ['the GitHub link', 'nav.links a'],
  ]) {
    test(`a tap outside it, over ${name}, closes it and presses nothing`, async ({ page, log, press, isMobile }) => {
      await page.goto('/')
      await openMenu(page, press)
      const target = (await page.locator(selector).first().boundingBox())!
      const box = (await menu(page).boundingBox())!
      const [x, y] = [target.x + target.width / 2, target.y + target.height / 2]
      test.skip(x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height, `${name} is under the menu on this screen`)
      await (isMobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y))
      await expect(menu(page)).toHaveCount(0)
      await settle(page)
      expect(log.posts).toEqual(['views'])
      expect(page.context().pages()).toHaveLength(1)
      await expect(page.locator('.bubble.show')).toHaveCount(0)
      await expectEvents(log, ['Menu open'])
    })
  }

  test('search matches plainly and is safe with odd input', async ({ page, press }) => {
    await page.goto('/')
    await openMenu(page, press)
    const input = page.getByPlaceholder('Type to search…')
    await input.fill('git')
    await expect(page.locator('[cmdk-item]')).toHaveText(['GitHub'])
    for (const text of ['a'.repeat(500), '<script>alert(1)</script>', `"quotes" 'single'`, '🍵🌊']) {
      await input.fill(text)
      await expect(page.getByText('Nothing found.')).toBeVisible()
      await expect(menu(page).locator('script')).toHaveCount(0)
    }
  })

  const items: [string, { events: string[]; posts: string[]; tab?: boolean; url?: string }][] = [
    ['Pat the mascot', { events: ['Menu: Pat the mascot'], posts: ['views', 'pats'] }],
    ['Switch light / dark', { events: ['Menu: Switch light / dark'], posts: ['views'] }],
    ['GitHub', { events: ['Menu: GitHub'], posts: ['views'], tab: true }],
    ['LinkedIn', { events: ['Menu: LinkedIn'], posts: ['views'], tab: true }],
    ['Offline only', { events: ['Menu: Offline only'], posts: ['views'], url: '/offline' }],
  ]
  for (const [item, want] of items) {
    test(`item "${item}" does only its own thing`, async ({ page, log, press }) => {
      await page.goto('/')
      await openMenu(page, press)
      const tab = want.tab ? page.waitForEvent('popup') : null
      await press(page.locator('[cmdk-item]', { hasText: item }))
      if (tab) await tab
      if (want.url) await expect(page).toHaveURL(want.url)
      await expect(menu(page)).toHaveCount(0)
      await settle(page)
      expect(log.posts).toEqual(want.posts)
      expect(await page.evaluate(() => window.__copies.length)).toBe(0)
      await expectEvents(log, ['Menu open', ...want.events])
    })
  }
})

test.describe('keyboard and touch', () => {
  test('Tab reaches every control, with a focus ring', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard')
    await page.goto('/')
    await expect(page.locator('.b88')).toHaveCount(8)
    const stops: { text: string; ring: boolean }[] = []
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const stop = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement
        if (e === document.body) return null
        const text = e.getAttribute('aria-label') || e.textContent?.trim() || e.querySelector('img')?.alt || ''
        return { text: text.slice(0, 24), ring: getComputedStyle(e).outlineStyle !== 'none' }
      })
      if (!stop || stops.some((s) => s.text === stop.text)) break
      stops.push(stop)
    }
    expect(stops[0].text).toBe('Skip to content')
    expect(stops.filter((s) => !s.ring)).toEqual([])
    expect(stops.map((s) => s.text)).toEqual(expect.arrayContaining(['GitHub ↗', 'LinkedIn ↗', 'Pat the mascot', '⌘K menu']))
  })

  test('links have a 44 px tall tap area on touch screens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only')
    await page.goto('/')
    const areas = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.links a, .link-button')].map((e) => {
        e.scrollIntoView({ block: 'center' })
        const r = e.getBoundingClientRect()
        const hits = (dy: number) => e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2 + dy))
        return { link: e.textContent?.trim(), above: hits(-11), below: hits(11) }
      }),
    )
    for (const a of areas) expect(a, a.link).toMatchObject({ above: true, below: true })
  })
})

test.describe('offline page', () => {
  test.skip(({ isMobile }) => isMobile, 'one run is enough; it uses the mouse to draw')

  // Mean brightness of a thin band low on the sand, where only a Big wave reaches.
  const band = (page: Page) =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas.sand')!
      const scale = c.width / c.getBoundingClientRect().width
      const d = c.getContext('2d')!.getImageData(c.width * 0.2, c.height * 0.9, c.width * 0.3, 3 * scale).data
      let sum = 0
      for (let i = 0; i < d.length; i += 4) sum += d[i]
      return sum / (d.length / 4)
    })

  test('online text, offline note and sand, drawing and Big wave', async ({ page, context, log }) => {
    await page.goto('/offline')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('offline only')
    await expect(page.locator('canvas.sand')).toHaveCount(0)
    await context.setOffline(true)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('wifi off, chai on')
    const sand = page.locator('canvas.sand')
    await expect(sand).toBeVisible()
    const box = (await sand.boundingBox())!
    const before = await band(page)
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.9 + 1)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.9 + 1, { steps: 12 })
    await page.mouse.up()
    expect(await band(page)).toBeLessThan(before - 20)
    await page.getByRole('button', { name: /Big wave/ }).click()
    await expect.poll(() => band(page), { timeout: 10_000 }).toBeGreaterThan(before - 12)
    for (let i = 0; i < 10; i++) await context.setOffline(i % 2 === 0)
    await context.setOffline(true)
    await expect(page.locator('canvas.sand')).toHaveCount(1)
    await context.setOffline(false)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('offline only')
    await expectEvents(log, ['Offline note read'])
  })

  test('it says when the page is saved for offline use', async ({ page }) => {
    await page.goto('/offline')
    await expect(page.getByText('✓ Saved on this device. You can go offline now.')).toBeVisible()
  })

  test('with a VPN or Wi-Fi without internet (the browser still says online), it still switches', async ({ page }) => {
    await page.goto('/offline')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('offline only')
    // navigator.onLine stays true; only real requests fail, as on a phone with a VPN in airplane mode.
    await page.route('**/robots.txt', (r) => r.abort('internetdisconnected'))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('wifi off, chai on', { timeout: 10_000 })
    expect(await page.evaluate(() => navigator.onLine)).toBe(true)
    await page.unroute('**/robots.txt')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('offline only', { timeout: 10_000 })
  })

  test('the switch still happens if the page was hidden while going offline', async ({ page, context }) => {
    await page.goto('/offline')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('offline only')
    // Like leaving the browser to turn on airplane mode: the page is frozen, then shown again.
    const cdp = await context.newCDPSession(page)
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' })
    await context.setOffline(true)
    await cdp.send('Page.setWebLifecycleState', { state: 'active' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('wifi off, chai on')
    await expect(page.locator('canvas.sand')).toBeVisible()
  })

  test('service worker: seen pages from the cache, others get the /offline fallback', async ({ page, context }) => {
    await page.goto('/offline')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.goto('/') // now controlled, so the page cache keeps it
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^hi, i’m/)
    await page.goto('/never/seen')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('wifi off, chai on')
  })
})

test.describe('404 and layout', () => {
  test('an unknown address gets a real 404 page', async ({ page }) => {
    const response = await page.goto('/does/not/exist')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404: lost at sea')
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex')
  })

  for (const width of [320, 375]) {
    for (const path of ['/', '/offline', '/nope']) {
      test(`${width} px wide, ${path}: no sideways scroll`, async ({ page, isMobile }) => {
        test.skip(isMobile, 'the width is set here')
        await page.setViewportSize({ width, height: 800 })
        await page.goto(path)
        const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
        expect(scroll).toBeLessThanOrEqual(inner)
      })
    }
  }
})

test.describe('accessibility (axe-core)', () => {
  test.skip(({ isMobile }) => isMobile, 'one run is enough')
  const states: [string, string, 'light' | 'dark', ((page: Page) => Promise<void>)?][] = [
    ['home, light', '/', 'light'],
    ['home, dark', '/', 'dark'],
    ['home, menu open', '/', 'light', async (page) => (await page.locator('.link-button').click(), await expect(menu(page)).toBeVisible())],
    ['/offline, online', '/offline', 'light'],
    [
      '/offline, offline',
      '/offline',
      'dark',
      async (page) => {
        await page.evaluate(() => navigator.serviceWorker.ready)
        await page.context().setOffline(true)
        await expect(page.locator('canvas.sand')).toBeVisible()
      },
    ],
    ['404', '/nope', 'dark'],
  ]
  for (const [name, path, scheme, setup] of states) {
    test(`${name}: no violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(path)
      await setup?.(page)
      const { violations } = await new AxeBuilder({ page }).analyze()
      expect(violations.map((v) => `${v.id} (${v.impact})`)).toEqual([])
    })
  }
})
