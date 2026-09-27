import Lightbox, { type SlideImage } from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Download from 'yet-another-react-lightbox/plugins/download'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/plugins/counter.css'
import 'yet-another-react-lightbox/styles.css'
import type { Photo } from '../lib/api'

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
const slide = (p: Photo): SlideImage => ({ src: `${p.url}=s0`, width: p.width, height: p.height, download: `${p.url}=d` })

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
      plugins={[Zoom, Counter, Download]}
      className="viewer"
      zoom={{ maxZoomPixelRatio: 1 }}
      download={{ download: ({ slide: current }) => open(typeof current.download === 'string' ? current.download : '') }}
      controller={{ closeOnBackdropClick: true }}
      carousel={{ finite: photos.length < 3, preload: 1 }}
    />
  )
}
