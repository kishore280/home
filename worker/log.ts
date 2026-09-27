// /api/log: things kish logs from the phone (chai, parotta, beach days, any kind in log_kinds).
//   GET  /api/log        public summary: each kind with today, month, year, total, the last entry
//                        and its count per hour of the day (the chai clock)
//   GET  /api/log/days   ?kind=chai: the day totals of the last 365 days (the heatmap)
//   POST /api/log        { id, kind, count?, place?, at?, tz? } adds one entry
//   POST /api/log/undo   { id } takes it back (deletes the entry)
// A POST needs "Authorization: Bearer <token>", like the check-in API of anonrig/adamvsyagiz.com.
// The token is the Worker secret SCROBBLE_TOKEN: the owner uses one phone token for music and log.
// `id` is a UUID made on the phone, so a request the offline queue sends again is counted once, and
// an undo sent again changes nothing. Tables, and the triggers that keep the totals right:
// migrations/0004_log.sql. This file only inserts, deletes and reads.
import { site } from '../src/data'
import { bearer, fail, json, tokenMatches, type Env } from './db'

type Body = Record<string, unknown> & { id: string }

const MAX_BODY = 2048
const MAX_COUNT = 20
const MAX_PLACE = 60
const MAX_AGE_MS = 24 * 3600_000 // Workbox background sync keeps a request for up to 24 h (maxRetentionTime)
const MAX_AHEAD_MS = 5 * 60_000 // a phone clock a little ahead

// The site counts days in its time zone (IST), as log_entries.day does. en-CA gives YYYY-MM-DD.
const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone })
const periods = (day: string) => ({ day, month: day.slice(0, 7), year: day.slice(0, 4) })

// A real IANA time zone name, e.g. 'Asia/Kolkata' (Intl throws a RangeError for an unknown one).
function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// Say what is missing instead of "wrong token" or a 500, as adamvsyagiz.com's /log page does.
const notSetUp = (what: string) => fail(`Logging is not set up yet: ${what}.`, 503)
const orNotSetUp = (reply: Promise<Response>) =>
  reply.catch((error) =>
    String(error).includes('no such table') ? notSetUp('run migrations/0004_log.sql in the D1 Console') : Promise.reject(error),
  )

export async function log(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return summary(env)
  if (request.method !== 'POST') return fail('Use GET or POST.', 405)
  const body = await readPost(request, env)
  if (body instanceof Response) return body
  return orNotSetUp(add(env, body))
}

export async function undo(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return fail('Use POST.', 405)
  const body = await readPost(request, env)
  if (body instanceof Response) return body
  return orNotSetUp(remove(env, body))
}

// The token, then a small JSON object with an id.
async function readPost(request: Request, env: Env): Promise<Body | Response> {
  if (!env.SCROBBLE_TOKEN) return notSetUp('add the SCROBBLE_TOKEN secret in the Cloudflare dashboard')
  if (!(await tokenMatches(bearer(request), env.SCROBBLE_TOKEN))) return fail('Invalid token.', 401)
  if (Number(request.headers.get('content-length')) > MAX_BODY) return fail('Body too large.', 413)
  const text = await request.text()
  if (text.length > MAX_BODY) return fail('Body too large.', 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return fail('Body must be JSON.')
  }
  const id = (body as { id?: unknown } | null)?.id
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) return fail('id must be a UUID.')
  return body as Body
}

async function add(env: Env, { id, kind, count = 1, place, at = Date.now(), tz = site.timeZone }: Body): Promise<Response> {
  if (typeof kind !== 'string') return fail('kind is required.')
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_COUNT)
    return fail(`count must be a whole number from 1 to ${MAX_COUNT}.`)
  if (place != null && (typeof place !== 'string' || place.trim().length > MAX_PLACE))
    return fail(`place must be text of up to ${MAX_PLACE} characters.`)
  if (!isTimeZone(tz)) return fail('tz must be a time zone name, e.g. Asia/Kolkata.')
  const now = Date.now()
  if (typeof at !== 'number' || !(at >= now - MAX_AGE_MS && at <= now + MAX_AHEAD_MS))
    return fail('at must be within the last 24 hours.')

  const ms = Math.round(at)
  const { day, month } = periods(dayOf.format(ms))
  // The kind, and whether this entry is already here: the same id, or a once-a-day kind's day.
  // Each is one lookup by key (log_kinds PK, client_id UNIQUE, log_entries_day).
  const [kinds, seen] = await env.DB.batch<{ once_a_day?: number }>([
    env.DB.prepare('SELECT once_a_day FROM log_kinds WHERE kind = ?').bind(kind),
    env.DB.prepare(
      `SELECT 1 FROM log_entries WHERE client_id = ?1
       UNION ALL SELECT 1 FROM log_entries JOIN log_kinds USING (kind)
       WHERE kind = ?2 AND day = ?3 AND once_a_day = 1 LIMIT 1`,
    ).bind(id, kind, day),
  ])
  const found = kinds.results[0]
  if (!found) return fail(`Unknown kind "${kind}".`)
  if (seen.results.length) return json({ ok: true, duplicate: true })

  const n = found.once_a_day === 1 ? 1 : count // a beach day is one day
  let totals: { grain: string; count: number }[]
  try {
    // One transaction (D1 docs, "batch()"): the entry (the triggers add it to its totals), then the
    // new day and month totals for the reply ("☕ chai +1 · 3 today").
    const results = await env.DB.batch<{ grain: string; count: number }>([
      env.DB.prepare('INSERT INTO log_entries (client_id, kind, count, place, at, tz) VALUES (?, ?, ?, ?, ?, ?)').bind(
        id,
        kind,
        n,
        typeof place === 'string' ? place.trim() || null : null,
        ms,
        tz,
      ),
      env.DB.prepare(
        `SELECT grain, count FROM log_totals
         WHERE kind = ?1 AND ((grain = 'day' AND period = ?2) OR (grain = 'month' AND period = ?3))`,
      ).bind(kind, day, month),
    ])
    totals = results[1].results
  } catch (error) {
    // The same entry sent twice at once: the unique id or the once-a-day trigger refuses the second,
    // and its batch rolls back.
    if (/UNIQUE constraint failed|once a day/.test(String(error))) return json({ ok: true, duplicate: true })
    throw error
  }
  const total = (grain: string) => totals.find((t) => t.grain === grain)?.count ?? 0
  return json({ ok: true, id, kind, count: n, at: new Date(ms).toISOString(), today: total('day'), month: total('month') })
}

