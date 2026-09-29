// /api/scroll — "now scrolling" from the phone (the Brainrot app's SiteReporter, github.com/kishore280/brainRot).
//   POST  Bearer SCROBBLE_TOKEN, {app, scrolling, reels, started, ended, today, minutes, perReel}:
//         "scrolling" when Reels opens and every 30 s, then "stopped". `reels` is this sitting;
//         `today`, `minutes` and `perReel` are today so far, as on the app's Today screen.
//   GET   today so far, and whether the phone is scrolling now (its heartbeats are fresh) or when it
//         last scrolled (204: nothing yet).
// Two rows at most (migrations/0008_scroll_today.sql). A POST writes 1 or 2 rows; a GET reads 2.
import { bearer, fail, json, tokenMatches, type Env } from './db'

const APPS = ['instagram'] // the only app the phone counts
const MAX_REELS = 100_000
const SKEW_MS = 60 * 60_000 // a phone clock up to 1 h ahead, as for the music
const FRESH_MS = 3 * 60_000 // six missed heartbeats: the phone went quiet, the session is over

type Row = { kind: 'now' | 'last'; app: string; today: number; minutes: number | null; per_reel: number | null; at: number }
type Report = Partial<Record<'app' | 'scrolling' | 'reels' | 'started' | 'ended' | 'today' | 'minutes' | 'perReel', unknown>>

const count = (v: unknown) => (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= MAX_REELS ? (v as number) : null)

export async function scroll(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return read(env)
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
  // An app from before today's numbers sends only this sitting's count.
  const today = count(body.today) ?? reels
  const minutes = count(body.minutes)
  const perReel = count(body.perReel)

  if (body.scrolling) {
    // A late heartbeat from an older session never replaces a newer one.
    await env.DB.prepare(
      `INSERT INTO scroll (kind, app, reels, today, minutes, per_reel, started, at) VALUES ('now', ?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(kind) DO UPDATE SET app = ?1, reels = ?2, today = ?3, minutes = ?4, per_reel = ?5, started = ?6, at = ?7
       WHERE ?6 >= scroll.started`,
    )
      .bind(app, reels, today, minutes, perReel, started, now)
      .run()
    return json({ status: 'ok' })
  }

  const ended = time(body.ended)
  if (ended === null || ended < started) return fail('A stopped session needs ended, after started.')
  // The session is over: drop it (not a newer one), and keep it as "last" if it counted anything.
  const statements = [env.DB.prepare(`DELETE FROM scroll WHERE kind = 'now' AND started <= ?1`).bind(started)]
  if (reels > 0) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO scroll (kind, app, reels, today, minutes, per_reel, started, at) VALUES ('last', ?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(kind) DO UPDATE SET app = ?1, reels = ?2, today = ?3, minutes = ?4, per_reel = ?5, started = ?6, at = ?7
         WHERE ?7 > scroll.at`,
      ).bind(app, reels, today, minutes, perReel, started, ended),
    )
  }
  await env.DB.batch(statements)
  return json({ status: 'ok' })
}

async function read(env: Env): Promise<Response> {
  // Before the table exists (migration not applied yet), treat it as no data.
  const { results } = await env.DB.prepare('SELECT kind, app, today, minutes, per_reel, at FROM scroll')
    .all<Row>()
    .catch(() => ({ results: [] as Row[] }))
  const now = Date.now()
  const open = results.find((r) => r.kind === 'now' && now - r.at < FRESH_MS)
  // The newest numbers for the day: the open session's, else the one that ended last.
  const row = open ?? results.find((r) => r.kind === 'last')
  if (!row) return new Response(null, { status: 204 })
  return Response.json(
    { scrolling: Boolean(open), app: row.app, today: row.today, minutes: row.minutes, perReel: row.per_reel, at: new Date(row.at).toISOString() },
    { headers: { 'cache-control': 'public, max-age=30' } },
  )
}
