// Shared SWR fetcher and the shapes returned by functions/api/*.
// A 204 or error means "no real data", so the part of the page stays hidden.

export async function fetcher<T>(url: string): Promise<T | null> {
  const res = await fetch(url)
  if (res.status !== 200) return null
  return res.json() as Promise<T>
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong. Try again.')
  return data as T
}

export type Track = { title: string; artist: string; playing: boolean }
export type Push = { repo: string; url: string; message: string | null; at: string }
export type Status = { content: string; face: string; timeAgo: string }
export type Note = { id: number; name: string; text: string; at: string }
export type Counters = { views: number; pats: number; notes: number }
