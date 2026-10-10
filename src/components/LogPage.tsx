import { useEffect, useEffectEvent, useState, type FormEvent } from 'react'
import useSWR, { mutate } from 'swr'
import { logPage } from '../data'
import { fetcher, type LogKind, type LogSummary, type PhotoAlbum } from '../lib/api'
import { useIsClient } from '../lib/client'
import { load, remove, save } from '../lib/storage'
import { toast, useToastRequested } from '../lib/toast'
import { BackHome } from './BackHome'
import { Card } from './Card'
import { Counts } from './Counts'
import { KindIcon } from './KindIcon'
// Part of this page's bundle, not lazy: the page must work with no signal (the service worker
// precaches it), and a lazy chunk may not load then.
import Toasts from './Toasts'

// The private /log page: kish taps a button, the Worker stores it (worker/log.ts, Bearer token,
// the way anonrig/adamvsyagiz.com logs check-ins). With no signal, the service worker keeps the
// request and sends it later (Workbox background sync, scripts/sw.mjs).
// The buttons come from the kinds in the database (log_kinds): a new kind needs no code change.
const TOKEN_KEY = 'log-token'

const post = (token: string, path: string, body: object) =>
  fetch(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

// Ask Google for the album again now (worker/photos.ts), instead of waiting for the hour. The
// browser keeps the new answer too (cache: 'reload'), so the home page shows it at once here.
async function refreshPhotos(token: string) {
  const res = await fetch('/api/photos', { headers: { authorization: `Bearer ${token}` }, cache: 'reload' }).catch(() => null)
  const count = res?.ok ? ((await res.json()) as PhotoAlbum).photos.length : null
  const where = res?.headers.get('x-photos-refreshed') === 'everywhere' ? 'everywhere' : 'near you'
  toast(count === null ? 'Could not refresh the photos. Try again.' : `Photos refreshed ${where}: ${count} on the site`, { error: count === null })
}

// Fresh counts after a change: /api/log may be in the browser's cache for 15 s.
const refresh = () => mutate('/api/log', fetcher<LogSummary>('/api/log', { cache: 'no-store' }), { revalidate: false })

// Offline, the fetch fails but the service worker has queued the request (if it controls the page).
const queued = () => Boolean(navigator.serviceWorker?.controller)

// Sending and its toasts live outside React state (toasts and SWR's cache are their own stores),
// so the page only changes its state in its own event handlers.
async function sendUndo(token: string, id: string) {
  try {
    const res = await post(token, '/api/log/undo', { id })
    toast(res.ok ? 'Undone' : 'Could not undo. Try again.', { error: !res.ok })
  } catch {
    toast(queued() ? 'No signal: the undo will be sent when you are back online.' : 'No signal: not undone.', { error: !queued() })
  }
  void refresh()
}

// Logs one entry and shows the result, with Undo. 'unauthorized' means the token is wrong.
async function sendLog(token: string, kind: LogKind, count: number, place?: string): Promise<'ok' | 'unauthorized' | 'failed'> {
  navigator.vibrate?.(30) // a short buzz as the tap is taken (Android; other browsers ignore it)
  const id = crypto.randomUUID() // the Worker counts a replayed request once
  const label = `${kind.kind} +${count}`
  const icon = <KindIcon kind={kind.kind} emoji={kind.emoji} /> // chai: the glass
  const action = { label: 'Undo', onClick: () => void sendUndo(token, id) }
  // The phone's time zone, kept with the entry (days are counted in IST; this keeps the truth).
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  try {
    const res = await post(token, '/api/log', { id, kind: kind.kind, count, at: Date.now(), tz, place })
    if (res.status === 401) return 'unauthorized'
    const reply = (await res.json().catch(() => ({}))) as { duplicate?: boolean; today?: number; month?: number; error?: string }
    if (!res.ok) {
      // e.g. 503 "Logging is not set up yet: …" says what to do.
      toast(reply.error ?? `Could not log ${kind.kind}. Try again.`, { error: true })
      return 'failed'
    }
    if (reply.duplicate) toast(`today is already a ${kind.kind} day`, { icon })
    // With the new total, as adamvsyagiz.com's log page does: "chai +1 · 3 today".
    else toast(`${label} · ${kind.onceADay ? `${reply.month} this month` : `${reply.today} today`}`, { action, icon })
    return 'ok'
  } catch {
    if (!queued()) {
      toast('No signal: not saved. Try again online.', { error: true })
      return 'failed'
    }
    toast(`${label}: no signal, it will be sent when you are back online`, { action, icon })
    return 'ok'
  } finally {
    void refresh()
  }
}

export function LogPage() {
  const isClient = useIsClient()
  const [token, setToken] = useState<string | null>(() => (typeof window === 'undefined' ? null : load(TOKEN_KEY)))
  const [place, setPlace] = useState('')
  const toastRequested = useToastRequested()
  // The same request as the counts card (SWR shares it). Offline, the service worker answers with
  // the last copy, so the buttons are there with no signal too.
  const { data, error } = useSWR('/api/log', fetcher<LogSummary>)
  const kinds = data?.kinds

  function forget(message?: string) {
    remove(TOKEN_KEY)
    setToken(null)
    if (message) toast(message, { error: true })
  }

  async function log(kind: LogKind, count = 1) {
    if (!token) return
    // The place goes with a once-a-day kind (a beach day at "Marina").
    const result = await sendLog(token, kind, count, kind.onceADay ? place.trim() || undefined : undefined)
    if (result === 'unauthorized') forget('That token is not right. Enter it again.')
    else if (result === 'ok' && kind.onceADay) setPlace('')
  }

  // The installed app's long-press shortcuts open /log?add=chai (public/log.webmanifest). Only the
  // installed app may log from a link, so a link on another site cannot add chai in a browser tab.
  // useEffectEvent: the effect runs once the token is known and can call the latest `forget`
  // (React docs, "Separating Events from Effects").
  const onShortcutResult = useEffectEvent((result: Awaited<ReturnType<typeof sendLog>>) => {
    if (result === 'unauthorized') forget('That token is not right. Enter it again.')
  })
  useEffect(() => {
    const add = new URLSearchParams(location.search).get('add')
    if (!token || !add || !kinds) return // wait for the token and the kinds
    history.replaceState(null, '', location.pathname) // a reload does not log again
    const kind = kinds.find((k) => k.kind === add)
    if (kind && matchMedia('(display-mode: standalone)').matches) void sendLog(token, kind, 1).then(onShortcutResult)
  }, [token, kinds])

  function saveToken(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('token')?.toString().trim()
    if (!value) return
    save(TOKEN_KEY, value)
    setToken(value)
  }

  return (
    <main className="narrow-page" id="main">
      <Card>
        <h1>{logPage.heading}</h1>
        {!isClient ? null : token ? (
          <>
            {kinds ? (
              <div className="log-buttons">
                {/* A once-a-day kind has one button ("beach day"); others +1 and +2. */}
                {kinds.flatMap((kind) =>
                  (kind.onceADay ? [0] : [1, 2]).map((count) => (
                    <button key={`${kind.kind}${count}`} type="button" onClick={() => void log(kind, count || 1)}>
                      <KindIcon kind={kind.kind} emoji={kind.emoji} /> {kind.kind} {count ? `+${count}` : 'day'}
                    </button>
                  )),
                )}
              </div>
            ) : (
              <p className="log-status" role="status">
                {error ? 'Could not load the buttons. Open this page once with a signal.' : 'Loading…'}
              </p>
            )}
            {kinds?.some((k) => k.onceADay) ? (
              <label className="log-place">
                {kinds.filter((k) => k.onceADay).map((k) => k.kind).join(' / ')} place (optional)
                <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={60} autoComplete="off" />
              </label>
            ) : null}
            <div className="log-links">
              <button type="button" className="link-button" onClick={() => void refreshPhotos(token)}>
                refresh photos
              </button>
              <button type="button" className="link-button" onClick={() => forget()}>
                forget token on this device
              </button>
            </div>
          </>
        ) : (
          // A real sign-in form, so the phone's password manager offers to save the token.
          <form className="log-token" onSubmit={saveToken}>
            <input type="text" name="username" autoComplete="username" value="kishore" readOnly hidden />
            <label>
              token
              {/* spellcheck off: the keyboard never learns or suggests the token. */}
              <input name="token" type="password" autoComplete="current-password" spellCheck={false} required minLength={20} />
            </label>
            <button type="submit">save</button>
          </form>
        )}
      </Card>
      <Counts />
      <BackHome />
      {toastRequested ? <Toasts /> : null}
    </main>
  )
}
