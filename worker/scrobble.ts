// /api/scrobble/1/* — a small ListenBrainz-compatible server, so a scrobbler app on the phone
// (Pano Scrobbler: Accounts → Custom ListenBrainz, API URL https://kichoow.com/api/scrobble/)
// sends each song here. Only the two calls a scrobbler needs:
//   GET  1/validate-token   POST 1/submit-listens
// API: https://listenbrainz.readthedocs.io/en/latest/users/api/core.html
// The token is the Worker secret SCROBBLE_TOKEN; without it every call is refused.
import { fail, json, type Env } from './db'

// Kept short: the card shows one line, and nothing longer is ever needed.
const MAX_TEXT = 300
const TYPES = new Set(['playing_now', 'single', 'import'])

type Listen = {
  listened_at?: number
  track_metadata?: { artist_name?: unknown; track_name?: unknown; additional_info?: { duration_ms?: unknown } }
}

// Constant-time compare, as in Cloudflare's "Protect against timing attacks" example.
async function authorized(request: Request, secret: string | undefined): Promise<boolean> {
  const given = /^token\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!secret || !given) return false
  const encoder = new TextEncoder()
  const a = encoder.encode(given)
  const b = encoder.encode(secret)
  return a.byteLength === b.byteLength ? crypto.subtle.timingSafeEqual(a, b) : !crypto.subtle.timingSafeEqual(a, a)
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_TEXT) : null)

export async function scrobble(request: Request, env: Env, path: string): Promise<Response> {
  const ok = await authorized(request, env.SCROBBLE_TOKEN)

  if (path === 'validate-token' && request.method === 'GET') {
    // The shape ListenBrainz returns; Pano needs user_name.
    return ok
      ? json({ code: 200, message: 'Token valid.', valid: true, user_name: 'kishore' })
      : json({ code: 200, message: 'Token invalid.', valid: false })
  }
  if (path !== 'submit-listens') return fail('Not found.', 404)
  if (request.method !== 'POST') return fail('Use POST.', 405)
  if (!ok) return json({ code: 401, error: 'Invalid authorization token.' }, 401)

  const body = (await request.json().catch(() => null)) as { listen_type?: string; payload?: Listen[] } | null
  if (!body || !TYPES.has(body.listen_type ?? '') || !Array.isArray(body.payload) || body.payload.length === 0)
    return json({ code: 400, error: 'Invalid JSON document submitted.' }, 400)

  // playing_now has no time (it is now); single and import give the start time in seconds.
  // A batch sent after being offline (import) can hold many listens: keep the newest.
  const now = Date.now()
  let newest: { title: string; artist: string; startedAt: number; durationMs: number | null } | null = null
  for (const listen of body.payload) {
    const title = text(listen.track_metadata?.track_name)
    const artist = text(listen.track_metadata?.artist_name)
    const startedAt = body.listen_type === 'playing_now' ? now : Number(listen.listened_at) * 1000
    if (!title || !artist || !Number.isFinite(startedAt) || startedAt > now + 60_000) continue
    const duration = Number(listen.track_metadata?.additional_info?.duration_ms)
    if (!newest || startedAt > newest.startedAt)
      newest = { title, artist, startedAt, durationMs: Number.isFinite(duration) && duration > 0 ? duration : null }
  }
  if (!newest) return json({ code: 400, error: 'Invalid JSON document submitted.' }, 400)

  // Replace the row only with a newer song. A "single" for the song already sent as playing_now
  // started a moment earlier, so it does not undo the "listening" state.
  await env.DB.prepare(
    `INSERT INTO now_playing (id, title, artist, started_at, duration_ms) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, artist = excluded.artist,
       started_at = excluded.started_at, duration_ms = excluded.duration_ms
     WHERE excluded.started_at > now_playing.started_at`,
  )
    .bind(newest.title, newest.artist, newest.startedAt, newest.durationMs)
    .run()
  return json({ status: 'ok' })
}
