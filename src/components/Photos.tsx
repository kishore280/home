import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { photos, type Photo } from '../data'

const background = (p: Photo) =>
  p.src ? `center / cover url(${p.src})` : `linear-gradient(160deg, ${p.from}, ${p.to})`

export function Photos({ open, onOpen }: { open: number | null; onOpen: (i: number | null) => void }) {
  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpen(null)
      if (e.key === 'ArrowRight') onOpen((open + 1) % photos.length)
      if (e.key === 'ArrowLeft') onOpen((open - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpen])

  return (
    <>
      <div className="photos">
        {photos.map((p, i) => (
          <motion.button
            key={p.caption}
            layoutId={`photo-${i}`}
            type="button"
            className="photo"
            aria-label={`Open photo: ${p.caption}`}
            style={{ background: background(p) }}
            whileHover={{ y: -4, rotate: -1 }}
            onClick={() => onOpen(i)}
          />
        ))}
      </div>
      <p className="caption">{photos.length} photos · click to open</p>

      <AnimatePresence>
        {open !== null && (
          <motion.div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={photos[open].caption}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpen(null)}
          >
            <figure onClick={(e) => e.stopPropagation()}>
              <motion.div
                layoutId={`photo-${open}`}
                className="lightbox-photo"
                style={{ background: background(photos[open]) }}
              />
              <figcaption>
                <span>
                  {photos[open].caption} · {open + 1}/{photos.length}
                </span>
                <span>esc · ← →</span>
              </figcaption>
            </figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
