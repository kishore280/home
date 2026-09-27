// UI tests: every tap target, the ⌘K menu, the offline page, the 404 page, layout width,
// accessibility and analytics events. Runs on "desktop" and "mobile" (playwright.config.ts).
// Method: .claude/skills/ui-test (adversarial checks) and .claude/skills/webapp-testing.
import { wrangler } from './d1'
import AxeBuilder from '@axe-core/playwright'
import { test as base, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'

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

// A GET /api/log reply (worker/log.ts): the four kinds, with the totals given for some of them.
// Mocked with context.route, which also sees the service worker's requests (it caches /api/log).
type Totals = { today: number; month: number; year: number; total: number; last: string; place?: string; hours?: number[] }
const logReply = (totals: Partial<Record<'chai' | 'parotta' | 'beach' | 'badminton', Totals>>) => ({
  kinds: (
    [
      ['chai', '☕', 'chai', false],
      ['parotta', '🫓', 'parotta', false],
      ['beach', '🌊', 'beach days', true],
      ['badminton', '🏸', 'badminton days', true],
    ] as const
  ).map(([kind, emoji, label, onceADay]) => ({
    kind,
    emoji,
    label,
    onceADay,
    ...{ today: 0, month: 0, year: 0, total: 0, last: null, place: null, hours: Array(24).fill(0) },
    ...totals[kind],
  })),
})

// A GET /api/log/days reply: the last 84 (or 365) days ending today (IST), with counts on some days
// as { day: { kind: count } }, sent as [day, kind, count] rows in no order, like the Worker.
const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(Date.now())
const daysAgo = (n: number) => new Date(Date.parse(istToday()) - n * 86_400_000).toISOString().slice(0, 10)
const daysReply = (range: number, counts: Record<string, Record<string, number>>) => ({
  from: daysAgo(range - 1),
  to: istToday(),
  days: Object.entries(counts)
    .flatMap(([day, kinds]) => Object.entries(kinds).map(([kind, n]) => [day, kind, n]))
    .reverse(),
})
// 5 pm is the peak, then 11 am.
const chaiHours = Array.from({ length: 24 }, (_, h) => ({ 11: 6, 17: 9, 8: 2 })[h] ?? 0)

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

  test('opening it does not move the page behind it', async ({ page, press }) => {
    await page.goto('/')
    await page.locator('.link-button').scrollIntoViewIfNeeded() // so opening it does not scroll
    const before = await page.locator('main').boundingBox()
    await openMenu(page, press)
    expect(await page.locator('main').boundingBox()).toEqual(before)
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
      // Opening it can scroll the target off screen; bring it back (the scroll lock allows a script scroll).
      await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
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

  test('a page item keeps the menu shown until the page leaves; Back shows the page, menu closed', async ({ page, press }) => {
    await page.goto('/')
    await openMenu(page, press)
    // Record, as the page leaves, whether the menu was still there (no glimpse of the page under it).
    await page.evaluate(() =>
      addEventListener('pagehide', () => sessionStorage.setItem('menuAtLeave', String(!!document.querySelector('.cmdk-content')))),
    )
    await press(page.locator('[cmdk-item]', { hasText: 'Offline only' }))
    await expect(page).toHaveURL('/offline')
    expect(await page.evaluate(() => sessionStorage.getItem('menuAtLeave'))).toBe('true')
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(page.locator('main')).toBeVisible()
    await expect(menu(page)).toHaveCount(0)
  })

  test('a double tap on a page item counts and opens it once', async ({ page, log, press }) => {
    await page.goto('/')
    await openMenu(page, press)
    const item = page.locator('[cmdk-item]', { hasText: 'Offline only' })
    await item.dblclick()
    await expect(page).toHaveURL('/offline')
    await settle(page)
    await expectEvents(log, ['Menu open', 'Menu: Offline only'])
  })

  test('opens at once once its code has loaded (no 300 ms Suspense hold)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcut')
    // The menu code loads when the page is idle.
    const loaded = page.waitForResponse((r) => /CommandMenu-.*\.js$/.test(r.url()))
    await page.goto('/')
    await loaded
    const ms = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const start = performance.now()
          new MutationObserver(() => document.querySelector('.cmdk-content') && resolve(performance.now() - start)).observe(document.body, {
            childList: true,
            subtree: true,
          })
          dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
        }),
    )
    expect(ms).toBeLessThan(150)
  })
})

test.describe('after a new deploy', () => {
  // The service worker would serve the old file from its cache; test the network path.
  test.use({ serviceWorkers: 'block' })
  test('a code file that is gone does not break the page', async ({ page, context, press }) => {
    await context.route(/\/assets\/CommandMenu-.*\.js$/, (r) => r.fulfill({ status: 404 }))
    await page.goto('/')
    await press(page.locator('.link-button'))
    await settle(page)
    await expect(page.locator('h1')).toBeVisible()
    await expect(menu(page)).toHaveCount(0)
  })
})

