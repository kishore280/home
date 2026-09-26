// /api/log: chai, parotta and beach days logged from the phone; the site shows the totals.
//   GET  /api/log        public summary per kind: today, month, year, total, last
//   POST /api/log        { id, kind, count?, place?, at? } adds one entry
//   POST /api/log/undo   { id } takes it back
// A POST needs "Authorization: Bearer <token>", like the check-in API of anonrig/adamvsyagiz.com.
// The token is the Worker secret SCROBBLE_TOKEN: the owner uses one phone token for music and log.
// `id` is a UUID made on the phone, so a request the offline queue sends again is counted once, and
// an undo sent again changes nothing.
// Sums are kept in log_totals (migrations/0004_log.sql): a page view reads a few rows by key.
import { site } from '../src/data'
import { fail, json, tokenMatches, type Env } from './db'

const KINDS = ['chai', 'parotta', 'beach'] as const
type Kind = (typeof KINDS)[number]
type Body = Record<string, unknown> & { id: string }

const MAX_BODY = 2048
const MAX_COUNT = 20
const MAX_PLACE = 60
const MAX_AGE_MS = 24 * 3600_000 // Workbox background sync keeps a request for up to 24 h (maxRetentionTime)
const MAX_AHEAD_MS = 5 * 60_000 // a phone clock a little ahead

// Days are counted in the site's time zone (IST). en-CA formats a date as YYYY-MM-DD.
const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone })
const periods = (day: string) => [day, day.slice(0, 7), day.slice(0, 4), 'all']

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

async function remove(env: Env, body: Body): Promise<Response> {
  // One batch is one transaction (D1 docs, "batch()"): the totals and the entry go together.
  // An unknown id matches no row in either statement.
  const [, { meta }] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE log_totals SET count = max(log_totals.count - e.count, 0)
       FROM (SELECT kind, count, day FROM log_entries WHERE client_id = ?1) AS e
       WHERE log_totals.kind = e.kind AND log_totals.period IN (e.day, substr(e.day, 1, 7), substr(e.day, 1, 4), 'all')`,
    ).bind(body.id),
    env.DB.prepare('DELETE FROM log_entries WHERE client_id = ?').bind(body.id),
  ])
  return json(meta.changes ? { ok: true, id: body.id } : { ok: true, missing: true })
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

async function add(env: Env, { id, kind, count = 1, place, at = Date.now() }: Body): Promise<Response> {
  if (!KINDS.includes(kind as Kind)) return fail('kind must be chai, parotta or beach.')
  if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > MAX_COUNT)
    return fail(`count must be a whole number from 1 to ${MAX_COUNT}.`)
  if (place != null && (typeof place !== 'string' || place.trim().length > MAX_PLACE))
    return fail(`place must be text of up to ${MAX_PLACE} characters.`)
  const now = Date.now()
  if (typeof at !== 'number' || !(at >= now - MAX_AGE_MS && at <= now + MAX_AHEAD_MS))
    return fail('at must be within the last 24 hours.')

  const beach = kind === 'beach'
  const n = beach ? 1 : (count as number) // a beach day is one day
  const ms = Math.round(at)
  const day = dayOf.format(ms)
  // Already here: the same id, or a beach entry for that day (indexes: client_id, log_one_beach_a_day).
  const seen = await env.DB.prepare(
    `SELECT 1 FROM log_entries WHERE client_id = ?1 OR (kind = 'beach' AND day = ?2) LIMIT 1`,
  )
    .bind(id, beach ? day : null)
    .first()
  if (seen) return json({ ok: true, duplicate: true })

  let totals: { period: string; count: number }[]
  try {
    // One transaction: the entry and its four totals (day, month, year, all), then the day's and
    // month's new totals for the reply ("☕ chai +1 · 3 today").
    const results = await env.DB.batch<{ period: string; count: number }>([
      env.DB.prepare('INSERT INTO log_entries (client_id, kind, count, place, at, day) VALUES (?, ?, ?, ?, ?, ?)').bind(
        id,
        kind,
        n,
        beach && typeof place === 'string' ? place.trim() || null : null,
        ms,
        day,
      ),
      env.DB.prepare(
        `INSERT INTO log_totals (kind, period, count) VALUES (?1, ?2, ?6), (?1, ?3, ?6), (?1, ?4, ?6), (?1, ?5, ?6)
         ON CONFLICT(kind, period) DO UPDATE SET count = count + excluded.count`,
      ).bind(kind, ...periods(day), n),
      env.DB.prepare('SELECT period, count FROM log_totals WHERE kind = ?1 AND period IN (?2, ?3)').bind(kind, day, day.slice(0, 7)),
    ])
    totals = results[2].results
  } catch (error) {
    // The same entry sent twice at once: a unique index refuses the second and its batch rolls back.
    if (String(error).includes('UNIQUE constraint failed')) return json({ ok: true, duplicate: true })
    throw error
  }
  const total = (period: string) => totals.find((t) => t.period === period)?.count ?? 0
  return json({ ok: true, id, kind, count: n, at: new Date(ms).toISOString(), today: total(day), month: total(day.slice(0, 7)) })
}

type Total = { kind: Kind; period: string; count: number }
type Last = { at: number; place: string | null }

// 12 totals rows by primary key, and the newest entry of each kind by (kind, id): no scan.
async function summary(env: Env): Promise<Response> {
  const [day, month, year] = periods(dayOf.format(Date.now()))
  const results = await env.DB.batch([
    env.DB.prepare(
      `SELECT kind, period, count FROM log_totals
       WHERE kind IN ('chai', 'parotta', 'beach') AND period IN (?1, ?2, ?3, 'all')`,
    ).bind(day, month, year),
    ...KINDS.map((kind) =>
      env.DB.prepare('SELECT at, place FROM log_entries WHERE kind = ? ORDER BY id DESC LIMIT 1').bind(kind),
    ),
  ]).catch(() => null)
  // Before the tables exist (migration not applied yet), treat it as no data.
  if (!results) return new Response(null, { status: 204 })

  const [{ results: totals }, ...newest] = results as [D1Result<Total>, ...D1Result<Last>[]]
  const sum = (kind: Kind, period: string) => totals.find((t) => t.kind === kind && t.period === period)?.count ?? 0
  const kinds = KINDS.map((kind, i) => {
    const last = newest[i].results[0]
    if (!last) return [kind, null]
    return [
      kind,
      {
        today: sum(kind, day),
        month: sum(kind, month),
        year: sum(kind, year),
        total: sum(kind, 'all'),
        last: new Date(last.at).toISOString(),
        ...(kind === 'beach' && { place: last.place }),
      },
    ]
  })
  return Response.json(Object.fromEntries(kinds), { headers: { 'cache-control': 'public, max-age=15' } })
}
