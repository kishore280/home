import { useSyncExternalStore } from 'react'

const noop = () => () => {}

// false while pre-rendering and during hydration, true after. Parts that depend on the
// visitor's clock (mascot mode, local time, "today" counts) render only on the client,
// so the pre-rendered HTML and the first client render match.
export const useIsClient = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
