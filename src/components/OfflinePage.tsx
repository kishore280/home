import { useEffect, useRef } from 'react'
import { offlineNote } from '../data'
import { useOnline } from '../lib/client'
import { trackOnce } from '../lib/track'
import { Card } from './Card'

// The /offline page (idea: chrisbolin.co/offline): the note opens only while the browser is
// offline. The service worker from scripts/sw.mjs keeps the page working without a network.
export function OfflinePage() {
  const online = useOnline()
  const wasOffline = useRef(false)

  // Umami cannot send while offline, so count the read when the visitor comes back online.
  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) trackOnce('Offline note read')
  }, [online])

  return (
    <main className="offline-page" id="main">
      <Card>
        <h1>{online ? 'offline only' : 'wifi off, chai on'}</h1>
        <div className={online ? 'offline-note' : 'offline-note open'} aria-live="polite">
          {(online ? offlineNote.online : offlineNote.offline).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Card>
      <a className="small" href="/">
        <span aria-hidden="true">←</span> back to kish’s corner
      </a>
    </main>
  )
}
