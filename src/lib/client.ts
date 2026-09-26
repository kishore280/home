import { useEffect, useState, useSyncExternalStore } from 'react'

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

// Besides 'online'/'offline', check again when the page comes back into view: a phone can miss
// the event while the visitor is in Settings turning on airplane mode (Safari on iOS).
const NETWORK_EVENTS = ['online', 'offline', 'pageshow'] as const
const subscribeOnline = (onChange: () => void) => {
  for (const e of NETWORK_EVENTS) window.addEventListener(e, onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    for (const e of NETWORK_EVENTS) window.removeEventListener(e, onChange)
    document.removeEventListener('visibilitychange', onChange)
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

// True once the service worker is active, so this site also works offline. Never true in
// `npm run dev`, which has no service worker.
export function useOfflineReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    navigator.serviceWorker?.ready.then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])
  return ready
}