test.describe('keyboard and touch', () => {
  test('Tab reaches every control, with a focus ring', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard')
    await page.goto('/')
    await expect(page.locator('.b88')).toHaveCount(8)
    const stops: { text: string; ring: boolean }[] = []
    // Up to 60 stops: with logged data, the "my days" card adds its chips, day and range buttons
    // before the ⌘K button. The loop ends when focus comes back to a stop it has seen.
    for (let i = 0; i < 60; i++) {
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
    await sand.scrollIntoViewIfNeeded() // the sand is taller than some screens
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

  test('it appears once, in the right state, with no swap', async ({ page, context }) => {
    // Open the page while offline: the first visible frame must already be the offline note.
    await page.goto('/offline')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await context.setOffline(true)
    await page.addInitScript(() => {
      const seen: string[] = []
      ;(window as unknown as { __h1: string[] }).__h1 = seen
      new MutationObserver(() => {
        const h1 = document.querySelector('h1')
        if (h1) seen.push(h1.textContent ?? '')
      }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
    })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('wifi off, chai on')
    const shown = await page.evaluate(() => [...new Set((window as unknown as { __h1: string[] }).__h1)])
    expect(shown).toEqual(['wifi off, chai on'])
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
    // Workbox writes the cache after the response has gone to the page; wait for the copy, or a
    // slow run goes offline before it is there.
    await expect.poll(() => page.evaluate(async () => Boolean(await (await caches.open('pages')).match('/')))).toBe(true)
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^hi, i’m/)
    await page.goto('/never/seen')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('wifi off, chai on')
  })
})

test.describe('speed', () => {
  // Two data shapes: every kind logged, and the live one (only chai logged). The loading places must
  // match both, or the main column jumps on phones (Lighthouse found 0.3 with only chai).
  const shapes = {
    'every kind logged': (totals: Totals) => ({ chai: { ...totals, hours: chaiHours }, parotta: totals, beach: { ...totals, place: 'Marina' }, badminton: totals }),
    'only chai logged': (totals: Totals) => ({ chai: { ...totals, hours: chaiHours } }),
  }
  for (const [shape, reply] of Object.entries(shapes)) test(`nothing moves while the home page loads (layout shift), ${shape}`, async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __cls: number }).__cls = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
      }).observe({ type: 'layout-shift', buffered: true })
    })
    // A last visit with the same kinds, so the loading lines are sized for them (src/head.html);
    // the first-visit sizing comes from the build and has its own test.
    const at0 = new Date().toISOString()
    const last = logReply(reply({ today: 2, month: 14, year: 90, total: 90, last: at0 }))
    await page.addInitScript((saved) => localStorage.setItem('swr /api/log:v1', saved), JSON.stringify(last))
    // The two late rows of "right now", as the live site gets them (the test server has no GitHub
    // access and may have no song). Their lines are kept in the HTML while they load.
    const at = new Date().toISOString()
    await page.route('**/api/now-playing', (r) => r.fulfill({ json: { title: 'A long song title that fills the line', artist: 'Artist', at, until: at } }))
    await page.route('**/api/github', (r) => r.fulfill({ json: { repo: 'home', url: 'https://github.com/kishore280/home', at } }))
    await page.context().route('https://lh3.googleusercontent.com/**', (r) => r.fulfill({ contentType: 'image/png', body: pixel }))
    await page.context().route('**/api/photos', (r) => r.fulfill({ json: { photos: [photo(1, at), photo(2, at)] } }))
    const totals = { today: 2, month: 14, year: 90, total: 90, last: at }
    await page
      .context()
      .route('**/api/log', (r) =>
        r.fulfill({ json: logReply(reply(totals)) }),
      )
    const today: Record<string, number> = shape === 'only chai logged' ? { chai: 2 } : { chai: 2, badminton: 1 }
    await page.context().route('**/api/log/days?**', (r) => r.fulfill({ json: daysReply(365, { [istToday()]: today }) }))
    await page.goto('/')
    // Wait for everything that arrives after the page: the clock, the rows, the mascot's line and the views.
    await expect(page.locator('.clock')).toBeVisible()
    await expect(page.locator('.row', { hasText: 'last played' })).toBeVisible()
    await expect(page.locator('.row', { hasText: 'building' })).toBeVisible()
    await expect(page.locator('.row.pending')).toHaveCount(0)
    await expect(page.locator('.count')).toHaveCount(Object.keys(reply(totals)).length) // the logged kinds
    await expect(page.locator('.count.pending')).toHaveCount(0)
    await expect(page.locator('.chai-clock figcaption')).toBeVisible()
    await expect(page.locator(`#year rect[data-date="${istToday()}"]`)).toHaveAttribute('data-level', String(Object.keys(today).length))
    await expect(page.locator('#year .heat-tiles dd')).toHaveCount(4)
    await expect(page.locator('#year .heat-day')).toContainText('(today)')
    await expect(page.locator('.stats dd')).toHaveCount(2)
    await expect(page.locator('#photos img')).toHaveCount(2)
    await settle(page)
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.001)
  })

  // A performance budget, kept in the tests so a change that adds weight fails here and has to
  // say why (web.dev "Performance budgets 101"). 400 KB is just above today's 387 KB of JavaScript
  // (before compression) that the home page loads, the lazy chunks included. The heatmap library's
  // tooltip chunk (Floating UI) must never load: the squares use an SVG <title>.
  test('the home page stays within its JavaScript budget', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await settle(page)
    const scripts = await page.evaluate(() =>
      (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter((e) => e.initiatorType === 'script' || e.name.endsWith('.js'))
        .map((e) => ({ name: e.name, bytes: e.decodedBodySize })),
    )
    const total = scripts.reduce((sum, e) => sum + e.bytes, 0)
    expect(total, scripts.map((e) => `${e.name.split('/').pop()} ${e.bytes}`).join(', ')).toBeLessThan(400_000)
    expect(scripts.filter((e) => e.name.includes('/assets/Tooltip'))).toEqual([])
  })

  test('a same-site link is prefetched on hover and opens from the prefetch', async ({ browser, baseURL, isMobile }) => {
    test.skip(isMobile, 'hover')
    // A context with no request interception: Chrome does not use prefetches while Playwright
    // routes requests (the shared fixture does, to capture analytics).
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    // The rules come from a separate file (the header points to it); hover once it has loaded.
    const rules = page.waitForResponse((r) => r.url().endsWith('/speculationrules.json'))
    const response = await page.goto('/offline')
    expect(response?.headers()['speculation-rules']).toBe('"/speculationrules.json"')
    expect((await rules).headers()['content-type']).toBe('application/speculationrules+json')
    // On a first visit the service worker takes control within about a second; a prefetch made
    // before that is not used for the controlled page, so start once it is in control.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
    })
    const back = page.getByRole('link', { name: /back to kish/ })
    await back.hover()
    await page.waitForTimeout(1000) // "moderate" eagerness: the browser starts after about 200 ms of hover
    await back.click()
    await expect(page).toHaveURL('/')
    expect(await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming & { deliveryType: string }).deliveryType)).toBe(
      'navigational-prefetch',
    )
    await context.close()
  })
})

