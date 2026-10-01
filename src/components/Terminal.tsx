import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSWRConfig } from 'swr'
import type { Player, Source } from 'asciinema-player'
import { whenIdle } from '../lib/lazy'
import { COLS, ROWS, liveCast } from '../lib/live-cast'

// A real terminal session, replayed as text (asciinema-player; the idea is sofka.rs's). The recording
// is a small .cast file in public/casts/ (`asciinema rec`). The player (about 65 KB gzipped) loads when
// the box comes near the screen, once the browser is idle, so it never slows the first paint; until
// then the box keeps its size, so nothing moves.
//   chapters: buttons that jump to a part, also marked on the progress bar (posts).
//   loop: plays by itself, without controls, with a pause button (the home card); with reduced
//   motion it shows the end of the session and waits for play.
//   src: a .cast file, or a function that writes the session when the player loads (the home card,
//   lib/live-cast.ts; asciinema-player's "data source"). Keep that function stable (useCallback).
export function Terminal({ src, cols, rows, chapters = [], loop = false, label }: { src: string | (() => Source); cols: number; rows: number; chapters?: [number, string][]; loop?: boolean; label: string }) {
  const box = useRef<HTMLDivElement>(null)
  const player = useRef<Player | null>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    let gone = false
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || player.current) return
        seen.disconnect()
        whenIdle(() => void load())
      },
      { rootMargin: '200px' },
    )
    const load = async () => {
      const [{ create }] = await Promise.all([import('asciinema-player'), import('asciinema-player/dist/bundle/asciinema-player.css')])
      if (gone) return
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches
      player.current = create(typeof src === 'function' ? src() : src, el, {
        cols,
        rows,
        theme: 'rose-pine-moon',
        fit: 'width',
        terminalFontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        markers: chapters,
        ...(loop ? { autoPlay: !still, loop: true, idleTimeLimit: 4, controls: false, ...(still ? { poster: 'npt:99:00' } : {}) } : { idleTimeLimit: 2, poster: 'npt:0:03' }),
      })
      if (loop && still) setPaused(true)
    }
    seen.observe(el)
    return () => {
      gone = true
      seen.disconnect()
      player.current?.dispose()
      player.current = null
    }
    // One player per recording; the other props never change for a given src.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const toggle = () => {
    const p = player.current
    if (!p) return
    void (paused ? p.play() : p.pause())
    setPaused(!paused)
  }
  const jump = (time: number) => void player.current?.seek(time).then(() => player.current?.play())

  return (
    <figure className={loop ? 'terminal terminal-loop' : 'terminal'}>
      <div ref={box} className="terminal-box" style={{ '--cols': cols, '--rows': rows } as CSSProperties} />
      {chapters.length ? (
        <div className="chapters" role="group" aria-label="Jump to">
          {chapters.map(([time, name]) => (
            <button key={time} type="button" onClick={() => jump(time)} data-umami-event="Terminal chapter">
              <time>{`${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`}</time> {name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="terminal-foot">
        <figcaption className="small">{label}</figcaption>
        {loop ? (
          <button type="button" className="terminal-pause" onClick={toggle} data-umami-event="Terminal pause">
            {paused ? 'play' : 'pause'}
          </button>
        ) : null}
      </div>
    </figure>
  )
}

// The home card: the `kish` command types out the live numbers the other cards already fetched
// (lib/live-cast.ts reads them from SWR's cache, so it sends no request of its own). The session is
// written once, when the player loads; the loop replays it.
export function LiveTerminal() {
  const { cache } = useSWRConfig()
  const src = useCallback(() => ({ data: liveCast((key) => cache.get(key)?.data, cache.keys()) }), [cache])
  return <Terminal src={src} cols={COLS} rows={ROWS} loop label="my day, live: the kish command reads this site's own API" />
}
