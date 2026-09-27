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
// GET /api/log (worker/log.ts): every kind in log_kinds with its totals in IST. `last` is null for
// a kind with no entries (never logged, or every entry undone).
export type LogKind = {
  kind: string
  emoji: string
  label: string
  onceADay: boolean
  today: number
  month: number
  year: number
  total: number
  last: string | null
  place: string | null
  hours: number[] // 24 counts, hour of the day in IST (the chai clock)
}
export type LogSummary = { kinds: LogKind[] }
// GET /api/log/days?kind=chai: [day, count] for the days with an entry, in the last 365 days (IST).
export type Photo = { id: string; url: string; width: number; height: number; added: string }
export type PhotoAlbum = { album: string; photos: Photo[] }
export type LogDays = { from: string; to: string; days: [day: string, kind: string, count: number][] }
