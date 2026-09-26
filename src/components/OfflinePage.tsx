import { useEffect, useRef } from 'react'
import { offlineNote } from '../data'
import { useOfflineReady, useOnline } from '../lib/client'
import { trackOnce } from '../lib/track'
import { BackHome } from './BackHome'
import { Card } from './Card'
// Part of this page's bundle, not lazy: a lazy chunk cannot load once the visitor is offline.
import SandCanvas from './SandCanvas'

// The /offline page (idea: chrisbolin.co/offline): the note opens only while the browser is
// offline. The service worker from scripts/sw.mjs keeps the page working without a network.
export function OfflinePage() {
  const online = useOnline()
  const ready = useOfflineReady()
  const wasOffline = useRef(false)

  // Umami cannot send while offline, so count the read when the visitor comes back online.
  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) trackOnce('Offline note read')
  }, [online])

  return (
    <main className="narrow-page" id="main">
      <Card>
        <h1>{online ? 'offline only' : 'wifi off, chai on'}</h1>
        <div className={online ? 'offline-note' : 'offline-note open'} aria-live="polite">
          {(online ? offlineNote.online : offlineNote.offline).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {online ? <p className="small">{ready ? offlineNote.ready : offlineNote.saving}</p> : null}
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
