// Shared types and helpers for the API routes.

// Bindings (ASSETS, DB) come from wrangler.jsonc through worker-configuration.d.ts (npm run cf-typegen).
// SCROBBLE_TOKEN (the phone's token for worker/scrobble.ts and worker/log.ts) is a secret set in the
// Worker settings, so it is typed here.
// Secrets, set in the Cloudflare dashboard: the phone's token, and (optional) a Cache Purge API token
// for "refresh photos" everywhere (worker/photos.ts; ZONE_ID is a var in wrangler.jsonc).
export type Env = Cloudflare.Env & { SCROBBLE_TOKEN?: string; PURGE_TOKEN?: string }

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

// A request's body as JSON, with a size limit (checked before and after reading it). A Response is
// the error to send back: 413 for too big, 400 for not JSON.
export async function jsonBody(request: Request, max: number): Promise<{ body: unknown } | Response> {
  if (Number(request.headers.get('content-length')) > max) return fail('Body too large.', 413)
  const text = await request.text()
  if (text.length > max) return fail('Body too large.', 413)
  try {
    return { body: JSON.parse(text) }
  } catch {
    return fail('Body must be JSON.')
  }
}
