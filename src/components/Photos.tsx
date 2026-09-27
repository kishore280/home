import { useRef, type MouseEvent } from 'react'
import { site } from '../data'
import type { PhotoAlbum } from '../lib/api'
import { useSaved } from '../lib/saved'
import { Card } from './Card'

// The newest photos of kish's shared Google Photos album (/api/photos, worker/photos.ts). Google's
// image server makes each size: a 400 px WebP square for the grid (about 40 kB, 3 per row, so it is
// sharp on a 2x screen). A tap opens the viewer (src/lib/photoViewer.ts, PhotoSwipe) on the original
// photo; its code starts downloading when a finger or pointer comes near the grid. Without
// JavaScript, or with a middle click, the link opens the original. No referrer goes to Google.
// Last in the main column: when it arrives, only the footer below it moves. A reload shows the last
// answer at once (useSaved).
const viewer = () => import('../lib/photoViewer')
const day = new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone, day: 'numeric', month: 'short' })
const preload = () => void viewer()

export function Photos() {
  const { data } = useSaved<PhotoAlbum>(site.photosAlbum ? '/api/photos' : null)
  const grid = useRef<HTMLUListElement>(null)
  if (!data?.photos.length) return null

  const show = (e: MouseEvent, i: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // a new tab, as the link says
    e.preventDefault()
    void viewer().then(({ openViewer }) => grid.current && openViewer(grid.current, i))
  }

  return (
    <Card title="photos" id="photos">
      <ul className="photos" ref={grid} onPointerEnter={preload} onPointerDown={preload} onFocus={preload}>
        {data.photos.map((p, i) => {
          // A different name for each photo (two can share a day), so each link says which one it opens.
          const alt = `Photo ${i + 1} of ${data.photos.length} from kish’s album, added ${day.format(new Date(p.added))}`
          return (
            <li key={p.id}>
              <a
                href={`${p.url}=s0`}
                target="_blank"
                rel="noreferrer"
                referrerPolicy="no-referrer"
                data-pswp-width={p.width}
                data-pswp-height={p.height}
                data-cropped="true"
                data-download={`${p.url}=d`}
                data-umami-event="Photo open"
                onClick={(e) => show(e, i)}
              >
                <img src={`${p.url}=w400-h400-c-rw`} alt={alt} width={400} height={400} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              </a>
            </li>
          )
        })}
      </ul>
      <a className="photos-album" href={data.album} target="_blank" rel="noreferrer" data-umami-event="Photos album link">
        the whole album <span aria-hidden="true">↗</span>
      </a>
    </Card>
  )
}
