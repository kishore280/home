// GET/POST /api/counters
// POST { key: 'views' | 'pats' } adds one and returns all counters.
import { fail, json, type Env } from './db'

const KEYS = new Set(['views', 'pats'])

async function read(db: D1Database) {
  const { results } = await db.prepare('SELECT key, value FROM counters').all<{ key: string; value: number }>()
  const all = Object.fromEntries(results.map((r) => [r.key, r.value]))
  return { views: all.views ?? 0, pats: all.pats ?? 0 }
}

export async function counters(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return env.DB ? json(await read(env.DB)) : new Response(null, { status: 204 })
  if (request.method !== 'POST') return fail('Use GET or POST.', 405)
  if (!env.DB) return fail('Counters are not set up yet.', 503)
  const { key } = ((await request.json().catch(() => ({}))) ?? {}) as { key?: string }
  if (!key || !KEYS.has(key)) return fail('Unknown counter.')

  await env.DB.prepare(
    'INSERT INTO counters (key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1',
  )
    .bind(key)
    .run()
  return json(await read(env.DB))
}
