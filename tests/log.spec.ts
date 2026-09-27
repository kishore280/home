// /api/log (worker/log.ts) and the /log page: the phone logs chai, parotta and beach days; the site
// reads the totals. API requests go straight to the local server (playwright.config.ts); the page
// runs in the test browser as kichoow.com.
import { execSync } from 'node:child_process'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const api = 'http://127.0.0.1:8787/api/log'
// The phone's one token, SCROBBLE_TOKEN (tests/test.env), as on the live site.
const auth = { authorization: 'Bearer test-token-0123456789-abcdef' }
const post = (request: APIRequestContext, data: unknown, path = '') =>
  request.post(`${api}${path}`, { data, headers: auth })
// GET /api/log lists every kind; here as { chai: totals | null, … } (null: never logged).
type Kind = { kind: string; emoji: string; label: string; onceADay: boolean; last: string | null; place: string | null } & Record<
  'today' | 'month' | 'year' | 'total',
  number
>
const byKind = ({ kinds }: { kinds: Kind[] }): Record<string, Kind | null> =>
  Object.fromEntries(kinds.map((k) => [k.kind, k.last ? k : null]))
const summary = async (request: APIRequestContext) => {
  const res = await request.get(api)
  expect(res.headers()['cache-control']).toBe('public, max-age=15')
  return byKind(await res.json())
}
const counts = (n: number) => ({ today: n, month: n, year: n, total: n })
// A wrangler command on the local D1. The test server has the same database file open, so SQLite
// can answer SQLITE_BUSY ("the database file is locked"); its docs say to try again, so we do.
function wrangler(args: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return execSync(`npx wrangler d1 execute home --local ${args}`, { encoding: 'utf8', stdio: 'pipe' })
    } catch (error) {
      const out = `${(error as { stdout?: string }).stdout}${(error as { stderr?: string }).stderr}`
      if (attempt === 5 || !out.includes('SQLITE_BUSY')) throw error
      execSync('sleep 0.5')
    }
  }
}
const sql = (command: string) => wrangler(`--json --command "${command}"`)

// One shared pair of tables in the local D1: run in order (and with --workers=1 when using --repeat-each).
test.describe.configure({ mode: 'serial' })
test.beforeEach(({ isMobile }) => test.skip(isMobile, 'API only; one run is enough'))
// Start with no entries (the local D1 keeps its rows between runs).
test.beforeAll(() => {
  sql('DELETE FROM log_entries; DELETE FROM log_totals')
})

const chai = crypto.randomUUID()
const parotta = crypto.randomUUID()

test('a POST needs the token; other methods are refused', async ({ request }) => {
  const body = { id: crypto.randomUUID(), kind: 'chai' }
  expect((await request.post(api, { data: body })).status()).toBe(401)
  expect((await request.post(api, { data: body, headers: { authorization: 'Bearer wrong' } })).status()).toBe(401)
  expect((await request.post(api, { data: body, headers: { authorization: 'token test-token-0123456789-abcdef' } })).status()).toBe(401)
  const undo = await request.post(`${api}/undo`, { data: { id: body.id } })
  expect(undo.status()).toBe(401)
  expect(await undo.json()).toHaveProperty('error')
  expect((await request.put(api, { data: body, headers: auth })).status()).toBe(405)
  expect((await request.get(`${api}/undo`)).status()).toBe(405)
})

test('before any log every kind is empty', async ({ request }) => {
  const res = await request.get(api)
  if (res.status() !== 204) expect(byKind(await res.json())).toEqual({ chai: null, parotta: null, beach: null, badminton: null })
})

test('a chai counts in today, month, year and total', async ({ request }) => {
  // The scheme is case-insensitive (RFC 9110, 11.1).
  const res = await request.post(api, { data: { id: chai, kind: 'chai' }, headers: { authorization: 'bearer test-token-0123456789-abcdef' } })
  expect(res.headers()['cache-control']).toBe('no-store')
  const body = await res.json()
  // The reply has the new totals of that day and month, for the page's "· 1 today".
  expect(body).toMatchObject({ ok: true, id: chai, kind: 'chai', count: 1, today: 1, month: 1 })
  expect(Math.abs(Date.parse(body.at) - Date.now())).toBeLessThan(60_000)
  const { chai: totals, parotta: none } = await summary(request)
  expect(totals).toMatchObject(counts(1))
  expect(totals?.last).toBe(body.at)
  expect(totals).toMatchObject({ emoji: '☕', label: 'chai', onceADay: false, place: null })
  expect(none).toBeNull()
})

