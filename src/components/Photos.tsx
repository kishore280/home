import { useState, type MouseEvent } from 'react'
import { site } from '../data'
import type { PhotoAlbum } from '../lib/api'
import { lazyPreload } from '../lib/lazy'
import { useSaved } from '../lib/saved'
import { Card } from './Card'

// The newest photos of kish's shared Google Photos album (/api/photos, worker/photos.ts). Google's
// image server makes each size: a 400 px WebP square for the grid (about 40 kB, 3 per row, so it is
// sharp on a 2x screen). A tap opens the viewer (PhotoViewer.tsx), which loads only then: it starts
// downloading when a finger or pointer comes near the grid. Without JavaScript, or with a middle
// click, the link still opens the original photo. No referrer goes to Google.
// Last in the main column: when it arrives, only the footer below it moves. A reload shows the last
// answer at once (useSaved). A photo that does not load (Google down or blocked) is hidden, and with
// none left the card is too (real data only).
const PhotoViewer = lazyPreload(() => import('./PhotoViewer'))
const day = new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone, day: 'numeric', month: 'short' })
const preload = () => void PhotoViewer.preload()

export function Photos() {
  const { data } = useSaved<PhotoAlbum>(site.photosAlbum ? '/api/photos' : null)
  const [open, setOpen] = useState<number | null>(null)
  const [broken, setBroken] = useState<string[]>([])
  const photos = data?.photos.filter((p) => !broken.includes(p.id)) ?? []
  if (!photos.length) return null

  const show = (e: MouseEvent, i: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // a new tab, as the link says
    e.preventDefault()
    setOpen(i)
  }

  return (
    <Card title="photos" id="photos">
      <ul className="photos" onPointerEnter={preload} onPointerDown={preload} onFocus={preload}>
        {photos.map((p, i) => {
          // A different name for each photo (two can share a day), so each link says which one it opens.
          const alt = `Photo ${i + 1} of ${photos.length} from kish’s album, added ${day.format(new Date(p.added))}`
          return (
            <li key={p.id}>
              <a
                href={`${p.url}=s0`}
                target="_blank"
                rel="noreferrer"
                referrerPolicy="no-referrer"
                data-umami-event="Photo open"
                onClick={(e) => show(e, i)}
              >
                <img src={`${p.url}=w400-h400-c-rw`} alt={alt} width={400} height={400} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken((b) => [...b, p.id])} />
              </a>
            </li>
          )
        })}
      </ul>
      {open !== null ? <PhotoViewer photos={photos} index={open} onClose={() => setOpen(null)} /> : null}
    </Card>
  )
}
