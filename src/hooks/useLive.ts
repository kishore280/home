import { useEffect, useState } from 'react'

// Polls a Pages Function. Returns null until it answers with 200 and JSON,
// so a section can hide itself when there is no real data.
export function useLive<T>(url: string | null, everyMs = 60_000): T | null {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    const load = () =>
      fetch(url)
        .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
        .then((d: T | null) => !cancelled && setData(d))
        .catch(() => {})
    load()
    const id = setInterval(load, everyMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [url, everyMs])

  return data
}
