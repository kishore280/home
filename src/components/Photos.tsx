import { site } from '../data'
import type { PhotoAlbum } from '../lib/api'
import { useSaved } from '../lib/saved'
import { Card } from './Card'

// The newest photos of kish's shared Google Photos album (/api/photos, worker/photos.ts). Google's
// image server makes each size: a 400 px WebP square for the grid (about 40 kB, 3 per row, so it is
// sharp on a 2x screen), and a 2048 px WebP when a photo is opened. No referrer goes to Google.
// Last in the main column: when it arrives, only the footer below it moves. A reload shows the last
// answer at once (useSaved).
const day = new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone, day: 'numeric', month: 'short' })

export function Photos() {
  const { data } = useSaved<PhotoAlbum>(site.photosAlbum ? '/api/photos' : null)
  if (!data?.photos.length) return null

  return (
    <Card title="photos" id="photos">
      <ul className="photos">
        {data.photos.map((p, i) => {
          // A different name for each photo (two can share a day), so each link says which one it opens.
          const alt = `Photo ${i + 1} of ${data.photos.length} from kish’s album, added ${day.format(new Date(p.added))}`
          return (
            <li key={p.id}>
              <a href={`${p.url}=w2048-rw`} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" data-umami-event="Photo open">
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
