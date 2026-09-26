import { AnimatePresence, motion } from 'motion/react'

export type Track = { title: string; artist: string; playing: boolean }

export function NowPlaying({ track }: { track: Track }) {
  return (
    <div className="row">
      <div className="row-key">
        <span className={`bars${track.playing ? '' : ' paused'}`} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        {track.playing ? 'listening' : 'last played'}
      </div>
      <div className="row-value">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={track.title + track.artist}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {track.title} <span className="muted">— {track.artist}</span>
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="row-meta">last.fm</div>
    </div>
  )
}