// The trigger takes the entry out of its totals. An unknown id deletes nothing.
async function remove(env: Env, body: Body): Promise<Response> {
  const { meta } = await env.DB.prepare('DELETE FROM log_entries WHERE client_id = ?').bind(body.id).run()
  return json(meta.changes ? { ok: true, id: body.id } : { ok: true, missing: true })
}

type Row = {
  kind: string
  emoji: string
  label: string
  once_a_day: number
  today: number
  month: number
  year: number
  total: number
  last: number | null
  place: string | null
}

// Each kind with its four rollups (primary-key lookups) and its newest entry by time (the
// log_entries_newest index), plus log_hours (at most 24 rows a kind). Rows read grow with the
// number of kinds, not with the history.
async function summary(env: Env): Promise<Response> {
  const { day, month, year } = periods(dayOf.format(Date.now()))
  const hoursQuery = env.DB.prepare('SELECT kind, hour, count FROM log_hours')
    .all<{ kind: string; hour: number; count: number }>()
    .catch(() => null) // before migrations/0005_log_hours.sql: no clock yet
  const rows = await env.DB.prepare(
    `SELECT k.kind, k.emoji, k.label, k.once_a_day,
       coalesce((SELECT count FROM log_totals WHERE kind = k.kind AND grain = 'day' AND period = ?1), 0) AS today,
       coalesce((SELECT count FROM log_totals WHERE kind = k.kind AND grain = 'month' AND period = ?2), 0) AS month,
       coalesce((SELECT count FROM log_totals WHERE kind = k.kind AND grain = 'year' AND period = ?3), 0) AS year,
       coalesce((SELECT count FROM log_totals WHERE kind = k.kind AND grain = 'all' AND period = 'all'), 0) AS total,
       e.at AS last, e.place
     FROM log_kinds AS k
     LEFT JOIN log_entries AS e
       ON e.id = (SELECT id FROM log_entries WHERE kind = k.kind ORDER BY at DESC LIMIT 1)
     ORDER BY k.sort, k.kind`,
  )
    .bind(day, month, year)
    .all<Row>()
    .catch(() => null)
  // Before the tables exist (migration not applied yet), treat it as no data.
  if (!rows) return new Response(null, { status: 204 })

  const hours = (await hoursQuery)?.results ?? []
  const kinds = rows.results.map(({ once_a_day, last, ...row }) => ({
    ...row,
    onceADay: once_a_day === 1,
    last: last === null ? null : new Date(last).toISOString(),
    hours: Array.from({ length: 24 }, (_, h) => hours.find((r) => r.kind === row.kind && r.hour === h)?.count ?? 0),
  }))
  return Response.json({ kinds }, { headers: { 'cache-control': 'public, max-age=15' } })
}

// The heatmap windows: 12 weeks (the default view) or the year.
const RANGES = new Set([84, 365])

// GET /api/log/days?range=84: the day totals of every kind for the last 84 (or 365) days in IST,
// as [day, kind, count], in no order (no ORDER BY, so SQLite needs no sort; the page sorts). One primary-key range read per kind: at most 4 x 84 rows.
// The answer is kept for 60 s in the data centre's cache (Workers Cache API), so most visits read
// no rows at all. https://developers.cloudflare.com/workers/runtime-apis/cache/
export async function days(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'GET') return fail('Use GET.', 405)
  const url = new URL(request.url)
  // A page opened before this change (still open, or kept by the service worker until its next
  // visit) asks ?kind=chai and reads [day, count] for 365 days. Answer it that way for now.
  // TODO: remove after a few weeks (added 2026-09-27).
  const old = url.searchParams.get('kind')
  const range = old ? 365 : Number(url.searchParams.get('range') ?? 84)
  if (!RANGES.has(range)) return fail('range is 84 or 365.')
  // One cache key per range, whatever else is in the URL.
  const key = new Request(`${url.origin}${url.pathname}?range=${range}${old ? `&kind=${encodeURIComponent(old)}` : ''}`)
  const cached = await caches.default.match(key)
  if (cached) return cached
  const now = Date.now()
  const to = dayOf.format(now)
  const from = dayOf.format(now - (range - 1) * 86_400_000)
  const rows = await env.DB.prepare(
    `SELECT period AS day, kind, count FROM log_totals
     WHERE kind IN (SELECT kind FROM log_kinds) AND grain = 'day' AND period BETWEEN ?1 AND ?2`,
  )
    .bind(from, to)
    .all<{ day: string; kind: string; count: number }>()
    .catch(() => null)
  if (!rows) return new Response(null, { status: 204 })
  const response = Response.json(
    old
      ? { kind: old, from, to, days: rows.results.filter((r) => r.kind === old).map((r) => [r.day, r.count]).sort() }
      : { from, to, days: rows.results.map((r) => [r.day, r.kind, r.count]) },
    { headers: { 'cache-control': 'public, max-age=60' } },
  )
  ctx.waitUntil(caches.default.put(key, response.clone()))
  return response
}
