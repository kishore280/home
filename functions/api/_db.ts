// Shared helpers for the D1-backed functions. Files that start with "_" are not routes.

export interface DbEnv {
  // Optional: bind a D1 database named DB in the Pages project settings to turn these on.
  DB?: D1Database
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store' } })

export const fail = (error: string, status = 400) => json({ error }, status)
