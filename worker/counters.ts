// GET/POST /api/counters
// POST { key: 'views' | 'pats' } adds one and returns all counters.
import { fail, json, type Env } from './db'

const KEYS = new Set(['views', 'pats'])

function toCounters(rows: { key: string; value: number }[]) {
  const all = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { views: all.views ?? 0, pats: all.pats ?? 0 }
}

async function read(db: D1Database) {
  const { results } = await db.prepare('SELECT key, value FROM counters').all<{ key: string; value: number }>()
  return toCounters(results)
}

export async function counters(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return env.DB ? json(await read(env.DB)) : new Response(null, { status: 204 })
  if (request.method !== 'POST') return fail('Use GET or POST.', 405)
  if (!env.DB) return fail('Counters are not set up yet.', 503)
  const { key } = ((await request.json().catch(() => ({}))) ?? {}) as { key?: string }
  if (!key || !KEYS.has(key)) return fail('Unknown counter.')

  // One round trip: add one, then read all counters (Vercel rule async-api-routes).
  const [, { results }] = await env.DB.batch<{ key: string; value: number }>([
    env.DB.prepare(
      'INSERT INTO counters (key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1',
    ).bind(key),
    env.DB.prepare('SELECT key, value FROM counters'),
  ])
  return json(toCounters(results))
}
