import { useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { fetcher, post, type Counters } from '../lib/api'

const KEY = '/api/counters'

// Decide once per page load (Vercel rule advanced-init-once) whether this visit
// counts as a view: one per browser session.
const countView = (() => {
  try {
    if (sessionStorage.getItem('viewed')) return false
    sessionStorage.setItem('viewed', '1')
  } catch {
    // Storage blocked: count the view anyway.
  }
  return true
})()
let viewSent = false

export function useCounters() {
  // When this visit counts a view, the POST returns the counters, so skip the first GET.
  const { data, mutate } = useSWR(KEY, fetcher<Counters>, { revalidateOnMount: !countView })

  const bump = useCallback(
    (key: 'views' | 'pats') =>
      mutate(post<Counters>(KEY, { key }), {
        optimisticData: (current) => (current ? { ...current, [key]: current[key] + 1 } : null),
        rollbackOnError: true,
        revalidate: false,
      }).catch(() => {}),
    [mutate],
  )

  useEffect(() => {
    if (!countView || viewSent) return
    viewSent = true
    void bump('views')
  }, [bump])

  return { counters: data ?? null, bump }
}
