// Shared types and helpers for the API routes.

// Bindings (ASSETS, DB) come from wrangler.jsonc through worker-configuration.d.ts (npm run cf-typegen).
// SCROBBLE_TOKEN (the phone's token for worker/scrobble.ts and worker/log.ts) is a secret set in the
// Worker settings, so it is typed here.
// Secrets, set in the Cloudflare dashboard: the phone's token, and (optional) a Cache Purge API token
// with the zone's ID, for "refresh photos" everywhere (worker/photos.ts).
export type Env = Cloudflare.Env & { SCROBBLE_TOKEN?: string; PURGE_TOKEN?: string; ZONE_ID?: string }

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store' } })

export const fail = (error: string, status = 400) => json({ error }, status)

// Constant-time compare, as in Cloudflare's "Protect against timing attacks" example.
// https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/
// The token of an "Authorization: Bearer …" header (the phone's SCROBBLE_TOKEN).
export const bearer = (request: Request) => /^bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]

export async function tokenMatches(given: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!secret || !given) return false
  const encoder = new TextEncoder()
  const a = encoder.encode(given)
  const b = encoder.encode(secret)
  return a.byteLength === b.byteLength ? crypto.subtle.timingSafeEqual(a, b) : !crypto.subtle.timingSafeEqual(a, a)
}
