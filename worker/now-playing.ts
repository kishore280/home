// GET /api/now-playing
// The song for the "right now" card (rows written by worker/scrobble.ts):
//   - "playing now" while it has not expired: the page shows "listening" until `until`;
//   - else the newest finished listen (ListenBrainz's own "recent listens"): "last played".
// The page compares `until` with the visitor's clock, so the 30 s cache never shows a stale
// "listening". With no song yet, 204 and the music row stays hidden.
import type { Env } from './db'

type Row = { kind: 'playing_now' | 'listen'; title: string; artist: string; at: number; until: number | null }

export async function nowPlaying(env: Env): Promise<Response> {
  // Before the table exists (migration not applied yet), treat it as no data.
  const { results } = await env.DB.prepare('SELECT kind, title, artist, at, until FROM music')
    .all<Row>()
    .catch(() => ({ results: [] as Row[] }))
  const now = Date.now()
  const playing = results.find((r) => r.kind === 'playing_now' && r.until !== null && r.until > now)
  const row = playing ?? results.find((r) => r.kind === 'listen') ?? results.find((r) => r.kind === 'playing_now')
  if (!row) return new Response(null, { status: 204 })

  const iso = (ms: number) => new Date(ms).toISOString()
  return Response.json(
    { title: row.title, artist: row.artist, at: iso(row.at), until: iso(playing?.until ?? Math.min(row.at, now)) },
    { headers: { 'cache-control': 'public, max-age=30' } },
  )
}
