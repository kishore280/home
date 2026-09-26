// Shared types and helpers for the API routes.

// Bindings (ASSETS, DB) come from wrangler.jsonc through worker-configuration.d.ts (npm run cf-typegen).
// SCROBBLE_TOKEN (worker/scrobble.ts) is a secret set in the Worker settings, so it is typed here.
export type Env = Cloudflare.Env & { SCROBBLE_TOKEN?: string }

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store' } })

export const fail = (error: string, status = 400) => json({ error }, status)
