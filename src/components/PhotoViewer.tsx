import Lightbox, { type Slide } from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Download from 'yet-another-react-lightbox/plugins/download'
import Video from 'yet-another-react-lightbox/plugins/video'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/plugins/counter.css'
import 'yet-another-react-lightbox/styles.css'
import type { Photo } from '../lib/api'
import { track } from '../lib/track'

// The photo viewer: Yet Another React Lightbox (swipe, keys, pinch and double-tap zoom, counter,
// download). Loaded only when a photo is about to open (lazyPreload in Photos.tsx). Styled with the
// library's documented CSS variables from the site's tokens (.viewer in src/index.css), so it follows
// light and dark.
// The original file, at once: =s0 is the photo exactly as it was put in the album, full size. Zoom
// stops at its real pixels (maxZoomPixelRatio 1). Only the photo before and after are loaded ahead,
// not every original (they are about 2 MB each).
// Download: Google's =d link answers "Content-Disposition: attachment" with the original file, so
// opening it downloads it. Our own download function (the plugin's documented `download.download`)
// opens it at once; the plugin's default first probes the URL with a synchronous XHR, which the
// site's CSP blocks for Google (connect-src), and logs an error.
// A video (the plugin's documented `sources`): Google's stream, 1080p first, then 720p and 360p, as
// the browser takes the first source it can play. It plays at once, as it opens on a tap. Its
// download (=dv) is the original file.
const slide = (p: Photo): Slide =>
  p.video
    ? {
        type: 'video',
        width: p.width,
        height: p.height,
        poster: `${p.url}=s1920`,
        autoPlay: true,
        sources: ['m37', 'm22', 'm18'].map((q) => ({ src: `${p.url}=${q}`, type: 'video/mp4' })),
        download: `${p.url}=dv`,
      }
    : { src: `${p.url}=s0`, width: p.width, height: p.height, download: `${p.url}=d` }

function open(url: string) {
  const link = Object.assign(document.createElement('a'), { href: url, rel: 'noopener noreferrer' })
  link.click()
}

export default function PhotoViewer({ photos, index, onClose }: { photos: Photo[]; index: number; onClose: () => void }) {
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={photos.map(slide)}
      plugins={[Zoom, Counter, Download, Video]}
      className="viewer"
      zoom={{ maxZoomPixelRatio: 1 }}
      download={{
        download: ({ slide: current }) => {
          track('Photo download')
          open(typeof current.download === 'string' ? current.download : '')
        },
      }}
      controller={{ closeOnBackdropClick: true }}
      carousel={{ finite: photos.length < 3, preload: 1 }}
    />
  )
}
