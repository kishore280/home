import { useEffect, useRef } from 'react'
import { offlineNote } from '../data'
import { useConnection, type Connection } from '../lib/client'
import { trackOnce } from '../lib/track'
import { BackHome } from './BackHome'
import { Card } from './Card'
// Part of this page's bundle, not lazy: a lazy chunk cannot load once the visitor is offline.
import SandCanvas from './SandCanvas'

// The /offline page (idea: chrisbolin.co/offline): the note opens only while the browser is
// offline. The service worker from scripts/sw.mjs keeps the page working without a network.
// `initial` is the state it was pre-rendered in: /offline is built twice (online and offline), and
// the service worker serves the offline one when the real request fails, so the first paint is right.
export function OfflinePage({ initial }: { initial: Connection }) {
  const connection = useConnection(initial)
  const online = connection === 'online'
  const wasOffline = useRef(false)

  // Umami cannot send while offline, so count the read when the visitor comes back online.
  useEffect(() => {
    if (connection === 'offline') wasOffline.current = true
    else if (connection === 'online' && wasOffline.current) trackOnce('Offline note read')
  }, [connection])

  return (
    <main className="narrow-page" id="main" data-connection={connection}>
      <Card>
        <h1>{online ? 'offline only' : 'wifi off, chai on'}</h1>
        <div className="offline-note" aria-live="polite">
          {(online ? offlineNote.online : offlineNote.offline).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Card>
      {online ? null : (
        <Card title="draw on the sand">
          <SandCanvas />
        </Card>
      )}
      <BackHome />
    </main>
  )
}
