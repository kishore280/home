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
// The phone's numbers are for its day; on a new day (in the site's time zone) there are none yet.
const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone || undefined })

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
  const sameDay = reels ? dayOf.format(Date.parse(reels.at)) === dayOf.format(now) : false
  const todayReels = sameDay ? (reels?.today ?? 0) : 0
  // On hover: how long a reel lasts today, from the app's own numbers.
  const scrollHint =
    sameDay && reels?.perReel != null ? `about ${reels.perReel} s per reel · ${reels.minutes ?? 0} min in Reels today` : undefined

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
          <div className="row" title={scrollHint}>
            <dt>
              <img className={`brain${rotting ? ' live' : ''}`} src={`/brain/${brain(todayReels)}.webp`} alt="" width={22} height={18} />
              {rotting ? 'brain rotting' : 'last rot'}
            </dt>
            <dd key={todayReels} className="swap-in">
              {todayReels ? `${todayReels} ${todayReels === 1 ? 'reel' : 'reels'} today` : 'none today'}
              {rotting ? null : <span className="muted"> · {timeAgo(reels.at, now)}</span>}
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
