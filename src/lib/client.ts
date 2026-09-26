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

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

// The browser's network state. The pre-render and hydration assume online; after that it
// follows the 'online' and 'offline' events.
export const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
