// Shared SWR fetcher and the shapes returned by the Worker's /api/* routes.
// A 204 or error means "no real data", so the part of the page stays hidden.

export async function fetcher<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, init)
  if (res.status !== 200) return null
  return res.json() as Promise<T>
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export type Track = { title: string; artist: string; at: string; until: string }
export type Push = { repo: string; url: string; at: string }
export type Status = { content: string; face: string; timeAgo: string }
export type Counters = { views: number; pats: number }
// GET /api/log (worker/log.ts): totals per kind in IST; null for a kind never logged.
export type LogKind = 'chai' | 'parotta' | 'beach'
export type LogTotals = { today: number; month: number; year: number; total: number; last: string; place?: string | null }
export type LogSummary = Record<LogKind, LogTotals | null>
