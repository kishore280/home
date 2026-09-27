import PhotoSwipe from 'photoswipe'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import { track } from './track'
import 'photoswipe/style.css'
import './photoViewer.css'

// The photo viewer: PhotoSwipe v5 (photoswipe.com), loaded only when a photo is about to open
// (Photos.tsx imports this file on pointer, focus or tap). Chosen for how it opens: the photo grows
// out of its thumbnail ("zoom" transition, from the cropped square: data-cropped), and the thumbnail
// already on screen stands in while the original loads, so there is no blank wait. Swipe, arrow
// keys, pinch and double-tap zoom and the counter are built in; reduced motion turns the animations
// off (PhotoSwipe does this itself).
// The original: each link's href is =s0, the photo as it was put in the album, full size. Zoom stops
// at its real pixels. Download (the documented custom UI element) links to =d, which Google sends
// with "Content-Disposition: attachment", so a tap saves the original file.
// Motion: 300 ms in, 250 ms out, a strong ease-out (Emil Kowalski's design engineering rules:
// cubic-bezier(0.23, 1, 0.32, 1), modals 200-500 ms, a faster exit).
export function openViewer(gallery: HTMLElement, index: number) {
  const lightbox = new PhotoSwipeLightbox({
    pswpModule: PhotoSwipe,
    children: 'a[data-pswp-width]',
    bgOpacity: 1,
    initialZoomLevel: 'fit',
    secondaryZoomLevel: 1,
    maxZoomLevel: 1,
    showHideAnimationType: 'zoom',
    showAnimationDuration: 300,
    hideAnimationDuration: 250,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    padding: { top: 64, bottom: 24, left: 12, right: 12 },
  })
  // PhotoSwipe sets role="dialog" but no name; a dialog needs one (axe: aria-dialog-name).
  lightbox.on('firstUpdate', () => lightbox.pswp?.element?.setAttribute('aria-label', 'Photo viewer'))
  lightbox.on('uiRegister', () => {
    lightbox.pswp?.ui?.registerElement({
      name: 'download',
      title: 'Download',
      ariaLabel: 'Download the original',
      order: 8,
      isButton: true,
      tagName: 'a',
      html: {
        isCustomSVG: true,
        inner: '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1ZM23 23H9v2h14Z" id="pswp__icn-download"/>',
        outlineID: 'pswp__icn-download',
      },
      onInit: (el, pswp) => {
        el.setAttribute('rel', 'noopener noreferrer')
        el.addEventListener('click', () => track('Photo download'))
        const link = () => el.setAttribute('href', pswp.currSlide?.data.element?.dataset.download ?? '')
        link()
        pswp.on('change', link)
      },
    })
  })
  lightbox.loadAndOpen(index, { gallery })
}
