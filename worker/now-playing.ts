// GET /api/now-playing
// The song for the "right now" card (rows written by worker/scrobble.ts):
//   - "playing now" while it has not expired: the page shows "listening" until `until`;
//   - else the newest song played: "last played". That is the newest finished listen, or the last
//     "playing now" if it is newer: a song stopped before half its length (or 4 minutes) is never
//     sent as a listen (ListenBrainz: "it doesn't fully count as a listen and should not be
//     submitted"), but it was still the last song played.
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
  const row = playing ?? results.toSorted((a, b) => b.at - a.at)[0]
  if (!row) return new Response(null, { status: 204 })

  const iso = (ms: number) => new Date(ms).toISOString()
  return Response.json(
    { title: row.title, artist: row.artist, at: iso(row.at), until: iso(playing?.until ?? Math.min(row.at, now)) },
    { headers: { 'cache-control': 'public, max-age=30' } },
  )
}