// The phone's scrobbler (Pano Scrobbler, "Custom ListenBrainz") talks to /api/scrobble/. The
// requests below are the ones it sends (its ListenBrainz.kt). They go straight to the local
// server, not through the browser's kichoow.com mapping.
// The photos card reads /api/photos (worker/photos.ts: the shared Google Photos album).
const photo = (n: number, added: string) => ({
  id: `photo-${n}`,
  url: `https://lh3.googleusercontent.com/pw/test-${n}`,
  width: 3000,
  height: 4000,
  added,
})
// A 1x1 PNG, so the tests never load real photos from Google.
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

test.describe('photos (shared Google Photos album)', () => {
  test('the newest photos show as small squares that open large, with no referrer', async ({ page, context }) => {
    await context.route('https://lh3.googleusercontent.com/**', (r) => r.fulfill({ contentType: 'image/png', body: pixel }))
    await context.route('**/api/photos', (r) =>
      r.fulfill({ json: { photos: [photo(1, '2026-09-27T13:01:03Z'), photo(2, '2026-09-26T08:00:00Z')] } }),
    )
    await page.goto('/')
    const card = page.locator('#photos')
    await expect(card.getByRole('heading')).toHaveText('photos')
    const images = card.locator('img')
    await expect(images).toHaveCount(2)
    await expect(images.first()).toHaveAttribute('src', 'https://lh3.googleusercontent.com/pw/test-1=w400-h400-c-rw')
    await expect(images.first()).toHaveAttribute('alt', 'Photo 1 of 2 from kish’s album, added 27 Sept')
    await expect(images.first()).toHaveAttribute('referrerpolicy', 'no-referrer')
    await expect(card.getByRole('link').first()).toHaveAttribute('href', 'https://lh3.googleusercontent.com/pw/test-1=s0')
    await expect(card.getByRole('link')).toHaveCount(2) // the photos only, no link to the album
    // Squares, 3 a row, inside the page (phones).
    const box = (await images.first().boundingBox())!
    expect(Math.abs(box.width - box.height)).toBeLessThan(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('a tap opens the viewer: the original photo, zoom, counter, download of the original, Escape closes', async ({ page, context, log }) => {
    await context.route('https://lh3.googleusercontent.com/**', (r) =>
      r.request().url().endsWith('=d')
        ? r.fulfill({ contentType: 'image/jpeg', body: pixel, headers: { 'content-disposition': 'attachment;filename="chai.jpg"' } })
        : r.fulfill({ contentType: 'image/png', body: pixel }),
    )
    await context.route('**/api/photos', (r) =>
      r.fulfill({ json: { photos: [photo(1, '2026-09-27T13:01:03Z'), photo(2, '2026-09-26T08:00:00Z')] } }),
    )
    const viewerCode: string[] = []
    page.on('request', (r) => {
      if (/PhotoViewer-.*\.js$/.test(r.url())) viewerCode.push(r.url())
    })
    await page.goto('/')
    const tiles = page.locator('#photos a[target]').filter({ has: page.locator('img') })
    await expect(tiles).toHaveCount(2)
    await settle(page)
    expect(viewerCode).toEqual([]) // the viewer loads only when it is about to be used
    await tiles.nth(1).click()
    const viewer = page.getByRole('dialog')
    await expect(viewer).toBeVisible()
    await expect(page).toHaveURL('/') // opened here, not in a new tab
    await expect(viewer).toContainText('2 / 2')
    // The original file at once (=s0), no smaller copy first; zoom goes up to its real pixels.
    await expect(viewer.locator('img[src$="test-2=s0"]')).toHaveCount(1)
    await expect(viewer.locator('img[src*="=w"]')).toHaveCount(0)
    await expect(viewer.getByRole('button', { name: 'Zoom in' })).toBeVisible()
    // Download: the original file, as Google sends it (Content-Disposition: attachment).
    const download = page.waitForEvent('download')
    await viewer.getByRole('button', { name: 'Download' }).click()
    expect((await download).url()).toBe('https://lh3.googleusercontent.com/pw/test-2=d')
    await expectEvents(log, ['Photo open', 'Photo download'])
    await page.keyboard.press('ArrowLeft')
    await expect(viewer).toContainText('1 / 2')
    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
  })

  test('⌘K → Photos goes to the card, also a second time; with no card there is no item', async ({ page, context, log, press }) => {
    await context.route('https://lh3.googleusercontent.com/**', (r) => r.fulfill({ contentType: 'image/png', body: pixel }))
    await context.route('**/api/photos', (r) => r.fulfill({ json: { photos: [photo(1, '2026-09-27T13:01:03Z')] } }))
    await page.goto('/')
    const card = page.locator('#photos')
    await expect(card.locator('img')).toHaveCount(1)
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => scrollTo(0, 0))
      await openMenu(page, press)
      await press(page.locator('[cmdk-item]', { hasText: 'Photos' }))
      await expect(menu(page)).toHaveCount(0)
      await expect(card).toBeInViewport()
      await settle(page) // the menu gives focus back; the page must stay at the card
      await expect(card).toBeInViewport()
    }
    await expectEvents(log, ['Menu open', 'Menu: Photos', 'Menu open', 'Menu: Photos'])

    await context.unroute('**/api/photos')
    await context.route('**/api/photos', (r) => r.fulfill({ json: { photos: [] } }))
    await page.evaluate(() => localStorage.clear())
    await page.goto('/')
    await openMenu(page, press)
    await expect(page.locator('[cmdk-item]', { hasText: 'Pat the mascot' })).toBeVisible()
    await expect(page.locator('[cmdk-item]', { hasText: 'Photos' })).toHaveCount(0)
  })

  test('a photo that does not load is a plain tile: no alt text, underline or broken icon on show', async ({ page, context }) => {
    await context.route('https://lh3.googleusercontent.com/**', (r) => r.abort())
    await context.route('**/api/photos', (r) => r.fulfill({ json: { photos: [photo(1, '2026-09-27T13:01:03Z')] } }))
    await page.goto('/')
    const img = page.locator('#photos img')
    await expect(img).toHaveAttribute('alt', /Photo 1 of 1/) // screen readers still get it
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 0)).toBe(true)
    const look = await img.evaluate((el) => ({
      text: getComputedStyle(el).color,
      line: getComputedStyle(el.parentElement!).textDecorationLine,
      cover: getComputedStyle(el, '::before').content,
    }))
    expect(look).toEqual({ text: 'rgba(0, 0, 0, 0)', line: 'none', cover: '""' })
  })

  test('with no photos (or no answer from Google), there is no card', async ({ page, context }) => {
    await context.route('**/api/photos', (r) => r.fulfill({ json: { photos: [] } }))
    await page.goto('/')
    await expect(page.locator('#counts, .clock').first()).toBeVisible()
    await settle(page)
    await expect(page.locator('#photos')).toHaveCount(0)
  })

  test('the API gives the newest photos (not the album address), from the edge cache after the first time', async ({ request, isMobile }) => {
    test.skip(isMobile, 'API only; one run is enough')
    const res = await request.get('http://127.0.0.1:8787/api/photos')
    expect(res.status()).toBe(200)
    expect(res.headers()['cache-control']).toMatch(/^public, max-age=(3600|300)$/)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(['photos'])
    // Real Google: the album may be unreachable from here, then the list is empty (the card hides).
    expect(body.photos.length).toBeLessThanOrEqual(6)
    for (const p of body.photos) expect(p.url).toMatch(/^https:\/\/lh3\.googleusercontent\.com\//)
    const added = body.photos.map((p: { added: string }) => p.added)
    expect(added).toEqual([...added].sort().reverse()) // newest first
    expect(await (await request.get('http://127.0.0.1:8787/api/photos?x=1')).text()).toBe(JSON.stringify(body))
    expect((await request.post('http://127.0.0.1:8787/api/photos')).status()).toBe(405)
    // With the phone's token, Google is asked again now (the /log page's "refresh photos").
    const token = (t: string) => ({ headers: { authorization: `Bearer ${t}` } })
    expect((await request.get('http://127.0.0.1:8787/api/photos', token('wrong'))).status()).toBe(401)
    const fresh = await request.get('http://127.0.0.1:8787/api/photos', token('test-token-0123456789-abcdef'))
    expect(fresh.status()).toBe(200)
    expect(Object.keys(await fresh.json())).toEqual(['photos'])
    // No PURGE_TOKEN or ZONE_ID in the tests: renewed only in this data centre.
    expect(fresh.headers()['x-photos-refreshed']).toBe('here')
    expect(fresh.headers()['cache-tag']).toBe('photos')
  })
})

