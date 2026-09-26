import { useCallback } from 'react'
import useSWR from 'swr'
import { fetcher, post, type Counters } from '../lib/api'

const KEY = '/api/counters'

export function useCounters() {
  const { data, mutate } = useSWR(KEY, fetcher<Counters>)

  const bump = useCallback(
    (key: 'views' | 'pats') =>
      mutate(post<Counters>(KEY, { key }), {
        optimisticData: (current) => (current ? { ...current, [key]: current[key] + 1 } : null),
        rollbackOnError: true,
        revalidate: false,
      }).catch(() => {}),
    [mutate],
  )

  return { counters: data ?? null, bump }
}
