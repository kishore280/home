// GET /api/now-playing
// The latest song the phone sent (worker/scrobble.ts): when it started, and until when it can
// still be playing (its length, or 10 min when unknown, plus a minute). The page compares
// "until" with the visitor's clock, so the 30 s cache never shows a stale "listening".
// With no song yet, 204 and the music row stays hidden.
import type { Env } from './db'

const UNKNOWN_LENGTH_MS = 10 * 60_000
const GRACE_MS = 60_000

type Row = { title: string; artist: string; started_at: number; duration_ms: number | null }

export async function nowPlaying(env: Env): Promise<Response> {
  // Before the table exists (migration not applied yet), treat it as no data.
  const row = await env.DB.prepare('SELECT title, artist, started_at, duration_ms FROM now_playing WHERE id = 1')
    .first<Row>()
    .catch(() => null)
  if (!row) return new Response(null, { status: 204 })

  const until = row.started_at + (row.duration_ms ?? UNKNOWN_LENGTH_MS) + GRACE_MS
  return Response.json(
    { title: row.title, artist: row.artist, at: new Date(row.started_at).toISOString(), until: new Date(until).toISOString() },
    { headers: { 'cache-control': 'public, max-age=30' } },
  )
}
