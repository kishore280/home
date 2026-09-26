// /api/scrobble/1/* — a small ListenBrainz-compatible server, so a scrobbler app on the phone
// (Pano Scrobbler: "ListenBrainz-like instance", API URL https://kichoow.com/api/scrobble/)
// sends each song here. Only the two calls a scrobbler needs:
//   GET  1/validate-token   POST 1/submit-listens
// API: https://listenbrainz.readthedocs.io/en/latest/users/api/core.html
// Storage follows the ListenBrainz server (webserver/views/api_tools.py): "playing now" is kept
// apart from listens and expires after the song's length; a listen is ordered by listened_at.
// The token is the Worker secret SCROBBLE_TOKEN; without it every call is refused.
import { fail, json, type Env } from './db'

const MAX_TEXT = 300 // the card shows one line
const MIN_LISTENED_AT = 1033410600 // 2002-10-01, as ListenBrainz (LISTEN_MINIMUM_TS)
const ALLOWED_SKEW_S = 60 * 60 // a phone clock up to 1 h ahead, as ListenBrainz
const PLAYING_NOW_MAX_MS = 10 * 60_000 // expiry when the player gives no length
const MAX_DURATION_MS = 24 * 24 * 3600_000 // longer is refused, as ListenBrainz (MAX_DURATION_MS_LIMIT)

type Listen = null | {
  listened_at?: unknown
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
const invalid = (error: string) => json({ code: 400, error }, 400)

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
  const type = body?.listen_type
  const payload = Array.isArray(body?.payload) ? body.payload : []
  if (type !== 'playing_now' && type !== 'single' && type !== 'import') return invalid('Invalid listen_type.')
  if (payload.length === 0 || (type !== 'import' && payload.length !== 1)) return invalid('Wrong number of listens.')

  if (type === 'playing_now') {
    const [listen] = payload
    const title = text(listen?.track_metadata?.track_name)
    const artist = text(listen?.track_metadata?.artist_name)
    if (!title || !artist) return invalid('track_name and artist_name are required.')
    const duration = Number(listen?.track_metadata?.additional_info?.duration_ms)
    const now = Date.now()
    const until = now + (duration > 0 && duration <= MAX_DURATION_MS ? duration : PLAYING_NOW_MAX_MS)
    // The same song sent again while it plays does not restart it (ListenBrainz: handle_playing_now).
    await env.DB.prepare(
      `INSERT INTO music (kind, title, artist, at, until) VALUES ('playing_now', ?1, ?2, ?3, ?4)
       ON CONFLICT(kind) DO UPDATE SET title = ?1, artist = ?2, at = ?3, until = ?4
       WHERE NOT (music.title = ?1 AND music.artist = ?2 AND music.until > ?3)`,
    )
      .bind(title, artist, now, until)
      .run()
    return json({ status: 'ok' })
  }

  // single or import: keep the newest valid listen. Only newer listens replace the stored one;
  // both sides are the phone's listened_at, so one clock is compared with itself.
  const latest = Math.floor(Date.now() / 1000) + ALLOWED_SKEW_S
  let newest: { title: string; artist: string; at: number } | null = null
  for (const listen of payload) {
    const title = text(listen?.track_metadata?.track_name)
    const artist = text(listen?.track_metadata?.artist_name)
    const at = Number(listen?.listened_at)
    if (!title || !artist || !Number.isInteger(at) || at < MIN_LISTENED_AT || at >= latest) continue
    if (!newest || at * 1000 > newest.at) newest = { title, artist, at: at * 1000 }
  }
  if (!newest) return invalid('No valid listen (track_name, artist_name, listened_at).')
  await env.DB.prepare(
    `INSERT INTO music (kind, title, artist, at) VALUES ('listen', ?1, ?2, ?3)
     ON CONFLICT(kind) DO UPDATE SET title = ?1, artist = ?2, at = ?3 WHERE ?3 > music.at`,
  )
    .bind(newest.title, newest.artist, newest.at)
    .run()
  return json({ status: 'ok' })
}