test('parotta keeps its count', async ({ request }) => {
  expect(await (await post(request, { id: parotta, kind: 'parotta', count: 3 })).json()).toMatchObject({ ok: true, count: 3 })
  expect((await summary(request)).parotta).toMatchObject(counts(3))
})

test('the same id sent again is counted once', async ({ request }) => {
  const id = crypto.randomUUID()
  expect(await (await post(request, { id, kind: 'chai' })).json()).toMatchObject({ ok: true, id })
  expect(await (await post(request, { id, kind: 'chai' })).json()).toEqual({ ok: true, duplicate: true })
  expect(await (await post(request, { id: chai, kind: 'chai', count: 5 })).json()).toEqual({ ok: true, duplicate: true })
  // Sent twice at once (the queue replays while the first is in flight): still one.
  const twice = { id: crypto.randomUUID(), kind: 'chai' }
  const replies = await Promise.all([post(request, twice), post(request, twice)])
  expect(replies.map((r) => r.status())).toEqual([200, 200])
  expect((await summary(request)).chai).toMatchObject(counts(3))
  await post(request, { id: twice.id }, '/undo')
  expect((await summary(request)).chai).toMatchObject(counts(2))
})

test('a beach day counts once, with its place', async ({ request }) => {
  const first = await (await post(request, { id: crypto.randomUUID(), kind: 'beach', count: 4, place: '  Marina  ' })).json()
  expect(first).toMatchObject({ ok: true, kind: 'beach', count: 1 })
  expect(await (await post(request, { id: crypto.randomUUID(), kind: 'beach', place: 'Besant Nagar' })).json()).toEqual({ ok: true, duplicate: true })
  expect((await summary(request)).beach).toMatchObject({ ...counts(1), onceADay: true, last: first.at, place: 'Marina' })
})

test('undo deletes the entry, and a once-a-day kind can be logged again', async ({ request }) => {
  const id = crypto.randomUUID()
  await post(request, { id, kind: 'chai' })
  await post(request, { id }, '/undo')
  expect(JSON.parse(sql(`SELECT count(*) AS n FROM log_entries WHERE client_id = '${id}'`))[0].results[0].n).toBe(0)
  // The beach day from the test above, undone, frees the day.
  const [beach] = JSON.parse(sql(`SELECT client_id FROM log_entries WHERE kind = 'beach'`))[0].results
  await post(request, { id: beach.client_id }, '/undo')
  expect((await summary(request)).beach).toBeNull()
  const again = await (await post(request, { id: crypto.randomUUID(), kind: 'beach', place: 'Elliot' })).json()
  expect(again).toMatchObject({ ok: true, kind: 'beach', month: 1 })
  expect((await summary(request)).beach).toMatchObject({ ...counts(1), place: 'Elliot' })
})

test('the totals follow every write, also one typed in the D1 Console (triggers)', async ({ request }) => {
  const before = (await summary(request)).chai
  const total = before?.total ?? 0
  // A chai typed by hand: only kind and time; the day and the totals follow by themselves.
  const at = Date.now() - 2 * 3600_000
  sql(`INSERT INTO log_entries (client_id, kind, count, at) VALUES ('console-1', 'chai', 2, ${at})`)
  expect((await summary(request)).chai?.total).toBe(total + 2)
  // Fixed by hand to the day before: it leaves today and counts on that day.
  sql(`UPDATE log_entries SET at = at - 86400000 WHERE client_id = 'console-1'`)
  const [moved] = JSON.parse(sql(`SELECT day FROM log_entries WHERE client_id = 'console-1'`))[0].results
  const [dayTotal] = JSON.parse(sql(`SELECT count FROM log_totals WHERE kind = 'chai' AND grain = 'day' AND period = '${moved.day}'`))[0].results
  expect(dayTotal.count).toBe(2)
  expect((await summary(request)).chai?.today).toBe(before?.today)
  sql(`DELETE FROM log_entries WHERE client_id = 'console-1'`)
  expect((await summary(request)).chai?.total).toBe(total)
  // The once-a-day rule holds in the Console too.
  // (wrangler prints the refusal on stdout and exits with an error.)
  const refusal = (() => {
    try {
      return sql(`INSERT INTO log_entries (kind, at) VALUES ('beach', ${Date.now()})`)
    } catch (error) {
      return String((error as { stdout?: string }).stdout)
    }
  })()
  expect(refusal).toContain('once a day')
})

