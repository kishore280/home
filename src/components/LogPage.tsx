import { useEffect, useEffectEvent, useState, type FormEvent } from 'react'
import { mutate } from 'swr'
import { logPage } from '../data'
import { fetcher, type LogKind, type LogSummary } from '../lib/api'
import { useIsClient } from '../lib/client'
import { load, remove, save } from '../lib/storage'
import { toast, useToastRequested } from '../lib/toast'
import { BackHome } from './BackHome'
import { Card } from './Card'
import { Counts } from './Counts'
// Part of this page's bundle, not lazy: the page must work with no signal (the service worker
// precaches it), and a lazy chunk may not load then.
import Toasts from './Toasts'

// The private /log page: kish taps a button, the Worker stores it (worker/log.ts, Bearer token,
// the way anonrig/adamvsyagiz.com logs check-ins). With no signal, the service worker keeps the
// request and sends it later (Workbox background sync, scripts/sw.mjs).
const TOKEN_KEY = 'log-token'
const KINDS: LogKind[] = ['chai', 'parotta', 'beach']
const EMOJI: Record<LogKind, string> = { chai: '☕', parotta: '🫓', beach: '🌊' }

const post = (token: string, path: string, body: object) =>
  fetch(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

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
  const label = `${EMOJI[kind]} ${kind} +${count}`
  const action = { label: 'Undo', onClick: () => void sendUndo(token, id) }
  try {
    const res = await post(token, '/api/log', { id, kind, count, at: Date.now(), place })
    if (res.status === 401) return 'unauthorized'
    if (!res.ok) {
      toast(`Could not log ${kind}. Try again.`, { error: true })
      return 'failed'
    }
    const { duplicate } = (await res.json()) as { duplicate?: boolean }
    toast(duplicate ? `${EMOJI.beach} today is already a beach day` : label, duplicate ? {} : { action })
    return 'ok'
  } catch {
    if (!queued()) {
      toast('No signal: not saved. Try again online.', { error: true })
      return 'failed'
    }
    toast(`${label}: no signal, it will be sent when you are back online`, { action })
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

  function forget(message?: string) {
    remove(TOKEN_KEY)
    setToken(null)
    if (message) toast(message, { error: true })
  }

  async function log(kind: LogKind, count = 1) {
    if (!token) return
    const result = await sendLog(token, kind, count, kind === 'beach' ? place.trim() || undefined : undefined)
    if (result === 'unauthorized') forget('That token is not right. Enter it again.')
    else if (result === 'ok' && kind === 'beach') setPlace('')
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
    if (!token || !add) return
    history.replaceState(null, '', location.pathname) // a reload does not log again
    if (KINDS.includes(add as LogKind) && matchMedia('(display-mode: standalone)').matches)
      void sendLog(token, add as LogKind, 1).then(onShortcutResult)
  }, [token])

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
            <div className="log-buttons">
              <button type="button" onClick={() => void log('chai')}>
                <span aria-hidden="true">☕</span> chai +1
              </button>
              <button type="button" onClick={() => void log('parotta')}>
                <span aria-hidden="true">🫓</span> parotta +1
              </button>
              <button type="button" onClick={() => void log('parotta', 2)}>
                <span aria-hidden="true">🫓</span> parotta +2
              </button>
              <button type="button" onClick={() => void log('beach')}>
                <span aria-hidden="true">🌊</span> beach day
              </button>
            </div>
            <label className="log-place">
              beach place (optional)
              <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={60} autoComplete="off" />
            </label>
            <button type="button" className="link-button" onClick={() => forget()}>
              forget token on this device
            </button>
          </>
        ) : (
          // A real sign-in form, so the phone's password manager offers to save the token.
          <form className="log-token" onSubmit={saveToken}>
            <input type="text" name="username" autoComplete="username" value="kishore" readOnly hidden />
            <label>
              token
              <input name="token" type="password" autoComplete="current-password" required minLength={20} />
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
