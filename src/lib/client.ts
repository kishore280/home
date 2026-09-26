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

// Real internet check. navigator.onLine only says a network exists: it stays true with a VPN on
// (Android keeps its virtual network in airplane mode) and on Wi-Fi without internet. So, like
// react-detect-offline's polling, also fetch a small file every 5 s and when the page comes back
// into view. robots.txt is a static file (no Worker request, no cost) that the service worker
// does not cache, and 'no-store' keeps the browser cache out of it.
const PING = { url: '/robots.txt', every: 5000, timeout: 4000 }
let reachable = true
const pingListeners = new Set<() => void>()
let pingTimer: ReturnType<typeof setInterval> | undefined

async function ping() {
  const ok = await fetch(PING.url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(PING.timeout) }).then(
    (r) => r.ok,
    () => false,
  )
  if (ok === reachable) return
  reachable = ok
  for (const onChange of pingListeners) onChange()
}

const subscribeReachable = (onChange: () => void) => {
  pingListeners.add(onChange)
  if (pingListeners.size === 1) {
    void ping()
    pingTimer = setInterval(ping, PING.every)
  }
  const stopEvents = subscribeOnline(() => {
    void ping()
    onChange()
  })
  return () => {
    stopEvents()
    pingListeners.delete(onChange)
    if (!pingListeners.size) clearInterval(pingTimer)
  }
}

// The network state. The pre-render and hydration assume online; after that it follows the
// 'online' and 'offline' events. With `check`, it also confirms real internet (see PING above);
// only the /offline page needs that.
export const useOnline = (check = false) =>
  useSyncExternalStore(
    check ? subscribeReachable : subscribeOnline,
    () => navigator.onLine && (!check || reachable),
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
