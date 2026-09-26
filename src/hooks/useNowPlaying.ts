import { useEffect, useState } from 'react'
import { exampleTracks, type Track } from '../data'

export type Live = { title: string; artist: string; playing: boolean }

export function useNowPlaying() {
  const [live, setLive] = useState<Live | null>(null)
  const [{ index, position }, setPlayhead] = useState({ index: 0, position: 72 })

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/now-playing')
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d: Live | null) => !cancelled && setLive(d))
        .catch(() => {})
    load()
    const id = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Example mode: advance a fake playhead through the example tracks.
  useEffect(() => {
    if (live) return
    const id = setInterval(
      () =>
        setPlayhead((p) =>
          p.position + 1 >= exampleTracks[p.index].seconds
            ? { index: (p.index + 1) % exampleTracks.length, position: 0 }
            : { ...p, position: p.position + 1 },
        ),
      1000,
    )
    return () => clearInterval(id)
  }, [live])

  const track: Track = exampleTracks[index]

  const next = () => {
    const i = (index + 1) % exampleTracks.length
    setPlayhead({ index: i, position: 0 })
    return exampleTracks[i]
  }

  return { live, track, position, next }
}
