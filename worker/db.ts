// Shared types and helpers for the API routes.

// Bindings (ASSETS, DB) come from wrangler.jsonc through worker-configuration.d.ts (npm run cf-typegen).
// Last.fm is optional and set in the Worker settings, so it is typed here.
export type Env = Cloudflare.Env & { LASTFM_API_KEY?: string; LASTFM_USER?: string }

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store' } })

export const fail = (error: string, status = 400) => json({ error }, status)
