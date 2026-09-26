import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { fetcher, type Push, type Track } from '../lib/api'
import { timeAgo } from '../lib/time'
import { site } from '../data'
import { Card } from './Card'

function Clock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return (
    <time dateTime={now.toISOString()}>
      {now.toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' })}
    </time>
  )
}

export function RightNow() {
  const { data: track } = useSWR('/api/now-playing', fetcher<Track>, { refreshInterval: 30_000 })
  const { data: push } = useSWR(
    site.github ? `/api/github?user=${site.github}` : null,
    fetcher<Push>,
    { refreshInterval: 300_000 },
  )

  if (!track && !push && !site.timeZone) return null

  return (
    <Card title="right now">
      <dl className="rows">
        {track ? (
          <div className="row">
            <dt>
              <span className={`eq${track.playing ? '' : ' paused'}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {track.playing ? 'listening' : 'last played'}
            </dt>
            <dd key={track.title} className="swap-in">
              {track.title} <span className="muted">— {track.artist}</span>
            </dd>
          </div>
        ) : null}
        {push ? (
          <div className="row">
            <dt>building</dt>
            <dd>
              <a href={push.url} target="_blank" rel="noreferrer">
                {push.repo}
              </a>
              <span className="muted"> · {timeAgo(push.at)}</span>
            </dd>
          </div>
        ) : null}
        {site.timeZone ? (
          <div className="row">
            <dt>local time</dt>
            <dd>
              <Clock timeZone={site.timeZone} />
              {site.city ? <span className="muted"> in {site.city}</span> : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  )
}