test.describe('now playing (ListenBrainz API)', () => {
  // One shared table in the local D1: run in order (and with --workers=1 when using --repeat-each).
  test.describe.configure({ mode: 'serial' })
  const api = 'http://127.0.0.1:8787/api/scrobble/1/'
  const auth = { authorization: 'token test-token-0123456789-abcdef' } // SCROBBLE_TOKEN in tests/test.env
  const listen = (title: string, extra: object = {}, durationMs = 180_000) => ({
    ...extra,
    track_metadata: { artist_name: 'Test Artist', track_name: title, additional_info: { duration_ms: durationMs } },
  })
  const submit = (request: APIRequestContext, listen_type: string, payload: unknown[]) =>
    request.post(`${api}submit-listens`, { data: { listen_type, payload }, headers: auth })
  const nowPlaying = async (request: APIRequestContext) => (await request.get('http://127.0.0.1:8787/api/now-playing')).json()
  const seconds = () => Math.floor(Date.now() / 1000)

  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'API only; one run is enough'))
  // Start with no music (the local D1 keeps its rows between runs).
  test.beforeAll(() => {
    wrangler('--command "DELETE FROM music"')
  })

  test('the token and the request are checked like ListenBrainz does', async ({ request }) => {
    expect(await (await request.get(`${api}validate-token`, { headers: auth })).json()).toMatchObject({ valid: true, user_name: 'kishore' })
    expect(await (await request.get(`${api}validate-token`, { headers: { authorization: 'token wrong' } })).json()).toMatchObject({ valid: false })
    const body = { listen_type: 'playing_now', payload: [listen('Nope')] }
    expect((await request.post(`${api}submit-listens`, { data: body })).status()).toBe(401)
    expect((await request.post(`${api}submit-listens`, { data: body, headers: { authorization: 'token test-tokeN' } })).status()).toBe(401)
    expect((await submit(request, 'x', [listen('Nope')])).status()).toBe(400)
    expect((await submit(request, 'import', [null, 'text', 42])).status()).toBe(400)
    expect((await submit(request, 'single', [listen('A', { listened_at: seconds() }), listen('B', { listened_at: seconds() })])).status()).toBe(400)
    expect((await submit(request, 'single', [listen('Too old', { listened_at: 1_000_000_000 })])).status()).toBe(400)
    expect((await submit(request, 'single', [listen('Too new', { listened_at: seconds() + 2 * 3600 })])).status()).toBe(400)
    expect((await request.get('http://127.0.0.1:8787/api/now-playing')).status()).toBe(204)
  })

  test('playing_now shows as listening for the length of the song', async ({ request, page }) => {
    const song = `Song ${Date.now()}`
    expect(await (await submit(request, 'playing_now', [listen(song)])).json()).toEqual({ status: 'ok' })
    // Pano sends the finished listen ("single") half-way through; it goes to its own row.
    await submit(request, 'single', [listen(song, { listened_at: seconds() - 90 })])
    const track = await nowPlaying(request)
    expect(track).toMatchObject({ title: song, artist: 'Test Artist' })
    expect(Date.parse(track.until) - Date.parse(track.at)).toBe(180_000)
    await page.goto('/')
    await expect(page.locator('.row', { hasText: 'listening' })).toContainText(song)
  })

  test('the same song sent again does not restart it', async ({ request }) => {
    const before = await nowPlaying(request)
    await submit(request, 'playing_now', [listen(before.title)])
    expect(await nowPlaying(request)).toEqual(before)
  })

  test('once the song is over it shows as last played, with its time', async ({ request, page }) => {
    const { title, until } = await nowPlaying(request)
    await page.clock.setFixedTime(Date.parse(until) + 2 * 3600_000) // the visitor comes two hours later
    await page.goto('/')
    const row = page.locator('.row', { hasText: 'last played' })
    await expect(row).toContainText(title)
    await expect(row).toContainText('2 hr. ago')
  })

  test('with nothing playing, the newest listen shows; older ones never replace it', async ({ request }) => {
    await submit(request, 'playing_now', [listen('Skipped at once', {}, 1)]) // expires after 1 ms
    const now = seconds()
    await submit(request, 'import', [listen('Offline A', { listened_at: now - 60 }), listen('Offline B', { listened_at: now - 30 })])
    expect(await nowPlaying(request)).toMatchObject({ title: 'Offline B' })
    await submit(request, 'import', [listen('Much older', { listened_at: now - 7200 })])
    expect(await nowPlaying(request)).toMatchObject({ title: 'Offline B' })
  })
  test('with no song and no GitHub data, the loading lines go away and nothing else shows', async ({ page }) => {
    await page.route('**/api/now-playing', (r) => r.fulfill({ status: 204 }))
    await page.route('**/api/github', (r) => r.fulfill({ status: 500 }))
    await page.goto('/')
    await expect(page.locator('.clock')).toBeVisible()
    await expect(page.locator('.row.pending')).toHaveCount(0)
    await expect(page.locator('.rows .row')).toHaveCount(1) // local time only
  })
})

