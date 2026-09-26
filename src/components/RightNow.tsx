import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { fetcher, type Push, type Track } from '../lib/api'
import { timeAgo } from '../lib/time'
import { site } from '../data'
import { useIsClient } from '../lib/client'
import { Card } from './Card'

// Built once, not every 10 s (Vercel rule js-cache-function-results).
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone || undefined, hour: '2-digit', minute: '2-digit' })

function Clock() {
  // The time is only known on the visitor's device; the pre-rendered HTML leaves it empty.
  if (!useIsClient()) return null
  return <ClockTime />
}

function ClockTime() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return (
    <time className="clock" dateTime={now.toISOString()}>
      {timeFormat.format(now)}
    </time>
  )
}

// A line kept for a row whose data is still loading, so the card does not grow when it arrives
// (web.dev "Optimize CLS": reserve space for late content). It is in the pre-rendered HTML.
const pendingRow = (
  <div className="row pending" aria-hidden="true">
    <dt />
    <dd />
  </div>
)

export function RightNow() {
  const music = useSWR('/api/now-playing', fetcher<Track>, { refreshInterval: 30_000 })
  const github = useSWR(site.github ? '/api/github' : null, fetcher<Push>, { refreshInterval: 300_000 })
  // Still loading: no data yet and no error. A 204 or an error gives null or an error: row hidden.
  const musicPending = music.data === undefined && !music.error
  const githubPending = Boolean(site.github) && github.data === undefined && !github.error
  const track = music.data
  const push = github.data

  if (!track && !push && !site.timeZone && !musicPending && !githubPending) return null
  // Data from the API only arrives in the browser, so reading the clock here is pre-render safe.
  const playing = track ? Date.now() < Date.parse(track.until) : false

  return (
    <Card title="right now">
      <dl className="rows">
        {musicPending ? pendingRow : null}
        {track ? (
          <div className="row">
            <dt>
              <span className={`eq${playing ? '' : ' paused'}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {playing ? 'listening' : 'last played'}
            </dt>
            <dd key={track.title} className="swap-in">
              {track.title} <span className="muted">— {track.artist}</span>
              {playing ? null : <span className="muted"> · {timeAgo(track.at)}</span>}
            </dd>
          </div>
        ) : null}
        {githubPending ? pendingRow : null}
        {push ? (
          <div className="row">
            <dt>building</dt>
            <dd>
              <a href={push.url} target="_blank" rel="noreferrer" data-umami-event="GitHub repo link">
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
              <Clock />
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  )
}
