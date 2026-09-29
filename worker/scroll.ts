// /api/scroll — "now scrolling" from the phone (the Brainrot app's SiteReporter, github.com/kishore280/brainRot).
//   POST  Bearer SCROBBLE_TOKEN, {app, scrolling, reels, started, ended}: "scrolling" when Reels opens
//         and every 30 s with the running count, then "stopped" with the total.
//   GET   the open session while its heartbeats are fresh, else the last finished one (204: none).
// Two rows at most (migrations/0007_scroll.sql). A POST writes 1 or 2 rows; a GET reads 2.
import { bearer, fail, json, tokenMatches, type Env } from './db'

const APPS = ['instagram'] // the only app the phone counts
const MAX_REELS = 100_000
const SKEW_MS = 60 * 60_000 // a phone clock up to 1 h ahead, as for the music
const FRESH_MS = 3 * 60_000 // six missed heartbeats: the phone went quiet, the session is over

type Row = { kind: 'now' | 'last'; app: string; reels: number; started: number; at: number }
type Report = { app?: unknown; scrolling?: unknown; reels?: unknown; started?: unknown; ended?: unknown }

export async function scroll(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return read(env)
  if (request.method !== 'POST') return fail('Use GET or POST.', 405)
  if (!(await tokenMatches(bearer(request), env.SCROBBLE_TOKEN))) return fail('Invalid token.', 401)

  const body = (await request.json().catch(() => null)) as Report | null
  const now = Date.now()
  const time = (v: unknown) => (Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= now + SKEW_MS ? (v as number) : null)
  const app = typeof body?.app === 'string' && APPS.includes(body.app) ? body.app : null
  const reels = Number.isSafeInteger(body?.reels) && (body?.reels as number) >= 0 && (body?.reels as number) <= MAX_REELS ? (body?.reels as number) : null
  const started = time(body?.started)
  if (!app || reels === null || started === null || typeof body?.scrolling !== 'boolean') {
    return fail('Send app, scrolling, reels and started.')
  }

  if (body.scrolling) {
    // A late heartbeat from an older session never replaces a newer one.
    await env.DB.prepare(
      `INSERT INTO scroll (kind, app, reels, started, at) VALUES ('now', ?1, ?2, ?3, ?4)
       ON CONFLICT(kind) DO UPDATE SET app = ?1, reels = ?2, started = ?3, at = ?4 WHERE ?3 >= scroll.started`,
    )
      .bind(app, reels, started, now)
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
        `INSERT INTO scroll (kind, app, reels, started, at) VALUES ('last', ?1, ?2, ?3, ?4)
         ON CONFLICT(kind) DO UPDATE SET app = ?1, reels = ?2, started = ?3, at = ?4 WHERE ?4 > scroll.at`,
      ).bind(app, reels, started, ended),
    )
  }
  await env.DB.batch(statements)
  return json({ status: 'ok' })
}

async function read(env: Env): Promise<Response> {
  // Before the table exists (migration not applied yet), treat it as no data.
  const { results } = await env.DB.prepare('SELECT kind, app, reels, started, at FROM scroll')
    .all<Row>()
    .catch(() => ({ results: [] as Row[] }))
  const now = Date.now()
  const open = results.find((r) => r.kind === 'now' && now - r.at < FRESH_MS)
  const row = open ?? results.find((r) => r.kind === 'last')
  if (!row) return new Response(null, { status: 204 })
  const iso = (ms: number) => new Date(ms).toISOString()
  return Response.json(
    { scrolling: Boolean(open), app: row.app, reels: row.reels, started: iso(row.started), at: iso(row.at) },
    { headers: { 'cache-control': 'public, max-age=30' } },
  )
}