test('each entry keeps the time zone of the phone', async ({ request }) => {
  const id = crypto.randomUUID()
  await post(request, { id, kind: 'chai', tz: 'Europe/Paris' })
  expect(JSON.parse(sql(`SELECT tz FROM log_entries WHERE client_id = '${id}'`))[0].results[0].tz).toBe('Europe/Paris')
  await post(request, { id }, '/undo')
  const res = await post(request, { id: crypto.randomUUID(), kind: 'chai', tz: 'Mars/Olympus' })
  expect(res.status()).toBe(400)
})

test('the rollups are kept per grain, so a range of days reads only day rows', async () => {
  const rows = JSON.parse(sql(`SELECT grain, period FROM log_totals WHERE kind = 'chai' ORDER BY grain`))[0].results
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(Date.now())
  expect(rows).toEqual([
    { grain: 'all', period: 'all' },
    { grain: 'day', period: day },
    { grain: 'month', period: day.slice(0, 7) },
    { grain: 'year', period: day.slice(0, 4) },
  ])
  // What a year heatmap would ask: only day rows, by primary key.
  const range = `SELECT period FROM log_totals WHERE kind = 'chai' AND grain = 'day' AND period BETWEEN '${day.slice(0, 4)}-01-01' AND '${day.slice(0, 4)}-12-31'`
  expect(JSON.parse(sql(range))[0].results).toEqual([{ period: day }])
  expect(sql(`EXPLAIN QUERY PLAN ${range}`)).toContain('USING PRIMARY KEY')
})

