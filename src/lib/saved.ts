import { useMemo } from 'react'
import useSWR, { type SWRConfiguration } from 'swr'
import { fetcher } from './api'
import { useIsClient } from './client'
import { load, save } from './storage'

// Stale-while-revalidate across visits (SWR docs, "Cache: LocalStorage based persistent cache"):
// the last answer is kept in localStorage and shown at once on the next visit, while SWR asks the
// Worker again and swaps in the fresh answer. So a reload shows the real rows, not loading lines.
// The saved answer is used only after hydration (useIsClient), so the first render still matches
// the pre-rendered HTML. The key is also read by the head script in src/head.html, which sizes the
// loading lines before the first paint.
export const savedKey = (key: string) => `swr ${key}`

function parse<T>(text: string | null): T | undefined {
  try {
    return text ? (JSON.parse(text) as T) : undefined
  } catch {
    return undefined
  }
}

export function useSaved<T>(key: string | null, options: SWRConfiguration<T | null> = {}) {
  const client = useIsClient()
  const saved = useMemo(() => (client && key ? parse<T>(load(savedKey(key))) : undefined), [client, key])
  const { data, error } = useSWR(key, fetcher<T>, {
    ...options,
    fallbackData: saved,
    onSuccess: (fresh) => {
      if (key && fresh) save(savedKey(key), JSON.stringify(fresh))
    },
  })
  return { data: client ? data : undefined, error }
}
