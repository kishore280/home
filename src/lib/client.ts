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

// The current time (ms), updated every `every` ms. Render stays pure: the clock is read in state
// and in a timer, not during render (React: "Keeping components pure"; oxlint react/purity).
export function useNow(every: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(id)
  }, [every])
  return now
}

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

// Real internet check, as Chrome does it: a request that fails means offline. navigator.onLine
// only says a network exists: it stays true with a VPN on (Android keeps its virtual network in
// airplane mode) and on Wi-Fi without internet. So, like react-detect-offline's polling, also
// fetch a small file every 5 s and when the page comes back into view. robots.txt is a static
// file (no Worker request, no cost) that the service worker does not cache; 'no-store' keeps the
// browser cache out of it.
const PING = { url: '/robots.txt', every: 5000, timeout: 4000 }
let reachable: boolean | null = null // null until the first check has answered
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

async function ping() {
  const ok = await fetch(PING.url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(PING.timeout) }).then(
    (r) => r.ok,
    () => false,
  )
  if (ok === reachable) return
  reachable = ok
  for (const onChange of listeners) onChange()
}

const subscribeConnection = (onChange: () => void) => {
  listeners.add(onChange)
  if (listeners.size === 1) {
    void ping()
    timer = setInterval(ping, PING.every)
  }
  const stopEvents = subscribeOnline(() => {
    void ping()
    onChange()
  })
  return () => {
    stopEvents()
    listeners.delete(onChange)
    if (!listeners.size) clearInterval(timer)
  }
}

export type Connection = 'online' | 'offline'

// Until the first check, trust the state the page was rendered with: the service worker already
// made the real request for this page and served the offline version if it failed.
const current = (initial: Connection): Connection =>
  !navigator.onLine || reachable === false ? 'offline' : reachable === true ? 'online' : initial

// The connection, starting from the pre-rendered state (so hydration matches and nothing flashes),
// then following the browser's events and the real internet check.
export const useConnection = (initial: Connection) =>
  useSyncExternalStore(
    subscribeConnection,
    () => current(initial),
    () => initial,
  )