test('the chai clock counts each hour of the day in IST, also for fixes in the Console', async ({ request }) => {
  const hours = async () => ((await (await request.get(api)).json()).kinds as { kind: string; hours: number[] }[]).find((k) => k.kind === 'chai')!.hours
  const before = await hours()
  expect(before).toHaveLength(24)
  // 12:00 UTC is 17:30 IST (or a minute ago, if that is still to come today).
  const at = Math.min(Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`), Date.now() - 60_000)
  sql(`INSERT INTO log_entries (client_id, kind, count, at) VALUES ('clock-1', 'chai', 3, ${at})`)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(at))
  expect((await hours())[hour]).toBe(before[hour] + 3)
  // Moved an hour later by hand: the clock follows.
  sql(`UPDATE log_entries SET at = at + 3600000 WHERE client_id = 'clock-1'`)
  const moved = await hours()
  expect(moved[hour]).toBe(before[hour])
  expect(moved[(hour + 1) % 24]).toBe(before[(hour + 1) % 24] + 3)
  sql(`DELETE FROM log_entries WHERE client_id = 'clock-1'`)
  expect(await hours()).toEqual(before)
})

test('the heatmap reads the day totals of every kind for 84 or 365 days, from the edge cache after the first time', async ({ request }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(Date.now())
  for (const range of [84, 365]) {
    const res = await request.get(`${api}/days?range=${range}`)
    expect(res.headers()['cache-control']).toBe('public, max-age=60')
    const body = await res.json()
    expect(body.to).toBe(today)
    expect((Date.parse(body.to) - Date.parse(body.from)) / 86_400_000).toBe(range - 1)
    for (const [day, kind, count] of body.days as [string, string, number][]) {
      expect(day >= body.from && day <= body.to).toBe(true)
      expect(typeof kind).toBe('string')
      expect(count).toBeGreaterThan(0)
    }
  }
  expect((await (await request.get(`${api}/days`)).json()).to).toBe(today) // 84 by default
  expect((await request.get(`${api}/days?range=7`)).status()).toBe(400)
  expect((await request.post(`${api}/days`)).status()).toBe(405)
  // A page from before this change (?kind=) still gets its old answer: [day, count], 365 days, sorted.
  const old = await (await request.get(`${api}/days?kind=chai`)).json()
  expect(old).toMatchObject({ kind: 'chai', to: today })
  expect((Date.parse(old.to) - Date.parse(old.from)) / 86_400_000).toBe(364)
  for (const row of old.days) expect(row).toHaveLength(2)
  // The same range again comes from the cache (Workers Cache API): the same body, even with other
  // things in the URL, and no new rows read.
  const first = await (await request.get(`${api}/days?range=84`)).text()
  expect(await (await request.get(`${api}/days?range=84&x=1`)).text()).toBe(first)
})

test('badminton days (migrations/0006): once a day, like beach days, and the migration is safe to run twice', async ({ request }) => {
  wrangler('--file migrations/0006_badminton.sql') // a second run changes nothing
  const kinds = (await (await request.get(api)).json()).kinds as { kind: string; emoji: string; label: string; onceADay: boolean }[]
  expect(kinds.map((k) => k.kind)).toEqual(['chai', 'parotta', 'beach', 'badminton']) // the order on the site
  expect(kinds.find((k) => k.kind === 'badminton')).toMatchObject({ emoji: '🏸', label: 'badminton days', onceADay: true })
  const first = await (await post(request, { id: crypto.randomUUID(), kind: 'badminton', place: 'SDAT court' })).json()
  expect(first).toMatchObject({ ok: true, kind: 'badminton', count: 1 })
  expect(await (await post(request, { id: crypto.randomUUID(), kind: 'badminton' })).json()).toEqual({ ok: true, duplicate: true })
  expect((await summary(request)).badminton).toMatchObject({ ...counts(1), onceADay: true, place: 'SDAT court' })
  await post(request, { id: first.id }, '/undo')
  expect((await summary(request)).badminton).toBeNull()
})

test('a new kind is one row in log_kinds, no code change', async ({ request }) => {
  sql(`INSERT INTO log_kinds (kind, emoji, label, once_a_day, sort) VALUES ('gym', '🏋️', 'gym', 0, 9)`)
  try {
    expect(await (await post(request, { id: crypto.randomUUID(), kind: 'gym' })).json()).toMatchObject({ ok: true, today: 1 })
    expect((await summary(request)).gym).toMatchObject({ ...counts(1), emoji: '🏋️', label: 'gym' })
  } finally {
    sql(`DELETE FROM log_totals WHERE kind = 'gym'; DELETE FROM log_entries WHERE kind = 'gym'; DELETE FROM log_kinds WHERE kind = 'gym'`)
  }
})

test('undo takes an entry back once', async ({ request }) => {
  expect(await (await post(request, { id: parotta }, '/undo')).json()).toEqual({ ok: true, id: parotta })
  const after = await summary(request)
  expect(after.parotta).toBeNull()
  expect(await (await post(request, { id: parotta }, '/undo')).json()).toEqual({ ok: true, missing: true })
  expect(await (await post(request, { id: crypto.randomUUID() }, '/undo')).json()).toEqual({ ok: true, missing: true })
  expect(await summary(request)).toEqual(after)
  // Logged again with a new id, it counts from zero.
  await post(request, { id: crypto.randomUUID(), kind: 'parotta', count: 2 })
  expect((await summary(request)).parotta).toMatchObject(counts(2))
})

test('bad requests are refused and change nothing', async ({ request }) => {
  const before = await summary(request)
  const id = crypto.randomUUID()
  const now = Date.now()
  for (const data of [
    { id, kind: 'coffee' },
    { id, kind: 'chai', count: 0 },
    { id, kind: 'chai', count: 21 },
    { id, kind: 'chai', count: 1.5 },
    { id, kind: 'chai', at: now - 2 * 24 * 3600_000 },
    { id, kind: 'chai', at: now + 3600_000 },
    { id, kind: 'chai', at: 'now' },
    { id, kind: 'beach', place: 'x'.repeat(61) },
    { kind: 'chai' },
    { id: '', kind: 'chai' },
    { id: 'x'.repeat(65), kind: 'chai' },
    [],
  ]) {
    const res = await post(request, data)
    expect(res.status(), JSON.stringify(data)).toBe(400)
    expect(await res.json()).toHaveProperty('error')
  }
  expect((await post(request, {}, '/undo')).status()).toBe(400)
  const big = await request.post(api, { data: { id, kind: 'chai', place: 'x'.repeat(3000) }, headers: auth })
  expect(big.status()).toBe(413)
  expect(await summary(request)).toEqual(before)
})

test('an entry from the offline queue keeps its time, and "last" stays the newest', async ({ request }) => {
  const last = (await summary(request)).chai?.last
  const at = Date.now() - 3600_000
  expect(await (await post(request, { id: crypto.randomUUID(), kind: 'chai', at })).json()).toMatchObject({ at: new Date(at).toISOString() })
  // It arrived late but happened earlier: the newest chai is still the one before.
  expect((await summary(request)).chai?.last).toBe(last)
  expect((await summary(request)).chai?.total).toBe(3)
})

test('totals never go below zero', async ({ request }) => {
  const id = crypto.randomUUID()
  await post(request, { id, kind: 'chai', count: 20 })
  await post(request, { id }, '/undo')
  await post(request, { id }, '/undo')
  expect((await summary(request)).chai?.total).toBe(3)
  expect(JSON.parse(sql('SELECT count(*) AS n FROM log_totals WHERE count < 0'))[0].results[0].n).toBe(0)
})

test('without its tables, a log says what to set up instead of failing', async ({ request }) => {
  sql('DROP TABLE log_totals')
  const res = await post(request, { id: crypto.randomUUID(), kind: 'chai' })
  expect(res.status()).toBe(503)
  expect((await res.json()).error).toBe('Logging is not set up yet: run migrations/0004_log.sql in the D1 Console.')
  wrangler('--file migrations/0004_log.sql')
  expect((await post(request, { id: crypto.randomUUID(), kind: 'chai' })).status()).toBe(200)
})

// The /log page. It shares the local D1 with the tests above, so it starts from empty tables too.
test.describe('the /log page', () => {
  const TOKEN = 'test-token-0123456789-abcdef' // SCROBBLE_TOKEN in tests/test.env
  const chaiToday = async (request: APIRequestContext) => (await summary(request)).chai?.today ?? 0
  const button = (page: Page, name: RegExp) => page.getByRole('button', { name })
  // As if the token was saved on this phone before; navigator.vibrate records the buzz.
  const signedIn = (page: Page) =>
    page.addInitScript((token) => {
      localStorage.setItem('log-token:v1', token)
      ;(window as unknown as { buzz: unknown[] }).buzz = []
      navigator.vibrate = (pattern) => ((window as unknown as { buzz: unknown[] }).buzz.push(pattern), true)
    }, TOKEN)

  test.beforeAll(() => sql('DELETE FROM log_entries; DELETE FROM log_totals'))

  test('without a token it asks for one; a wrong token is refused and asked again', async ({ page, request }) => {
    await page.goto('/log')
    await expect(button(page, /chai \+1/)).toHaveCount(0)
    // The keyboard never learns the token.
    await expect(page.getByLabel('token')).toHaveAttribute('spellcheck', 'false')
    await page.getByLabel('token').fill('wrong-token-but-long-enough')
    await page.getByRole('button', { name: 'save' }).click()
    await button(page, /chai \+1/).click()
    await expect(page.getByText('That token is not right. Enter it again.')).toBeVisible()
    await expect(page.getByLabel('token')).toBeVisible()
    expect(await chaiToday(request)).toBe(0)
  })

  test('a tap logs at once with a buzz, and Undo takes it back', async ({ page, request }) => {
    await signedIn(page)
    await page.goto('/log')
    await button(page, /chai \+1/).click()
    const toast = page.locator('[data-sonner-toast]', { hasText: 'chai +1 · 1 today' })
    await expect(toast).toBeVisible()
    await expect(toast.locator('.chai-icon')).toBeVisible() // the chai glass, not the ☕ cup
    await expect.poll(() => chaiToday(request)).toBe(1)
    await expect(page.locator('#counts')).toContainText('1 today')
    expect(await page.evaluate(() => (window as unknown as { buzz: unknown[] }).buzz)).toEqual([30])
    await toast.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Undone')).toBeVisible()
    await expect.poll(() => chaiToday(request)).toBe(0)
  })

  test('a beach day keeps its place; a second one the same day is refused', async ({ page }) => {
    await signedIn(page)
    await page.goto('/log')
    await page.getByLabel('beach / badminton place (optional)').fill('Marina')
    await button(page, /beach day/).click()
    await expect(page.locator('[data-sonner-toast]', { hasText: 'beach +1 · 1 this month' })).toBeVisible()
    await expect(page.locator('#counts')).toContainText('Marina')
    await expect(page.getByLabel('beach / badminton place (optional)')).toHaveValue('')
    await button(page, /beach day/).click()
    await expect(page.getByText('today is already a beach day')).toBeVisible()
  })

  test('a badminton day has its own button, with the court as the place', async ({ page }) => {
    await signedIn(page)
    await page.goto('/log')
    await page.getByLabel('beach / badminton place (optional)').fill('SDAT court')
    await button(page, /badminton day/).click()
    await expect(page.locator('[data-sonner-toast]', { hasText: 'badminton +1 · 1 this month' })).toBeVisible()
    await expect(page.locator('#counts')).toContainText('badminton days')
    await expect(page.locator('#counts')).toContainText('SDAT court')
    await button(page, /badminton day/).click()
    await expect(page.getByText('today is already a badminton day')).toBeVisible()
  })

  test('with no signal, the log waits and is sent when the network is back', async ({ page, context, request }) => {
    await signedIn(page)
    await page.goto('/log')
    // The service worker must control the page to keep the request (as on a phone after the first visit).
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
    })
    const before = await chaiToday(request)
    await context.setOffline(true)
    await button(page, /chai \+1/).click()
    await expect(page.getByText('no signal, it will be sent when you are back online')).toBeVisible()
    expect(await chaiToday(request)).toBe(before)
    await context.setOffline(false)
    // Chrome fires the queue's sync event when it sees the network again; in the test browser, ask
    // for it (Workbox's tag: "workbox-background-sync:<queue name>").
    await page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> }
      }
      await registration.sync.register('workbox-background-sync:log')
    })
    await expect.poll(() => chaiToday(request), { timeout: 20_000 }).toBe(before + 1)
  })

  test('a shortcut link logs only in the installed app', async ({ page, request }) => {
    await signedIn(page)
    const before = await chaiToday(request)
    // In a browser tab, a link to /log?add=chai does nothing (a link on another site cannot add chai).
    await page.goto('/log?add=chai')
    await expect(page).toHaveURL('/log')
    await page.waitForTimeout(600)
    expect(await chaiToday(request)).toBe(before)
    // In the installed app (display-mode: standalone), the long-press shortcut logs it.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window)
      window.matchMedia = (query) =>
        query.includes('display-mode: standalone') ? ({ ...real(query), matches: true, media: query } as MediaQueryList) : real(query)
    })
    await page.goto('/log?add=chai')
    await expect(page.locator('[data-sonner-toast]', { hasText: 'chai +1' })).toBeVisible()
    await expect(page).toHaveURL('/log')
    await expect.poll(() => chaiToday(request)).toBe(before + 1)
  })

  test('the log app has its own manifest with the shortcuts, and stays out of search', async ({ request }) => {
    const origin = 'http://127.0.0.1:8787'
    const manifest = await (await request.get(`${origin}/log.webmanifest`)).json()
    expect(manifest).toMatchObject({ start_url: '/log', scope: '/log', display: 'standalone' })
    // In order of use: Chrome for Android shows only the first 3 (web.dev "App shortcuts").
    expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(['/log?add=chai', '/log?add=parotta', '/log?add=beach', '/log?add=badminton'])
    const html = await (await request.get(`${origin}/log`)).text()
    expect(html).toContain('<link rel="manifest" href="/log.webmanifest">')
    expect(html).toContain('noindex, nofollow')
    expect(await (await request.get(`${origin}/sitemap.xml`)).text()).not.toContain('/log')
    expect(await (await request.get(`${origin}/`)).text()).toContain('<link rel="manifest" href="/manifest.webmanifest">')
  })
})
