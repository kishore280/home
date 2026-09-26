// /api/log: things kish logs from the phone (chai, parotta, beach days, any kind in log_kinds).
//   GET  /api/log        public summary: each kind with today, month, year, total and the last entry
//   POST /api/log        { id, kind, count?, place?, at?, tz? } adds one entry
//   POST /api/log/undo   { id } takes it back (the entry is marked, not deleted)
// A POST needs "Authorization: Bearer <token>", like the check-in API of anonrig/adamvsyagiz.com.
// The token is the Worker secret SCROBBLE_TOKEN: the owner uses one phone token for music and log.
// `id` is a UUID made on the phone, so a request the offline queue sends again is counted once, and
// an undo sent again changes nothing. Tables and the design: migrations/0004_log.sql.
import { site } from '../src/data'
import { fail, json, tokenMatches, type Env } from './db'

type Body = Record<string, unknown> & { id: string }

const MAX_BODY = 2048
const MAX_COUNT = 20
const MAX_PLACE = 60
const MAX_AGE_MS = 24 * 3600_000 // Workbox background sync keeps a request for up to 24 h (maxRetentionTime)
const MAX_AHEAD_MS = 5 * 60_000 // a phone clock a little ahead

// The site counts days in its time zone (IST). en-CA formats a date as YYYY-MM-DD.
const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone })
// The rollups an entry counts in: its day, month and year (and all time).
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
  const token = /^bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!(await tokenMatches(token, env.SCROBBLE_TOKEN))) return fail('Invalid token.', 401)
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
  const { day, month, year } = periods(dayOf.format(ms))
  // The kind, and whether this entry is already here: the same id, or a once-a-day kind's day.
  // Each is one lookup by key (log_kinds PK, client_id UNIQUE, log_entries_once_a_day).
  const [kinds, seen] = await env.DB.batch<{ once_a_day?: number; seen?: number }>([
    env.DB.prepare('SELECT once_a_day FROM log_kinds WHERE kind = ?').bind(kind),
    env.DB.prepare(
      `SELECT 1 AS seen FROM log_entries WHERE client_id = ?1
       UNION ALL SELECT 1 FROM log_entries WHERE kind = ?2 AND once_day = ?3 LIMIT 1`,
    ).bind(id, kind, day),
  ])
  const found = kinds.results[0]
  if (!found) return fail(`Unknown kind "${kind}".`)
  if (seen.results.length) return json({ ok: true, duplicate: true })

  const once = found.once_a_day === 1
  const n = once ? 1 : count // a beach day is one day
  let totals: { grain: string; count: number }[]
  try {
    // One transaction (D1 docs, "batch()"): the entry, its four rollups, then the new day and
    // month totals for the reply ("☕ chai +1 · 3 today").
    const results = await env.DB.batch<{ grain: string; count: number }>([
      env.DB.prepare(
        `INSERT INTO log_entries (client_id, kind, count, place, at, tz, day, once_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, kind, n, typeof place === 'string' ? place.trim() || null : null, ms, tz, day, once ? day : null),
      env.DB.prepare(
        `INSERT INTO log_totals (kind, grain, period, count)
         VALUES (?1, 'day', ?2, ?5), (?1, 'month', ?3, ?5), (?1, 'year', ?4, ?5), (?1, 'all', 'all', ?5)
         ON CONFLICT (kind, grain, period) DO UPDATE SET count = count + excluded.count`,
      ).bind(kind, day, month, year, n),
      env.DB.prepare(
        `SELECT grain, count FROM log_totals
         WHERE kind = ?1 AND ((grain = 'day' AND period = ?2) OR (grain = 'month' AND period = ?3))`,
      ).bind(kind, day, month),
    ])
    totals = results[2].results
  } catch (error) {
    // The same entry sent twice at once: a unique index refuses the second and its batch rolls back.
    if (String(error).includes('UNIQUE constraint failed')) return json({ ok: true, duplicate: true })
    throw error
  }
  const total = (grain: string) => totals.find((t) => t.grain === grain)?.count ?? 0
  return json({ ok: true, id, kind, count: n, at: new Date(ms).toISOString(), today: total('day'), month: total('month') })
}

async function remove(env: Env, body: Body): Promise<Response> {
  // One transaction: take the entry out of its four rollups, then mark it undone (it stays in the
  // history). An unknown or already undone id matches no row in either statement.
  const [, { meta }] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE log_totals SET count = max(log_totals.count - e.count, 0)
       FROM (SELECT kind, count, day FROM log_entries WHERE client_id = ?1 AND undone_at IS NULL) AS e
       WHERE log_totals.kind = e.kind AND (
         (grain = 'day' AND period = e.day) OR (grain = 'month' AND period = substr(e.day, 1, 7)) OR
         (grain = 'year' AND period = substr(e.day, 1, 4)) OR grain = 'all')`,
    ).bind(body.id),
    env.DB.prepare('UPDATE log_entries SET undone_at = ?2, once_day = NULL WHERE client_id = ?1 AND undone_at IS NULL').bind(
      body.id,
      Date.now(),
    ),
  ])
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

// One query: each kind with its four rollups (primary-key lookups) and its newest entry (the
// log_entries_newest index). Rows read grow with the number of kinds, not with the history.
async function summary(env: Env): Promise<Response> {
  const { day, month, year } = periods(dayOf.format(Date.now()))
  const rows = await env.DB.prepare(
    `SELECT k.kind, k.emoji, k.label, k.once_a_day,
       coalesce((SELECT count FROM log_totals WHERE kind = k.kind AND grain = 'day' AND period = ?1), 0) AS today,
       coalesce((SELECT count FROM log_totals WHERE kind = k.kind AND grain = 'month' AND period = ?2), 0) AS month,
       coalesce((SELECT count FROM log_totals WHERE kind = k.kind AND grain = 'year' AND period = ?3), 0) AS year,
       coalesce((SELECT count FROM log_totals WHERE kind = k.kind AND grain = 'all' AND period = 'all'), 0) AS total,
       e.at AS last, e.place
     FROM log_kinds AS k
     LEFT JOIN log_entries AS e
       ON e.id = (SELECT id FROM log_entries WHERE kind = k.kind AND undone_at IS NULL ORDER BY id DESC LIMIT 1)
     ORDER BY k.sort, k.kind`,
  )
    .bind(day, month, year)
    .all<Row>()
    .catch(() => null)
  // Before the tables exist (migration not applied yet), treat it as no data.
  if (!rows) return new Response(null, { status: 204 })

  const kinds = rows.results.map(({ once_a_day, last, ...row }) => ({
    ...row,
    onceADay: once_a_day === 1,
    last: last === null ? null : new Date(last).toISOString(),
  }))
  return Response.json({ kinds }, { headers: { 'cache-control': 'public, max-age=15' } })
}