// The counts card on the home page reads /api/log (logged from the /log page; tests/log.spec.ts).
test.describe('counts card', () => {
  const at = new Date().toISOString()

  test('the pre-rendered page keeps the place of the clock, the counts and the year', async ({ request }) => {
    const html = await (await request.get('http://127.0.0.1:8787/')).text()
    expect(html.match(/class="count pending"/g)).toHaveLength(4)
    expect(html).toContain('class="chai-clock pending"')
    expect(html).toContain('class="heat-box range-365"') // the grid's place; the calendar draws in the browser
  })

  test('the chai clock shows the hours of the day, with the chai glass', async ({ page, context }) => {
    await context.route('**/api/log', (r) =>
      r.fulfill({ json: logReply({ chai: { today: 2, month: 17, year: 17, total: 17, last: at, hours: chaiHours } }) }),
    )
    await page.goto('/')
    const clock = page.locator('#counts .chai-clock')
    await expect(clock.locator('svg[role="img"] path')).toHaveCount(24) // the glass in the middle has its own paths
    await expect(clock.locator('figcaption')).toHaveText('most chai at 5 pm, then 11 am')
    await expect(clock.locator('.chai-icon')).toBeVisible()
    // The glass sits inside the ring of wedges (radius 30 of 80), never over the dial.
    const glass = (await clock.locator('.chai-icon').boundingBox())!
    const dial = (await clock.locator('svg[role="img"]').boundingBox())!
    expect(glass.width).toBeLessThan(dial.width * 0.3)
    await expect(clock.locator('svg[role="img"]')).toHaveAttribute('aria-label', 'Chai by hour of the day: most at 5 pm')
    await expect(clock.locator('path.lvl-4')).toHaveCount(1)
  })

  test('my days: all kinds in one grid, the numbers first, a tap on a day says what it had', async ({ page, context }) => {
    const parotta = { today: 1, month: 4, year: 4, total: 4, last: at }
    await context.route('**/api/log', (r) =>
      r.fulfill({ json: logReply({ chai: { today: 3, month: 4, year: 4, total: 4, last: at, hours: chaiHours }, parotta }) }),
    )
    const ranges: string[] = []
    await context.route('**/api/log/days?**', (r) => {
      const range = Number(new URL(r.request().url()).searchParams.get('range'))
      ranges.push(String(range))
      return r.fulfill({
        json: daysReply(range, { [istToday()]: { chai: 3, parotta: 1 }, [daysAgo(1)]: { chai: 1 }, [daysAgo(20)]: { parotta: 3 } }),
      })
    })
    await page.goto('/')
    const card = page.locator('#year')
    const note = card.locator('.heat-day')
    await expect(card.getByRole('heading')).toHaveText('my days')
    await expect(card.getByRole('button', { name: 'all' })).toHaveAttribute('aria-pressed', 'true')
    // The year by default: 365 squares. Today had 2 of the 2 kinds: the darkest.
    await expect(card.locator('.heat rect[data-date]')).toHaveCount(365)
    await expect(card).toContainText('last 12 months')
    await expect(card.locator(`rect[data-date="${istToday()}"]`)).toHaveAttribute('data-level', '2')
    await expect(card.locator(`rect[data-date="${daysAgo(1)}"]`)).toHaveAttribute('data-level', '1')
    const tile = (label: string) => card.locator('.heat-tiles div', { has: page.getByText(label, { exact: true }) }).locator('dd')
    await expect(tile('day streak')).toHaveText('2')
    await expect(tile('best streak')).toHaveText('2')
    await expect(tile('days with something')).toHaveText('3')
    await expect(tile('days with 3+ things')).toHaveText('0')
    // Today first, with every kind it had (the chai glass for chai).
    await expect(note).toContainText('(today): 3 chai · 🫓 1 parotta')
    await expect(note.locator('.chai-icon')).toBeVisible()
    // A tap on a square says what that day had; the buttons move a day, also from the keyboard.
    await card.locator(`rect[data-date="${daysAgo(20)}"]`).click()
    await expect(note).toContainText('🫓 3 parotta')
    await expect(card.locator(`rect[data-date="${daysAgo(20)}"]`)).toHaveClass('picked')
    await card.getByRole('button', { name: 'Day before' }).focus()
    await page.keyboard.press('Enter')
    await expect(note).toContainText('nothing logged')
    await expect(card.getByRole('button', { name: 'Day after' })).not.toBeDisabled()
    // One kind alone.
    await expect(card.getByRole('button', { name: 'chai' }).locator('.chai-icon')).toBeVisible()
    await card.getByRole('button', { name: 'parotta' }).click()
    await expect(card.getByRole('heading')).toHaveText('parotta')
    await expect(tile('parotta days')).toHaveText('2')
    await expect(tile('in all')).toHaveText('4')
    await expect(tile('day streak')).toHaveText('1')
    // The year scrolls inside its card, never the page (phones). 12 weeks is asked for only when chosen.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(ranges).toEqual(['365'])
    await card.getByRole('button', { name: '12 weeks' }).click()
    await expect(card.locator('.heat rect[data-date]')).toHaveCount(84)
    await expect(card).toContainText('last 12 weeks')
    expect(ranges).toEqual(['365', '84'])
  })

  test('a day row of a kind the counts do not show (the two answers from different moments) breaks nothing', async ({ page, context }) => {
    await context.route('**/api/log', (r) => r.fulfill({ json: logReply({ chai: { today: 1, month: 1, year: 1, total: 1, last: at } }) }))
    await context.route('**/api/log/days?**', (r) =>
      r.fulfill({ json: daysReply(365, { [istToday()]: { chai: 1, parotta: 2, beach: 1, gym: 1 } }) }),
    )
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await expect(page.locator(`#year rect[data-date="${istToday()}"]`)).toHaveAttribute('data-level', '1')
    await expect(page.locator('#year .heat-day')).toContainText('(today): 1 chai')
    await expect(page.locator('#counts .count')).toHaveCount(1)
    await expect(page.locator('#year .react-activity-calendar__legend-colors')).toContainText('1 thing')
    expect(errors).toEqual([])
  })

  test('a reload shows the last counts at once, while they are asked for again (stale-while-revalidate)', async ({ page, context }) => {
    let reply = logReply({ chai: { today: 2, month: 2, year: 2, total: 2, last: at, hours: chaiHours } })
    let release: () => void = () => {}
    let gate: Promise<void> = Promise.resolve()
    await context.route('**/api/log', async (r) => {
      await gate
      await r.fulfill({ json: reply })
    })
    await page.goto('/')
    const counts = page.locator('#counts')
    await expect(counts.locator('.count', { hasText: 'chai' })).toContainText('2 today')
    // The next answer is slow: the last one shows at once, with no loading lines.
    gate = new Promise((r) => (release = r))
    reply = logReply({ chai: { today: 3, month: 3, year: 3, total: 3, last: at, hours: chaiHours } })
    await page.reload()
    await expect(counts.locator('.count', { hasText: 'chai' })).toContainText('2 today')
    await expect(counts.locator('.count.pending')).toHaveCount(0)
    await expect(page.locator('#year .heat-tiles dd').first()).not.toHaveText('\u00a0')
    release()
    await expect(counts.locator('.count', { hasText: 'chai' })).toContainText('3 today')
  })

  test('before the code runs, the loading lines match the kinds logged at the last visit', async ({ page, context }) => {
    await context.route('**/api/log', (r) =>
      r.fulfill({ json: logReply({ chai: { today: 1, month: 1, year: 1, total: 1, last: at, hours: chaiHours }, beach: { today: 1, month: 1, year: 1, total: 1, last: at } }) }),
    )
    await page.goto('/')
    await expect(page.locator('#counts .count')).toHaveCount(2)
    // Stop the app's code: what shows is the pre-rendered page and the head script only.
    await context.route('**/assets/*.js', (r) => r.abort())
    await page.reload()
    expect(await page.evaluate(() => document.documentElement.dataset.logRows)).toBe('2')
    await expect(page.locator('#counts .count.pending:visible')).toHaveCount(2)
    await expect(page.locator('#counts .chai-clock.pending')).toBeVisible()
  })

  test('on a first visit, the loading lines match the live log at build time', async ({ page, context }) => {
    await context.route('**/assets/*.js', (r) => r.abort())
    await page.goto('/')
    const rows = await page.evaluate(() => document.documentElement.dataset.logRows)
    // The build reads kichoow.com/api/log; without it (no network) every line shows.
    await expect(page.locator('#counts .count.pending:visible')).toHaveCount(rows === undefined ? 4 : Number(rows))
  })

  test('only the kinds that were logged are shown, with their numbers', async ({ page, context }) => {
    await context.route('**/api/log', (r) => r.fulfill({ json: logReply({ chai: { today: 2, month: 14, year: 90, total: 90, last: at } }) }))
    await page.goto('/')
    const card = page.locator('#counts')
    await expect(card.locator('.count')).toHaveCount(1)
    await expect(card).toContainText('2 today')
    await expect(card).toContainText('14 this month · last today')
    await expect(card).not.toContainText('parotta')
  })

  test('a once-a-day kind shows days this month and this year, with the place', async ({ page, context }) => {
    await context.route('**/api/log', (r) =>
      r.fulfill({ json: logReply({ beach: { today: 1, month: 3, year: 20, total: 20, last: at, place: 'Marina' } }) }),
    )
    await page.goto('/')
    const card = page.locator('#counts')
    await expect(card).toContainText('beach days')
    await expect(card).toContainText('3 this month')
    await expect(card).toContainText('20 this year')
    await expect(card).toContainText('Marina')
  })

  test('with nothing logged, there is no card', async ({ page, context }) => {
    await context.route('**/api/log', (r) => r.fulfill({ json: logReply({}) }))
    await page.goto('/')
    await expect(page.locator('.stats dd')).toHaveCount(2) // the page has loaded its data
    await expect(page.locator('#counts')).toHaveCount(0)
    await expect(page.locator('#year')).toHaveCount(0)
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
    for (const path of ['/', '/offline', '/nope', '/log']) {
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
    [
      'home, photo viewer open',
      '/',
      'dark',
      async (page) => {
        await page.locator('#photos a[target]').first().click()
        await expect(page.getByRole('dialog')).toBeVisible()
      },
    ],
    ['404', '/nope', 'dark'],
    ['/log, token form', '/log', 'light'],
    [
      '/log, buttons',
      '/log',
      'dark',
      async (page) => {
        await page.getByLabel('token').fill('x'.repeat(24))
        await page.getByRole('button', { name: 'save' }).click()
        await expect(page.getByRole('button', { name: /chai \+1/ })).toBeVisible()
      },
    ],
  ]
  for (const [name, path, scheme, setup] of states) {
    test(`${name}: no violations`, async ({ page, context }) => {
      // Every card with data, whatever the local D1 holds, and no real GitHub call (it can take
      // longer than the wait below): axe checks every card on every run.
      const at = new Date().toISOString()
      const totals = { today: 2, month: 14, year: 90, total: 90, last: at }
      await context.route('**/api/github', (r) => r.fulfill({ json: { repo: 'home', url: 'https://github.com/kishore280/home', at } }))
      await context.route('https://lh3.googleusercontent.com/**', (r) => r.fulfill({ contentType: 'image/png', body: pixel }))
      await context.route('**/api/photos', (r) => r.fulfill({ json: { photos: [photo(1, at), photo(2, at)] } }))
      await context.route('**/api/log', (r) =>
        r.request().method() === 'GET'
          ? r.fulfill({ json: logReply({ chai: { ...totals, hours: chaiHours }, parotta: totals, beach: { ...totals, place: 'Marina' }, badminton: totals }) })
          : r.fallback(),
      )
      await context.route('**/api/log/days?**', (r) => r.fulfill({ json: daysReply(365, { [istToday()]: { chai: 2, badminton: 1 }, [daysAgo(3)]: { parotta: 1 } }) }))
      // Reduced motion: axe checks the final colours, not a row that is still fading in.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      await page.goto(path)
      await setup?.(page)
      await expect(page.locator('.pending')).toHaveCount(0) // loaded, as a visitor sees it
      const { violations } = await new AxeBuilder({ page }).analyze()
      expect(violations.map((v) => `${v.id} (${v.impact})`)).toEqual([])
    })
  }
})
