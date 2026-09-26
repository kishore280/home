import { AnimatePresence, motion } from 'motion/react'
import type { useNowPlaying } from '../hooks/useNowPlaying'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function NowPlaying({ state }: { state: ReturnType<typeof useNowPlaying> }) {
  const { live, track, position } = state
  const title = live?.title ?? track.title
  const artist = live?.artist ?? track.artist
  const playing = live ? live.playing : true

  return (
    <div className="row">
      <div className="row-key">
        <span className={`bars${playing ? '' : ' paused'}`} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        {playing ? 'listening' : 'last played'}
      </div>
      <div className="row-value">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={title + artist}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {title} <span className="muted">— {artist}</span>
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="row-meta">{live ? 'last.fm' : fmt(position)}</div>
      {!live && (
        <div className="progress" aria-hidden="true">
          <div style={{ width: `${(position / track.seconds) * 100}%` }} />
        </div>
      )}
    </div>
  )
}
