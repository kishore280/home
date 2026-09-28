import { useState, type MouseEvent } from 'react'
import { site } from '../data'
import type { PhotoAlbum } from '../lib/api'
import { lazyPreload } from '../lib/lazy'
import { useSaved } from '../lib/saved'
import { Card } from './Card'

// The newest photos of kish's shared Google Photos album (/api/photos, worker/photos.ts). Google's
// image server makes each size: a 400 px WebP square for each polaroid (about 40 kB, sharp on a 2x
// screen). A tap opens the viewer (PhotoViewer.tsx), which loads only then: it starts
// downloading when a finger or pointer comes near the grid. Without JavaScript, or with a middle
// click, the link still opens the original photo. No referrer goes to Google.
// Last in the main column: when it arrives, only the footer below it moves. A reload shows the last
// answer at once (useSaved). A photo that does not load (Google down or blocked) is hidden, and with
// none left the card is too (real data only).
const PhotoViewer = lazyPreload(() => import('./PhotoViewer'))
const day = new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone, day: 'numeric', month: 'short' })
const preload = () => void PhotoViewer.preload()
// The card shows at most 6 tiles (1 row on a wide screen, 2 rows of 3 on a phone); the viewer swipes
// through the whole album. With more photos, the 6th tile is "+N" and opens the viewer at the next one;
// with fewer, a "see all" tile fills the row and opens it at the first.
const TILES = 6
// A small pixel doodle under each polaroid, in turn (decoration: the album has no captions).
const pixels = (rows: string[]) => rows.flatMap((r, y) => [...r].map((c, x) => (c === 'x' ? `M${x} ${y}h1v1h-1z` : ''))).join('')
const DOODLES = [
  pixels(['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...']),
  pixels(['...x...', '..xxx..', 'xxxxxxx', '.xxxxx.', '.xx.xx.', 'x.....x']),
  pixels(['...x...', '...x...', 'xxx.xxx', '...x...', '...x...', '.......']),
]

export function Photos() {
  const { data } = useSaved<PhotoAlbum>(site.photosAlbum ? '/api/photos' : null)
  const [open, setOpen] = useState<number | null>(null)
  const [broken, setBroken] = useState<string[]>([])
  const photos = data?.photos.filter((p) => !broken.includes(p.id)) ?? []
  if (!photos.length) return null
  const more = photos.length > TILES ? photos.length - (TILES - 1) : 0
  const tiles = more ? photos.slice(0, TILES - 1) : photos
  const last = more ? { label: `+${more}`, word: 'more', at: TILES - 1 } : photos.length < TILES ? { label: 'see', word: 'all', at: 0 } : null

  const show = (e: MouseEvent, i: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // a new tab, as the link says
    e.preventDefault()
    setOpen(i)
  }

  return (
    <Card title="photos" id="photos">
      <ul className="photos" onPointerEnter={preload} onPointerDown={preload} onFocus={preload}>
        {tiles.map((p, i) => {
          // A different name for each photo (two can share a day), so each link says which one it opens.
          const alt = `${p.video ? 'Video' : 'Photo'} ${i + 1} of ${photos.length} from kish’s album, added ${day.format(new Date(p.added))}`
          return (
            <li key={p.id}>
              <a
                href={`${p.url}=${p.video ? 'm37' : 's0'}`}
                target="_blank"
                rel="noreferrer"
                referrerPolicy="no-referrer"
                data-umami-event={p.video ? 'Video open' : 'Photo open'}
                onClick={(e) => show(e, i)}
              >
                <img src={`${p.url}=w400-h400-c-rw`} alt={alt} width={400} height={400} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken((b) => [...b, p.id])} />
                {p.video ? <span className="play" aria-hidden="true" /> : null}
              </a>
              <svg className="doodle" viewBox="0 0 7 6" aria-hidden="true">
                <path d={DOODLES[i % DOODLES.length]} />
              </svg>
            </li>
          )
        })}
        {last ? (
          <li>
            <button type="button" className="more" onClick={() => setOpen(last.at)} data-umami-event="Photo more">
              {last.label}
              <span>{last.word}</span>
            </button>
            <svg className="doodle" viewBox="0 0 7 6" aria-hidden="true">
              <path d={DOODLES[tiles.length % DOODLES.length]} />
            </svg>
          </li>
        ) : null}
      </ul>
      {open !== null ? <PhotoViewer photos={photos} index={open} onClose={() => setOpen(null)} /> : null}
    </Card>
  )
}
