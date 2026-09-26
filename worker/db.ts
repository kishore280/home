// Shared types and helpers for the API routes.

export interface Env {
  ASSETS: Fetcher
  // Optional: bind a D1 database named DB (see README) to turn on views and pats.
  DB?: D1Database
  // Optional: Last.fm, for the music row.
  LASTFM_API_KEY?: string
  LASTFM_USER?: string
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store' } })

export const fail = (error: string, status = 400) => json({ error }, status)
