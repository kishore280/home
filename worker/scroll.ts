// /api/scroll — "now scrolling" from the phone (the Brainrot app's SiteReporter, github.com/kishore280/brainRot).
//   POST  Bearer SCROBBLE_TOKEN, {app, scrolling, reels, started, ended, today, minutes, perReel}:
//         "scrolling" when Reels opens and every 30 s, then "stopped". `reels` is this binge;
//         `today`, `minutes` and `perReel` are today so far, as on the app's Today screen.
//   GET   today so far; scrolling now (a fresh heartbeat) or the last binge; 204: nothing yet.
// Storage (migrations/0009_scroll_binges.sql) keeps the live state apart from the history, as presence
// systems do: `scroll_now` (one row, the heartbeat) and `scroll_binges` (one row per finished binge).
// Rows: a heartbeat writes at most 1 (none when nothing changed and the last write is under 90 s old);
// a stop writes 1–2; a GET reads 2, and visitors share a 30 s copy
// from the data centre's cache (Workers Cache API), which a POST clears.
import { bearer, fail, json, tokenMatches, type Env } from './db'

const APPS = ['instagram'] // the only app the phone counts
const MAX_REELS = 100_000
const SKEW_MS = 60 * 60_000 // a phone clock up to 1 h ahead, as for the music
const FRESH_MS = 3 * 60_000 // six missed heartbeats: the phone went quiet, the binge is over
const REFRESH_MS = 90_000 // an unchanged heartbeat still refreshes the row this often

type Row = { app: string; reels: number; today: number; minutes: number | null; per_reel: number | null; started: number; at: number }
type Report = Partial<Record<'app' | 'scrolling' | 'reels' | 'started' | 'ended' | 'today' | 'minutes' | 'perReel', unknown>>

const count = (v: unknown) => (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= MAX_REELS ? (v as number) : null)
// One cache key for every visitor; the version starts a new cache when the answer's shape changes.
const cacheKey = (request: Request) => new Request(new URL('/api/scroll?v=2', request.url))

export async function scroll(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method === 'GET') return read(request, env, ctx)
  if (request.method !== 'POST') return fail('Use GET or POST.', 405)
  if (!(await tokenMatches(bearer(request), env.SCROBBLE_TOKEN))) return fail('Invalid token.', 401)

  const body = (await request.json().catch(() => null)) as Report | null
  const now = Date.now()
  const time = (v: unknown) => (Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= now + SKEW_MS ? (v as number) : null)
  const app = typeof body?.app === 'string' && APPS.includes(body.app) ? body.app : null
  const reels = count(body?.reels)
  const started = time(body?.started)
  if (!app || reels === null || started === null || typeof body?.scrolling !== 'boolean') {
    return fail('Send app, scrolling, reels and started.')
  }
  // An app from before today's numbers sends only this binge's count.
  const today = count(body.today) ?? reels
  const minutes = count(body.minutes)
  const perReel = count(body.perReel)

  if (body.scrolling) {
    // A late heartbeat from an older binge never replaces a newer one, and an unchanged heartbeat
    // writes only when the row is getting old.
    await env.DB.prepare(
      `INSERT INTO scroll_now (id, app, reels, today, minutes, per_reel, started, at) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(id) DO UPDATE SET app = ?1, reels = ?2, today = ?3, minutes = ?4, per_reel = ?5, started = ?6, at = ?7
       WHERE ?6 > scroll_now.started
          OR (?6 = scroll_now.started AND (?2 != scroll_now.reels OR ?3 != scroll_now.today OR scroll_now.at < ?7 - ?8))`,
    )
      .bind(app, reels, today, minutes, perReel, started, now, REFRESH_MS)
      .run()
  } else {
    const ended = time(body.ended)
    if (ended === null || ended < started) return fail('A stopped binge needs ended, after started.')
    // The binge is over: drop it from "now" (not a newer one), and keep it if it counted anything (a
    // retried stop updates the same row). Binges are kept for good (the 0009 migration said 30 days),
    // for a data story later (#91): about 20 small rows a day.
    const statements = [env.DB.prepare('DELETE FROM scroll_now WHERE id = 1 AND started <= ?1').bind(started)]
    if (reels > 0) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO scroll_binges (started, app, reels, today, minutes, per_reel, ended) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(started) DO UPDATE SET app = ?2, reels = ?3, today = ?4, minutes = ?5, per_reel = ?6, ended = ?7`,
        ).bind(started, app, reels, today, minutes, perReel, ended),
      )
    }
    await env.DB.batch(statements)
  }
  // Visitors in this data centre see it at once; elsewhere within 30 s.
  ctx.waitUntil(caches.default.delete(cacheKey(request)))
  return json({ status: 'ok' })
}

async function read(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const key = cacheKey(request)
  const cached = await caches.default.match(key)
  if (cached) return cached

  const [live, last] = await env.DB.batch<Row>([
    env.DB.prepare('SELECT app, reels, today, minutes, per_reel, started, at FROM scroll_now WHERE id = 1'),
    env.DB.prepare('SELECT app, reels, today, minutes, per_reel, started, ended AS at FROM scroll_binges ORDER BY ended DESC LIMIT 1'),
  ]).then(
    (r) => r.map((x) => x.results[0]),
    () => [undefined, undefined], // before the tables exist (migration not applied yet): no data
  )
  const now = Date.now()
  const open = live && now - live.at < FRESH_MS ? live : undefined
  // The newest numbers: the open binge, else the one that ended last (a quiet phone's binge counts
  // only if nothing newer ended).
  const row = open ?? [live, last].filter((r) => r !== undefined).sort((a, b) => b.at - a.at)[0]
  if (!row) return new Response(null, { status: 204 })
  const iso = (ms: number) => new Date(ms).toISOString()
  const response = Response.json(
    {
      scrolling: Boolean(open),
      app: row.app,
      today: row.today,
      minutes: row.minutes,
      perReel: row.per_reel,
      at: iso(row.at),
      binge: { reels: row.reels, started: iso(row.started) },
    },
    { headers: { 'cache-control': 'public, max-age=30' } },
  )
  ctx.waitUntil(caches.default.put(key, response.clone()))
  return response
}
