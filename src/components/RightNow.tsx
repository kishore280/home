import useSWR from 'swr'
import { fetcher, type Push, type Scroll, type Track } from '../lib/api'
import { timeAgo } from '../lib/time'
import { site } from '../data'
import { useIsClient, useNow } from '../lib/client'
import { Card } from './Card'

// Built once, not every 10 s (Vercel rule js-cache-function-results).
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone || undefined, hour: '2-digit', minute: '2-digit' })

function Clock() {
  // The time is only known on the visitor's device; the pre-rendered HTML leaves it empty.
  if (!useIsClient()) return null
  return <ClockTime />
}

function ClockTime() {
  const now = new Date(useNow(10_000))
  return (
    <time className="clock" dateTime={now.toISOString()}>
      {timeFormat.format(now)}
    </time>
  )
}

// The brain from the Brainrot app (github.com/kishore280/brainRot, its BrainRot.kt): it gets worse
// at 10, 25, 50, 100, 175 and 250 reels. public/brain/0-6.webp are its 7 sprites.
const BRAIN_AT = [0, 10, 25, 50, 100, 175, 250]
const brain = (reels: number) => BRAIN_AT.findLastIndex((at) => reels >= at)
// The phone reports every 30 s while it scrolls; with no report for 3 min, the session is over.
const QUIET_MS = 3 * 60_000
const minutes = (from: string, to: string) => `${Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60_000))} min`

// A line kept for a row whose data is still loading, so the card does not grow when it arrives
// (web.dev "Optimize CLS": reserve space for late content). It is in the pre-rendered HTML.
const pendingRow = (
  <div className="row pending" aria-hidden="true">
    <dt />
    <dd />
  </div>
)

export function RightNow() {
  const now = useNow(30_000)
  const music = useSWR('/api/now-playing', fetcher<Track>, { refreshInterval: 30_000 })
  const github = useSWR(site.github ? '/api/github' : null, fetcher<Push>, { refreshInterval: 300_000 })
  const scroll = useSWR('/api/scroll', fetcher<Scroll>, { refreshInterval: 30_000 })
  // Still loading: no data yet and no error. A 204 or an error gives null or an error: row hidden.
  const musicPending = music.data === undefined && !music.error
  const githubPending = Boolean(site.github) && github.data === undefined && !github.error
  const scrollPending = scroll.data === undefined && !scroll.error
  const track = music.data
  const push = github.data
  const reels = scroll.data

  if (!track && !push && !reels && !site.timeZone && !musicPending && !githubPending && !scrollPending) return null
  // The data only arrives in the browser, so `now` here is the visitor's clock (pre-render safe).
  const playing = track ? now < Date.parse(track.until) : false
  const rotting = reels ? reels.scrolling && now - Date.parse(reels.at) < QUIET_MS : false

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
              {playing ? null : <span className="muted"> · {timeAgo(track.at, now)}</span>}
            </dd>
          </div>
        ) : null}
        {scrollPending ? pendingRow : null}
        {reels ? (
          <div className="row">
            <dt>
              <img className={`brain${rotting ? ' live' : ''}`} src={`/brain/${brain(reels.reels)}.webp`} alt="" width={22} height={18} />
              {rotting ? 'brain rotting' : 'last rot'}
            </dt>
            <dd key={reels.started} className="swap-in">
              {reels.reels} {reels.reels === 1 ? 'reel' : 'reels'}
              {rotting ? (
                <span className="muted"> · {reels.app}</span>
              ) : (
                <>
                  {' '}in {minutes(reels.started, reels.at)}
                  <span className="muted"> · {timeAgo(reels.at, now)}</span>
                </>
              )}
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
              <span className="muted"> · {timeAgo(push.at, now)}</span>
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
