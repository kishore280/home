// UI tests: every tap target, the ⌘K menu, the offline page, the 404 page, layout width,
// accessibility and analytics events. Runs on "desktop" and "mobile" (playwright.config.ts).
// Method: .claude/skills/ui-test (adversarial checks) and .claude/skills/webapp-testing.
import { wrangler } from './d1'
import AxeBuilder from '@axe-core/playwright'
import { mf2 } from 'microformats-parser'
import { test as base, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'

declare global {
  interface Window {
    __copies: string[]
    __buzz: (number | number[])[]
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
      // No photos by default: the real album comes from Google, and its card (which hides a photo that
      // does not load) would move the page while a test measures it. A test that needs photos adds its
      // own route, which runs first (Playwright runs the newest matching route first).
      await context.route('**/api/photos', (r) => r.fulfill({ json: { photos: [] } }))
      // No "now scrolling" by default either: the API tests below fill the shared local D1.
      await context.route('**/api/scroll', (r) => r.fulfill({ status: 204 }))
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
// The page is pre-rendered, so the mascot shows (and takes taps) before React runs; a tap then does
// nothing. Its day label ("chai time", "sleeping") renders only in the browser, so wait for it first.
async function mascotReady(page: Page) {
  await expect(page.locator('.mascot .small')).toContainText(/time|sleeping/)
}

// The JSON-LD graph of a served page (src/lib/head.ts): its nodes, by @type.
function jsonLd(html: string) {
  const ld = JSON.parse(/<script type="application\/ld\+json">(.+?)<\/script>/.exec(html)?.[1] ?? '{}')
  const nodes: Record<string, unknown>[] = ld['@graph'] ?? []
  return (type: string) => nodes.find((n) => n['@type'] === type) as Record<string, any> | undefined
}

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

  test('mascot game feel: a heart and a short buzz per pat, never more than 6 hearts; pat #100 is an achievement', async ({ page, context, press }) => {
    // The counters say 98 pats: the second pat here is the 100th.
    let pats = 98
    await context.route('**/api/counters', (r) => {
      if (r.request().method() === 'POST' && r.request().postDataJSON().key === 'pats') pats++
      return r.fulfill({ json: { views: 1, pats, updated: '2026-09-28' } })
    })
    await context.addInitScript(() => {
      window.__buzz = []
      Object.defineProperty(navigator, 'vibrate', { value: (p: number | number[]) => window.__buzz.push(p) })
    })
    await page.goto('/')
    await mascotReady(page)
    const mascot = page.getByRole('button', { name: 'Pat the mascot' })
    await expect(page.locator('.mascot .small')).toContainText('98 pats')
    await press(mascot)
    await expect(mascot.locator('.heart')).toHaveCount(1)
    await expect(mascot.locator('.heart')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('.bubble')).not.toContainText('#')
    // Pat #100: the mascot says it, with a burst of hearts and a longer buzz.
    await press(mascot)
    await expect(page.locator('.bubble.show')).toHaveText('you are the 100th! 🎉')
    await expect(page.locator('.mascot-art.big')).toHaveCount(1)
    await expect(mascot.locator('.heart')).toHaveCount(8)
    expect(await page.evaluate(() => window.__buzz)).toEqual([10, [10, 60, 30]])
    // Fast taps reuse the pool: at most 6 hearts, and a normal pat again.
    for (let i = 0; i < 10; i++) await press(mascot)
    await expect(mascot.locator('.heart')).toHaveCount(6)
    await expect(page.locator('.mascot-art.big')).toHaveCount(0)
    await expect(page.locator('.mascot .small')).toContainText('110 pats')
  })

  test('mascot eyes follow the pointer, or the last tap on a phone', async ({ page, isMobile }) => {
    await page.goto('/')
    const mascot = page.locator('.mascot')
    const lx = () => mascot.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--lx')) || 0)
    const box = (await mascot.boundingBox())!
    const y = box.y + box.height / 2
    if (isMobile) {
      await page.touchscreen.tap(2, y)
      await expect.poll(lx).toBeLessThan(-1)
      await page.touchscreen.tap(page.viewportSize()!.width - 2, y)
      await expect.poll(lx).toBeGreaterThan(1)
    } else {
      await page.mouse.move(0, y)
      await expect.poll(lx).toBeLessThan(-1)
      await page.mouse.move(page.viewportSize()!.width - 1, y)
      await expect.poll(lx).toBeGreaterThan(1)
    }
  })

  test('mascot gets dizzy after very fast pats, and gets better', async ({ page, press }) => {
    await page.goto('/')
    const mascot = page.getByRole('button', { name: 'Pat the mascot' })
    for (let i = 0; i < 7; i++) await press(mascot)
    await expect(mascot.locator('.m-dizzy')).toHaveCount(2)
    await expect(page.locator('.bubble.show')).toHaveText('whoa… dizzy')
    await expect(mascot.locator('.m-dizzy')).toHaveCount(0, { timeout: 5000 })
    await expect(mascot.locator('.m-eye')).toHaveCount(2)
  })

  test('mascot does an idle action now and then', async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await mascotReady(page)
    const mascot = page.locator('.mascot')
    await expect(mascot).not.toHaveAttribute('data-idle')
    await page.clock.fastForward(12_500)
    await expect(mascot).toHaveAttribute('data-idle', /^(twitch|flick|look)$/)
    await page.clock.fastForward(2_000)
    await expect(mascot).not.toHaveAttribute('data-idle')
  })

  test('mascot eyes stay still with reduced motion', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await mascotReady(page)
    await page.mouse.move(0, 200)
    await settle(page)
    expect(await page.locator('.mascot').evaluate((el) => getComputedStyle(el).getPropertyValue('--lx'))).toBe('')
  })

  test('mascot: every 100th pat of all is "you are the …th", and the 10th pat of one visitor gets a thank-you', async ({ page, context, press }) => {
    let pats = 299
    await context.route('**/api/counters', (r) => {
      if (r.request().method() === 'POST' && r.request().postDataJSON().key === 'pats') pats++
      return r.fulfill({ json: { views: 1, pats } })
    })
    await page.goto('/')
    await mascotReady(page)
    const mascot = page.getByRole('button', { name: 'Pat the mascot' })
    await expect(page.locator('.mascot .small')).toContainText('299 pats')
    await press(mascot)
    await expect(page.locator('.bubble.show')).toHaveText('you are the 300th! 🎉')
    // A long line stays inside the card (it starts further left).
    await expect(page.locator('.bubble.show')).toHaveCSS('scale', '1')
    const card = (await page.locator('.side > *').first().boundingBox())!
    const bubble = (await page.locator('.bubble').boundingBox())!
    expect(bubble.x).toBeGreaterThanOrEqual(card.x)
    expect(bubble.x + bubble.width).toBeLessThanOrEqual(card.x + card.width)
    for (let i = 0; i < 9; i++) await press(mascot)
    await expect(page.locator('.bubble.show')).toHaveText('10 pats from you ♥')
    await expect(page.locator('.mascot .count-pop')).toHaveText('309')
  })

  test('mascot: hold it to make it purr; the hold is not a pat', async ({ page, log, isMobile }) => {
    test.skip(isMobile, 'mouse hold')
    await page.goto('/')
    await mascotReady(page)
    const mascot = page.getByRole('button', { name: 'Pat the mascot' })
    const box = (await mascot.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect(page.locator('.bubble.show')).toHaveText('purrr… ♥')
    await expect(page.locator('.mascot-art.purr')).toHaveCount(1)
    await page.mouse.up()
    await settle(page)
    expect(log.posts).toEqual(['views'])
    await expectEvents(log, ['Mascot purr'])
  })

  test('mascot: the Konami code gives it a party hat', async ({ page, log, isMobile }) => {
    test.skip(isMobile, 'keyboard')
    await page.goto('/')
    await mascotReady(page)
    await expect(page.locator('.m-hat')).toHaveCount(0)
    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
      await page.keyboard.press(key)
    }
    await expect(page.locator('.m-hat')).toHaveCount(1)
    await expect(page.locator('.bubble.show')).toHaveText('cheat unlocked! 🎉')
    await expectEvents(log, ['Mascot Konami code'])
  })

  test('mascot: a visitor back after a day is welcomed, a first visit is not', async ({ page, context }) => {
    await page.goto('/')
    await settle(page)
    await expect(page.locator('.bubble.show')).toHaveCount(0)
    await context.addInitScript(() => localStorage.setItem('mascot-seen', String(Date.now() - 2 * 86_400_000)))
    await page.reload()
    await expect(page.locator('.bubble.show')).toHaveText('welcome back! ♥')
  })

  test('the 88×31 buttons move (and stop with reduced motion); each has a looping GIF for other sites', async ({ page }) => {
    await page.goto('/')
    await mascotReady(page)
    const files = await page.locator('.buttons img').evaluateAll((els) =>
      els.map((e) => (e as HTMLImageElement).src).filter((s) => /\/button[^/]*\.svg$/.test(s)),
    )
    expect(files.length).toBeGreaterThan(0)
    // Fetched in the page: the test site's host name leads to the local server only there.
    const get = (url: string) =>
      page.evaluate(async (u) => {
        const r = await fetch(u)
        return { type: r.headers.get('content-type'), text: await r.clone().text(), bytes: [...new Uint8Array(await r.arrayBuffer())] }
      }, url)
    for (const src of files) {
      const svg = (await get(src)).text
      expect(svg).toContain('@keyframes')
      expect(svg).toContain('prefers-reduced-motion: reduce')
      expect(Number(/data-loop="([\d.]+)"/.exec(svg)?.[1])).toBeGreaterThan(0)
      const gif = await get(src.replace(/\.svg$/, '.gif'))
      expect(gif.type).toBe('image/gif')
      const bytes = Buffer.from(gif.bytes)
      expect(bytes.subarray(0, 6).toString()).toBe('GIF89a')
      expect([bytes.readUInt16LE(6), bytes.readUInt16LE(8)]).toEqual([88, 31]) // the logical screen size
      expect(bytes.includes(Buffer.from('NETSCAPE2.0'))).toBe(true) // loops forever
    }
  })


  test('button-wall tools find the buttons in /.well-known/button.json (IETF draft 00), with a GIF and its SHA-256 each', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('kish')
    const info = await page.evaluate(async () => {
      const r = await fetch('/.well-known/button.json')
      const json = await r.json()
      const checked = []
      for (const b of json.buttons) {
        const gif = await fetch(new URL(b.uri).pathname)
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await gif.arrayBuffer()))]
          .map((x) => x.toString(16).padStart(2, '0'))
          .join('')
        checked.push({ id: b.id, alt: b.alt, gif: gif.headers.get('content-type'), same: hash === b.sha256, hotlink: b.hotlink })
      }
      return { type: r.headers.get('content-type'), cors: r.headers.get('access-control-allow-origin'), schema: json.$schema, def: json.default, checked }
    })
    expect(info.type).toContain('application/json')
    expect(info.cors).toBe('*')
    expect(info.schema).toContain('draft-filmroellchen-lunar-well-known-button-00.schema.json')
    expect(info.checked.length).toBeGreaterThan(0)
    expect(info.checked.map((b) => b.id)).toContain(info.def)
    for (const b of info.checked) expect(b).toEqual({ id: expect.any(String), alt: expect.stringMatching(/\S/), gif: 'image/gif', same: true, hotlink: true })
  })

  test('slash pages: the footer leads to /now and /colophon; the profile links say rel="me"', async ({ page, press, request }) => {
    await page.goto('/')
    for (const l of await page.getByRole('navigation', { name: 'Elsewhere' }).getByRole('link').all()) {
      await expect(l).toHaveAttribute('rel', /(^| )me( |$)/)
    }
    const more = page.getByRole('navigation', { name: 'More about kish' })
    await press(more.getByRole('link', { name: 'now' }))
    await expect(page).toHaveURL('/now')
    await expect(page).toHaveTitle('now · kish')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('now')
    await expect(page.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/)
    await page.goto('/')
    await press(page.getByRole('navigation', { name: 'More about kish' }).getByRole('link', { name: 'colophon' }))
    await expect(page).toHaveURL('/colophon')
    await expect(page.getByRole('heading', { level: 2 })).not.toHaveCount(0)
    await press(page.getByRole('link', { name: /back to kish/ }))
    await expect(page).toHaveURL('/')
    // Both are in the sitemap, with a canonical address each.
    const sitemap = await (await request.get('http://127.0.0.1:8787/sitemap.xml')).text()
    for (const path of ['/now', '/colophon']) {
      expect(sitemap).toContain(`https://kichoow.com${path}<`)
      // Its date is the page's own "Updated" date, not the build time.
      const lastmod = new RegExp(`<loc>https://kichoow\\.com${path}</loc>\\s*<lastmod>([\\d-]+)</lastmod>`).exec(sitemap)?.[1]
      await page.goto(path)
      await expect(page.locator('.text-page time')).toHaveAttribute('datetime', lastmod!)
    }
  })

  test('IndieWeb tools read an h-card from the served HTML: name, address, photo and the rel="me" profiles', async ({ page, request }) => {
    const html = await (await request.get('http://127.0.0.1:8787/')).text()
    const { items, rels } = mf2(html, { baseUrl: 'https://kichoow.com/' })
    const card = items.find((i) => i.type?.includes('h-card'))
    expect(card?.properties).toMatchObject({
      name: ['kishore'],
      nickname: ['kish'],
      uid: ['https://kichoow.com/'],
      photo: ['https://kichoow.com/icon-512.png'],
      note: ['hands-on with AI agents development.'],
      'job-title': ['Software engineer'],
      locality: ['Chennai'],
    })
    expect(card?.properties.url).toEqual(['https://kichoow.com/', ...(rels.me ?? [])])
    // Search engines read the same facts from the JSON-LD Person.
    // One linked graph: the page is about the Person, on the WebSite (named "kish" for Google).
    const node = jsonLd(html)
    expect(node('ProfilePage')).toMatchObject({ mainEntity: { '@id': 'https://kichoow.com/#person' }, isPartOf: { '@id': 'https://kichoow.com/#website' } })
    expect(node('WebSite')).toMatchObject({ '@id': 'https://kichoow.com/#website', name: 'kish', alternateName: 'Kishore M', publisher: { '@id': 'https://kichoow.com/#person' } })
    expect(node('ProfilePage')?.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/) // a real change date, not the build time
    expect(node('Person')).toMatchObject({
      '@id': 'https://kichoow.com/#person',
      name: 'Kishore M',
      jobTitle: 'Software engineer',
      homeLocation: { address: { addressLocality: 'Chennai', addressCountry: 'IN' } },
      sameAs: rels.me,
    })
    // The <data> tags draw nothing: the heading still reads as before.
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('hi, i’m kishore')
  })

  test('blinkies and stamps: each moves, has a looping GIF of its size, and a click copies its code', async ({ page, press, log, isMobile }) => {
    await page.goto('/')
    const card = page.locator('.card', { has: page.getByRole('heading', { name: 'blinkies & stamps' }) })
    const items = card.locator('button.badge')
    await expect(items).toHaveCount(8)
    const sizes = await items.locator('img').evaluateAll((els) =>
      els.map((e) => ({ src: (e as HTMLImageElement).src, w: (e as HTMLImageElement).width, h: (e as HTMLImageElement).height })),
    )
    for (const { src, w, h } of sizes) {
      expect([w, h]).toEqual(w === 150 ? [150, 20] : [99, 56]) // a blinkie or a stamp
      const { svg, gif } = await page.evaluate(async (u) => {
        const svg = await (await fetch(u)).text()
        const bytes = [...new Uint8Array(await (await fetch(u.replace(/\.svg$/, '.gif'))).arrayBuffer())]
        return { svg, gif: bytes }
      }, src)
      expect(svg).toContain('@keyframes')
      expect(svg).toContain('prefers-reduced-motion: reduce')
      expect(svg).not.toContain('<text') // words are shapes: an image cannot load a font
      const bytes = Buffer.from(gif)
      expect(bytes.subarray(0, 6).toString()).toBe('GIF89a')
      expect([bytes.readUInt16LE(6), bytes.readUInt16LE(8)]).toEqual([w, h])
    }
    await press(items.nth(7)) // the stamp, after the 7 blinkies
    const copied = await page.evaluate(() => window.__copies)
    expect(copied[0]).toContain('/stamp-badminton.gif" width="99" height="56"')
    // A mouse passes over it first (its hover counts, as for the buttons); a finger does not.
    await expectEvents(log, [...(isMobile ? [] : ['Stamp hover: badminton ate my knees']), 'Stamp copy: badminton ate my knees'])
  })

  test('mascot hearts are hidden with reduced motion', async ({ page, press }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await mascotReady(page)
    const mascot = page.getByRole('button', { name: 'Pat the mascot' })
    await press(mascot)
    await expect(mascot.locator('.heart')).toHaveCount(1)
    await expect(mascot.locator('.heart')).toBeHidden()
  })

  test('88×31 button copies its embed code and counts it', async ({ page, log, press, isMobile }) => {
    await page.goto('/')
    const button = page.locator('.b88').nth(4)
    const label = await button.getAttribute('data-caption')
    await press(button)
    await expect(page.locator('[data-sonner-toast]')).toContainText('copied')
    const copied = await page.evaluate(() => window.__copies)
    expect(copied).toHaveLength(1)
    expect(copied[0]).toContain('http://kichoow.com/button-parotta.gif')
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
    ['Now', { events: ['Menu: Now'], posts: ['views'], url: '/now' }],
    ['Colophon', { events: ['Menu: Colophon'], posts: ['views'], url: '/colophon' }],
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

test.describe('blog', () => {
  test('the home card lists the newest posts; /blog lists them all by year; each opens its post', async ({ page, press }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && /hydrat|did not match/i.test(m.text()) && errors.push(m.text()))
    await page.goto('/')
    const card = page.locator('.card', { has: page.getByRole('heading', { name: 'writing' }) })
    const first = card.locator('.post-rows a').first()
    await expect(first).toBeVisible()
    expect(await card.locator('.post-rows li').count()).toBeLessThanOrEqual(3)
    await expect(card.locator('.post-rows time').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/)
    await expect(page.getByRole('navigation', { name: 'More about kish' }).getByRole('link', { name: 'blog' })).toHaveAttribute('href', '/blog')
    const title = await first.textContent()
    await card.getByRole('link', { name: 'all posts →' }).click()
    await expect(page).toHaveURL('/blog')
    await expect(page).toHaveTitle('writing · kish')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('writing')
    await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(/^\d{4}$/)
    await expect(page.getByRole('link', { name: 'RSS feed' })).toHaveAttribute('href', '/blog/rss.xml')
    // "back to kish's corner" sits under the card, as on /now and /colophon.
    const back = page.getByRole('link', { name: /back to kish/ })
    await expect(back).toBeVisible()
    await expect(page.locator('.blog-page').getByRole('link', { name: /back to kish/ })).toHaveCount(0)
    await page.getByRole('link', { name: title! }).click()
    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!)
    await expect(page).toHaveTitle(`${title} · kish`)
    await expect(page.locator('.post-meta')).toContainText(/min read/)
    await expect(page.locator('.post-by')).toContainText('written by kish with')
    await expect(page.locator('.post-by .chai-icon')).toBeVisible()
    await expect(page.locator('.blog-page').getByRole('link', { name: /back to kish/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /back to kish/ })).toBeVisible()
    // Code is coloured at build time (Shiki, Rosé Pine: Dawn in light, Moon in dark), and a button copies it.
    const code = page.locator('.prose .code').first()
    await expect(code.locator('pre.shiki')).toHaveClass(/rose-pine-dawn rose-pine-moon/)
    // The copy button sits inside the block (no margin above it), and the scrollbar is thin and lavender.
    const [pre, btn] = [(await code.locator('pre').boundingBox())!, (await code.locator('.copy').boundingBox())!]
    expect(btn.y).toBeGreaterThan(pre.y)
    expect(await code.locator('pre').evaluate((e) => [getComputedStyle(e).scrollbarWidth, getComputedStyle(e).scrollbarColor])).toEqual(['thin', expect.stringMatching(/^(rgb|color)/)])
    await press(code.getByRole('button', { name: 'copy' }))
    await expect(code.getByRole('button', { name: 'copied' })).toBeVisible()
    expect(await page.evaluate(() => window.__copies)).toEqual([await code.locator('pre').innerText()])
    await page.getByRole('link', { name: 'writing', exact: false }).first().click()
    await expect(page).toHaveURL('/blog')
    expect(errors).toEqual([])
  })

  test('every page for search is ready for AI tools: long snippets, a Markdown copy, llms.txt from any page', async ({ request }) => {
    const get = (path: string) => request.get(`http://127.0.0.1:8787${path}`)
    const post = '/blog/show-what-you-listen-to-with-pano-scrobbler'
    for (const [path, md] of [['/', '/index.md'], ['/now', '/now.md'], ['/colophon', '/colophon.md'], ['/blog', '/blog.md'], [post, `${post}.md`]]) {
      const res = await get(path)
      const html = await res.text()
      // Google may show long quotes and large images from it (AI Overviews quote from snippets).
      expect(html, path).toContain('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">')
      expect(html, path).toContain(`<link rel="alternate" type="text/markdown" href="https://kichoow.com${md}">`)
      expect(res.headers()['link'], path).toBe('</llms.txt>; rel="describedby"; type="text/plain"')
      // The Markdown copy: readable, kept out of search, and it names the page to cite.
      const copy = await get(md)
      expect(copy.headers()['content-type'], md).toBe('text/markdown; charset=utf-8')
      expect(copy.headers()['x-robots-tag'], md).toBe('noindex')
      expect(await copy.text(), md).toContain(`canonical: https://kichoow.com${path === '/' ? '/' : path}\n`)
    }
    // Private and secret pages stay out of search.
    expect(await (await get('/offline')).text()).not.toContain('max-snippet')
    // llms.txt lists every page's copy; llms-full.txt has them all.
    const llms = await (await get('/llms.txt')).text()
    for (const md of ['/index.md', '/now.md', '/colophon.md', '/blog.md']) expect(llms).toContain(`(https://kichoow.com${md})`)
    expect(await (await get('/llms-full.txt')).text()).toContain('canonical: https://kichoow.com/now\n')
    // /blog is a CollectionPage listing every post; a post says its length and section.
    const list = jsonLd(await (await get('/blog')).text())
    const items = list('CollectionPage')?.mainEntity.itemListElement.map((i: { url: string }) => i.url)
    expect(items).toContain(`https://kichoow.com${post}`)
    expect(list('CollectionPage')?.mainEntity.numberOfItems).toBe(items.length)
    const one = await (await get(post)).text()
    expect(jsonLd(one)('BlogPosting')).toMatchObject({ articleSection: 'writing', wordCount: expect.any(Number) })
    expect(one).toContain('<meta property="article:author" content="https://kichoow.com/">')
  })

  test('a post is for search engines, feed readers and IndieWeb tools: BlogPosting, canonical, RSS, h-entry, sitemap', async ({ request }) => {
    const post = '/blog/show-what-you-listen-to-with-pano-scrobbler'
    const html = await (await request.get(`http://127.0.0.1:8787${post}`)).text()
    const node = jsonLd(html)
    const ld = node('BlogPosting')!
    expect(ld).toMatchObject({ author: { '@id': 'https://kichoow.com/#person' }, isPartOf: { '@id': 'https://kichoow.com/blog#blog' }, url: `https://kichoow.com${post}` })
    expect(node('Person')).toMatchObject({ '@id': 'https://kichoow.com/#person', name: 'Kishore M' })
    expect(node('BreadcrumbList')?.itemListElement.map((i: { item: string }) => i.item)).toEqual(['https://kichoow.com/', 'https://kichoow.com/blog', `https://kichoow.com${post}`])
    expect(ld.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(html).toContain(`<link rel="canonical" href="https://kichoow.com${post}">`)
    expect(html).toContain('application/rss+xml')
    // Its own share card: a 1200×630 PNG drawn at build time (blog.ts).
    const card = `/og/blog/show-what-you-listen-to-with-pano-scrobbler.png`
    expect(html).toContain(`<meta property="og:image" content="https://kichoow.com${card}">`)
    expect(ld.image).toBe(`https://kichoow.com${card}`)
    const png = Buffer.from(await (await request.get(`http://127.0.0.1:8787${card}`)).body())
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
    // The text is in the served HTML (pre-rendered), not only after JavaScript.
    const { items } = mf2(html, { baseUrl: 'https://kichoow.com/' })
    const entry = items.find((i) => i.type?.includes('h-entry'))
    expect(entry?.properties.name).toEqual([ld.headline])
    expect(entry?.properties.published).toEqual([ld.datePublished])
    expect(JSON.stringify(entry?.properties.content)).toContain('Pano Scrobbler')
    // The feed and the sitemap list it; the template page and an unknown post are not pages.
    const rss = await request.get('http://127.0.0.1:8787/blog/rss.xml')
    expect(rss.headers()['content-type']).toContain('xml')
    expect(await rss.text()).toContain(`<link>https://kichoow.com${post}</link>`)
    expect(await (await request.get('http://127.0.0.1:8787/sitemap.xml')).text()).toContain(`<loc>https://kichoow.com${post}</loc>`)
    // For AI tools: a Markdown copy (front matter with the canonical address), kept out of search,
    // and every post in llms-full.txt; llms.txt points to both.
    expect(html).toContain(`<link rel="alternate" type="text/markdown" href="https://kichoow.com${post}.md">`)
    const md = await request.get(`http://127.0.0.1:8787${post}.md`)
    expect(md.headers()['content-type']).toBe('text/markdown; charset=utf-8')
    expect(md.headers()['x-robots-tag']).toBe('noindex')
    const text = await md.text()
    expect(text).toMatch(new RegExp(`^---\\n[\\s\\S]*canonical: https://kichoow\\.com${post}\\n---\\n\\n# ${ld.headline}\\n`))
    expect(text).toContain('`GET /1/validate-token`') // the Markdown as written, not HTML
    const full = await request.get('http://127.0.0.1:8787/llms-full.txt')
    expect(full.headers()['x-robots-tag']).toBe('noindex')
    expect(await full.text()).toContain(text)
    const llms = await (await request.get('http://127.0.0.1:8787/llms.txt')).text()
    expect(llms).toContain(`(https://kichoow.com${post}.md)`)
    expect(llms).toContain('https://kichoow.com/llms-full.txt')
    expect((await request.get('http://127.0.0.1:8787/post')).status()).toBe(404)
    expect((await request.get('http://127.0.0.1:8787/blog/nope')).status()).toBe(404)
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
    await page.route('**/api/scroll', (r) => r.fulfill({ json: { scrolling: true, app: 'instagram', today: 12, minutes: 2, perReel: 9, at, binge: { reels: 3, started: at } } }))
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
    await expect(page.locator('.row', { hasText: 'brain rotting' })).toBeVisible()
    await expect(page.locator('.row.pending')).toHaveCount(0)
    await expect(page.locator('.count')).toHaveCount(Object.keys(reply(totals)).length) // the logged kinds
    await expect(page.locator('.count.pending')).toHaveCount(0)
    await expect(page.locator('.chai-clock figcaption')).toBeVisible()
    await expect(page.locator(`#year rect[data-date="${istToday()}"]`)).toHaveAttribute('data-level', String(Object.keys(today).length))
    await expect(page.locator('#year .heat-day')).toContainText('(today)')
    await expect(page.locator('.stats dd')).toHaveCount(2)
    await expect(page.locator('#photos img')).toHaveCount(2)
    await settle(page)
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.001)
  })

  // A performance budget, kept in the tests so a change that adds weight fails here and has to
  // say why (web.dev "Performance budgets 101"). 410 KB is just above today's 403 KB of JavaScript
  // (before compression) that the home page loads, the lazy chunks included. Raised from 400 KB for
  // the blog's "writing" card (about 4 KB, 2026-09-29). The heatmap library's
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
    expect(total, scripts.map((e) => `${e.name.split('/').pop()} ${e.bytes}`).join(', ')).toBeLessThan(410_000)
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
    // Fewer than 6: a "see all" tile fills the row and opens the viewer at the first photo.
    await card.getByRole('button', { name: 'see all' }).click()
    await expect(page.getByRole('dialog')).toContainText('1 / 2')
    await page.keyboard.press('Escape')
    // Squares, 3 a row, inside the page (phones).
    const box = (await images.first().boundingBox())!
    expect(Math.abs(box.width - box.height)).toBeLessThan(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('a big album: 5 polaroids and a "+N" tile that opens the viewer at photo 6, which swipes through all', async ({ page, context, log, isMobile }) => {
    await context.route('https://lh3.googleusercontent.com/**', (r) => r.fulfill({ contentType: 'image/png', body: pixel }))
    const album = Array.from({ length: 9 }, (_, i) => photo(i + 1, `2026-09-${String(20 - i).padStart(2, '0')}T08:00:00Z`))
    await context.route('**/api/photos', (r) => r.fulfill({ json: { photos: album } }))
    await page.goto('/')
    const card = page.locator('#photos')
    await expect(card.locator('li')).toHaveCount(6)
    await expect(card.locator('img')).toHaveCount(5)
    await expect(card.locator('img').first()).toHaveAttribute('alt', /^Photo 1 of 9 /)
    const more = card.getByRole('button', { name: '+4 more' })
    await expect(more).toBeVisible()
    // Polaroids in 1 row on a wide screen, 2 rows of 3 on a phone.
    // A new row starts where a polaroid's top is more than half a polaroid below the one before
    // (tilted polaroids in one row differ by a few pixels, so rounding can split a row).
    const rows = await card.locator('li').evaluateAll((els) => {
      const boxes = els.map((e) => e.getBoundingClientRect()).sort((a, b) => a.top - b.top)
      return boxes.filter((b, i) => i === 0 || b.top - boxes[i - 1].top > b.height / 2).length
    })
    expect(rows).toBe(isMobile ? 2 : 1)
    await more.click()
    const viewer = page.getByRole('dialog')
    await expect(viewer).toContainText('6 / 9')
    for (const n of [7, 8, 9]) {
      await page.keyboard.press('ArrowRight') // one at a time: a key press during a slide is ignored
      await expect(viewer).toContainText(`${n} / 9`)
    }
    await expectEvents(log, ['Photo more'])
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

  test('a video in the album: a play mark, it plays in the viewer (1080p, else 720p, 360p) with no Referer, the download is the original', async ({ page, context, log }) => {
    const referers: (string | undefined)[] = []
    await context.route('https://lh3.googleusercontent.com/**', (r) =>
      /=(dv|m\d\d)$/.test(r.request().url()) && referers.push(r.request().headers().referer)
        ? r.fulfill({ contentType: 'video/mp4', body: Buffer.alloc(0), headers: { 'content-disposition': 'attachment;filename="ride.mp4"' } })
        : r.fulfill({ contentType: 'image/png', body: pixel }),
    )
    await context.route('**/api/photos', (r) =>
      r.fulfill({ json: { photos: [{ ...photo(1, '2026-09-27T13:01:03Z'), video: true }, photo(2, '2026-09-26T08:00:00Z')] } }),
    )
    await page.goto('/')
    const tiles = page.locator('#photos a[target]')
    await expect(tiles).toHaveCount(2)
    await expect(tiles.first().locator('.play')).toBeVisible()
    await expect(tiles.nth(1).locator('.play')).toHaveCount(0)
    await expect(tiles.first().locator('img')).toHaveAttribute('alt', /^Video 1 of 2 /)
    await expect(tiles.first()).toHaveAttribute('href', 'https://lh3.googleusercontent.com/pw/test-1=m37') // without JavaScript
    await tiles.first().click()
    const viewer = page.getByRole('dialog')
    const video = viewer.locator('video')
    await expect(video).toHaveAttribute('poster', 'https://lh3.googleusercontent.com/pw/test-1=s1920')
    await expect(video).toHaveAttribute('controls')
    expect(await video.locator('source').evaluateAll((s) => s.map((e) => (e as HTMLSourceElement).src.split('=')[1]))).toEqual(['m37', 'm22', 'm18'])
    // Google's video servers answer 403 to another site's Referer, so the page sends none.
    await expect(page.locator('head meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
    await expect.poll(() => referers.length).toBeGreaterThan(0)
    expect(referers.every((r) => r === undefined)).toBe(true)
    const download = page.waitForEvent('download')
    await viewer.getByRole('button', { name: 'Download' }).click()
    expect((await download).url()).toBe('https://lh3.googleusercontent.com/pw/test-1=dv')
    await expectEvents(log, ['Video open', 'Photo download'])
    await page.keyboard.press('ArrowRight') // a photo after a video is still a photo
    await expect(viewer.locator('img[src$="test-2=s0"]')).toHaveCount(1)
  })

  test('a photo that does not load is hidden; with none loaded there is no card', async ({ page, context }) => {
    await context.route('https://lh3.googleusercontent.com/**', (r) =>
      r.request().url().includes('test-1') ? r.abort() : r.fulfill({ contentType: 'image/png', body: pixel }),
    )
    await context.route('**/api/photos', (r) =>
      r.fulfill({ json: { photos: [photo(1, '2026-09-27T13:01:03Z'), photo(2, '2026-09-26T08:00:00Z')] } }),
    )
    await page.goto('/')
    const card = page.locator('#photos')
    await card.scrollIntoViewIfNeeded() // the photos load lazily, near the screen
    await expect(card.locator('img')).toHaveCount(1)
    await expect(card.locator('img')).toHaveAttribute('src', /test-2/)
    await expect(card.locator('img')).toHaveAttribute('alt', /^Photo 1 of 1 /)

    // New photos, which the browser has never loaded: photo 2 could come from its memory cache
    // without a request, so it would never fail.
    await context.unroute('https://lh3.googleusercontent.com/**')
    await context.route('https://lh3.googleusercontent.com/**', (r) => r.abort())
    await context.unroute('**/api/photos')
    await context.route('**/api/photos', (r) =>
      r.fulfill({ json: { photos: [photo(3, '2026-09-27T13:01:03Z'), photo(4, '2026-09-26T08:00:00Z')] } }),
    )
    await page.reload()
    await page.locator('footer').scrollIntoViewIfNeeded()
    await expect(card).toHaveCount(0)
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
    expect(body.photos.length).toBeLessThanOrEqual(60) // SHOWN in worker/photos.ts: the viewer swipes up to 60
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

test.describe('now scrolling (the phone\'s Brainrot app)', () => {
  // Shared tables in the local D1: run in order.
  test.describe.configure({ mode: 'serial' })
  const api = 'http://127.0.0.1:8787/api/scroll'
  const auth = { authorization: 'Bearer test-token-0123456789-abcdef' } // SCROBBLE_TOKEN in tests/test.env
  const report = (request: APIRequestContext, data: object) => request.post(api, { data, headers: auth })
  const read = async (request: APIRequestContext) => {
    const r = await request.get(api)
    return r.status() === 204 ? null : r.json()
  }
  const beat = (started: number, reels: number, today: number, extra: object = {}) => ({ app: 'instagram', scrolling: true, reels, today, minutes: 6, perReel: 11, started, ...extra })
  const stop = (started: number, reels: number, today: number, ended = Date.now()) => ({ ...beat(started, reels, today), scrolling: false, ended })
  const sql = (query: string) => JSON.parse(wrangler(`--json --command "${query}"`))[0].results
  const iso = (ms: number) => new Date(ms).toISOString()

  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'API only; one run is enough'))
  test.beforeAll(() => {
    wrangler('--command "DELETE FROM scroll_now; DELETE FROM scroll_binges"')
  })

  test('only the phone can report, and only a valid report is kept', async ({ request }) => {
    const ok = beat(Date.now(), 0, 0)
    expect((await request.post(api, { data: ok })).status()).toBe(401)
    expect((await request.post(api, { data: ok, headers: { authorization: 'Bearer wrong' } })).status()).toBe(401)
    expect((await report(request, { ...ok, app: 'tiktok' })).status()).toBe(400)
    expect((await report(request, { ...ok, reels: -1 })).status()).toBe(400)
    expect((await report(request, { ...ok, scrolling: 'yes' })).status()).toBe(400)
    expect((await report(request, { ...ok, started: Date.now() + 2 * 3600_000 })).status()).toBe(400)
    expect((await report(request, { ...ok, scrolling: false, ended: ok.started - 1 })).status()).toBe(400)
    expect((await request.put(api, { data: ok, headers: auth })).status()).toBe(405)
    expect(await read(request)).toBeNull()
  })

  test("scrolling shows today's total and this binge; a stop keeps the binge as the last one", async ({ request }) => {
    const started = Date.now() - 60_000
    expect(await (await report(request, beat(started, 0, 30))).json()).toEqual({ status: 'ok' })
    await report(request, beat(started, 12, 42))
    expect(await read(request)).toMatchObject({ scrolling: true, app: 'instagram', today: 42, minutes: 6, perReel: 11, binge: { reels: 12, started: iso(started) } })

    const ended = Date.now()
    await report(request, { ...stop(started, 14, 44, ended), extra: 'ignored' })
    expect(await read(request)).toEqual({
      scrolling: false, app: 'instagram', today: 44, minutes: 6, perReel: 11, at: iso(ended), binge: { reels: 14, started: iso(started) },
    })
    expect(sql('SELECT COUNT(*) AS n FROM scroll_now')).toEqual([{ n: 0 }])
  })

  test('a retried stop updates its binge, never adds a second one', async ({ request }) => {
    const started = Date.now() - 30_000
    await report(request, stop(started, 5, 49))
    await report(request, stop(started, 6, 50)) // the same binge, sent again
    expect(sql(`SELECT reels, today FROM scroll_binges WHERE started = ${started}`)).toEqual([{ reels: 6, today: 50 }])
  })

  test('an unchanged heartbeat does not write again until the row is 90 s old', async ({ request }) => {
    const started = Date.now()
    await report(request, beat(started, 2, 52))
    const [{ at }] = sql('SELECT at FROM scroll_now')
    await report(request, beat(started, 2, 52)) // nothing changed
    expect(sql('SELECT at FROM scroll_now')).toEqual([{ at }])
    wrangler('--command "UPDATE scroll_now SET at = at - 100000"') // the row is 100 s old
    await report(request, beat(started, 2, 52))
    expect(sql('SELECT at FROM scroll_now')[0].at).toBeGreaterThan(at)
    wrangler('--command "DELETE FROM scroll_now"')
  })

  test('an app that sends no day numbers still works: today is its binge', async ({ request }) => {
    await report(request, { app: 'instagram', scrolling: true, reels: 3, started: Date.now() })
    expect(await read(request)).toMatchObject({ scrolling: true, today: 3, minutes: null, perReel: null })
    wrangler('--command "DELETE FROM scroll_now"') // newer than the next test's binges
  })

  test('a late heartbeat or stop from an older binge never replaces a newer one', async ({ request }) => {
    const older = Date.now() - 120_000
    const newer = Date.now() - 10_000
    await report(request, beat(newer, 3, 53))
    await report(request, beat(older, 99, 99)) // late beat
    expect(await read(request)).toMatchObject({ scrolling: true, today: 53 })
    await report(request, stop(older, 99, 99, older + 1)) // late stop: history only
    expect(await read(request)).toMatchObject({ scrolling: true, today: 53 })
    // A binge with no reels ends quietly: the last one with reels stays.
    await report(request, stop(newer, 0, 53))
    expect(await read(request)).toMatchObject({ scrolling: false, today: 50 })
  })

  test('when the phone goes quiet, an open binge stops showing as scrolling', async ({ request }) => {
    wrangler('--command "DELETE FROM scroll_binges"') // no finished binge newer than this one
    await report(request, beat(Date.now(), 5, 55))
    wrangler('--command "UPDATE scroll_now SET at = at - 200000"') // its last beat 3+ min ago
    expect(await read(request)).toMatchObject({ scrolling: false, today: 55, binge: { reels: 5 } })
  })

  test('binges are kept for good (for a data story later), however old', async ({ request }) => {
    const old = Date.now() - 400 * 24 * 3600_000
    wrangler(`--command "INSERT INTO scroll_binges (started, app, reels, today, ended) VALUES (${old}, 'instagram', 1, 1, ${old + 1})"`)
    await report(request, stop(Date.now() - 5000, 2, 57))
    expect(sql(`SELECT COUNT(*) AS n FROM scroll_binges WHERE started = ${old}`)).toEqual([{ n: 1 }])
    wrangler(`--command "DELETE FROM scroll_binges WHERE started = ${old}"`)
  })
})

test.describe('now scrolling card', () => {
  const at = Date.parse('2026-09-29T10:00:00Z') // 15:30 in India
  const iso = (ms: number) => new Date(ms).toISOString()
  const row = (page: Page) => page.locator('.row', { has: page.locator('img.brain') })
  const scroll = (reply: object) => ({ app: 'instagram', minutes: 6, perReel: 11, at: iso(at), binge: { reels: 12, started: iso(at - 4 * 60_000) }, ...reply })

  test("while scrolling: today's total; the binge floats in on hover or tap, with no layout shift", async ({ page, isMobile }) => {
    await page.route('**/api/scroll', (r) => r.fulfill({ json: scroll({ scrolling: true, today: 36 }) }))
    await page.clock.setFixedTime(at + 20_000)
    await page.goto('/')
    await expect(row(page).locator('dt')).toHaveText('brain rotting')
    await expect(row(page).locator('dd')).toHaveText('36 reels today')
    await expect(row(page).locator('img')).toHaveAttribute('src', '/brain/2.webp') // 25+ reels today: stage 2
    await expect(row(page).locator('img')).toHaveClass(/live/)
    await expect.poll(() => row(page).locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(44) // the sprite loaded
    const binge = page.getByRole('tooltip')
    await expect(binge).toHaveText('this binge: 12 reels in 4 min · about 11 s per reel')
    await expect(binge).toHaveCSS('opacity', '0')
    const card = page.locator('.card', { has: row(page) })
    const height = (await card.boundingBox())!.height
    if (isMobile) await row(page).tap()
    else await row(page).hover()
    await expect(binge).toHaveCSS('opacity', '1')
    expect((await card.boundingBox())!.height).toBe(height) // it floats: nothing moves
    await expect(row(page)).toHaveAttribute('aria-describedby', (await binge.getAttribute('id'))!)
  })

  test("after: today's total and when; the binge is the last one", async ({ page }) => {
    await page.route('**/api/scroll', (r) => r.fulfill({ json: scroll({ scrolling: false, today: 1, minutes: 0, perReel: null, binge: { reels: 1, started: iso(at - 30_000) } }) }))
    await page.clock.setFixedTime(at + 2 * 3600_000)
    await page.goto('/')
    await expect(row(page).locator('dt')).toHaveText('last rot')
    await expect(row(page).locator('dd')).toHaveText('1 reel today · 2 hr. ago')
    await expect(page.getByRole('tooltip')).toHaveText('last binge: 1 reel in 1 min') // nothing to average from one reel
    await expect(row(page).locator('img')).not.toHaveClass(/live/)
  })

  test('a quiet phone (3 min) is not "brain rotting", even from a cached answer', async ({ page }) => {
    await page.route('**/api/scroll', (r) => r.fulfill({ json: scroll({ scrolling: true, today: 12 }) }))
    await page.clock.setFixedTime(at + 4 * 60_000)
    await page.goto('/')
    await expect(row(page).locator('dt')).toHaveText('last rot')
    await expect(row(page).locator('dd')).toHaveText('12 reels today · 4 min. ago')
    await expect(page.getByRole('tooltip')).toHaveText('last binge: 12 reels in 4 min · about 11 s per reel')
  })

  test("on a new day (India time) yesterday's reels are not today's", async ({ page }) => {
    await page.route('**/api/scroll', (r) => r.fulfill({ json: scroll({ scrolling: false, today: 80 }) }))
    await page.clock.setFixedTime(Date.parse('2026-09-30T01:00:00Z')) // 06:30 the next day in India
    await page.goto('/')
    await expect(row(page).locator('dd')).toHaveText('none today · 15 hr. ago')
    await expect(row(page).locator('img')).toHaveAttribute('src', '/brain/0.webp')
    await expect(page.getByRole('tooltip')).toHaveText('last binge: 12 reels in 4 min') // yesterday's per-reel time is not today's
  })

  test('a binge with no reels yet shows no hover line, and the row takes no focus', async ({ page }) => {
    await page.route('**/api/scroll', (r) => r.fulfill({ json: scroll({ scrolling: true, today: 5, binge: { reels: 0, started: iso(at) } }) }))
    await page.clock.setFixedTime(at + 10_000)
    await page.goto('/')
    await expect(row(page).locator('dd')).toHaveText('5 reels today')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await expect(row(page)).not.toHaveAttribute('tabindex', /./)
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
    await expect(card.locator('dl')).toHaveCount(0) // no number tiles, only the grid
    // The year scrolls inside its card, never the page (phones). 12 weeks is asked for only when chosen.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(ranges).toEqual(['365'])
    await card.getByRole('button', { name: '12 weeks' }).click()
    await expect(card.locator('.heat rect[data-date]')).toHaveCount(84)
    await expect(card).toContainText('last 12 weeks')
    expect(ranges).toEqual(['365', '84'])
  })

  test('my days: a chai logged while the page is open shows in the grid at the next minute, like the counts', async ({ page, context }) => {
    let logged = false
    const earlier = new Date(Date.parse(at) - 3600_000).toISOString()
    await context.route('**/api/log', (r) =>
      r.fulfill({ json: logReply({ chai: { today: logged ? 1 : 0, month: 1, year: 1, total: 1, last: logged ? at : earlier } }) }),
    )
    const asked: string[] = []
    await context.route('**/api/log/days?**', (r) => {
      asked.push(new URL(r.request().url()).searchParams.get('v')!)
      return r.fulfill({ json: daysReply(365, logged ? { [daysAgo(1)]: { chai: 1 }, [istToday()]: { chai: 1 } } : { [daysAgo(1)]: { chai: 1 } }) })
    })
    await page.clock.install()
    await page.goto('/')
    const note = page.locator('#year .heat-day')
    await expect(note).toContainText('(today): nothing logged')
    // A chai from the phone; the counts ask again a minute later and see the newer entry.
    // (runFor, not fastForward: SWR sets its next timer only after each answer.)
    logged = true
    await page.clock.runFor(61_000)
    await expect(page.locator('#counts')).toContainText('1 today')
    await expect(note).toContainText('(today): 1 chai')
    await expect(page.locator(`#year rect[data-date="${istToday()}"]`)).toHaveAttribute('data-level', '1')
    // The new entry's time is in the URL, so no cached copy from before it can answer.
    expect(asked).toEqual([earlier, at])
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
    await expect(page.locator(`#year rect[data-date="${istToday()}"]`)).toHaveCount(1) // the saved days, at once
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
    for (const path of ['/', '/offline', '/nope', '/log', '/now', '/colophon', '/blog', '/blog/show-what-you-listen-to-with-pano-scrobbler']) {
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
    ['/now', '/now', 'light'],
    ['/colophon', '/colophon', 'dark'],
    ['/blog', '/blog', 'light'],
    ['a blog post', '/blog/show-what-you-listen-to-with-pano-scrobbler', 'dark'],
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
