import useSWR from 'swr'
import { site } from '../data'
import { fetcher, type LogKind, type LogSummary } from '../lib/api'
import { useNow } from '../lib/client'
import { Card } from './Card'
import { ChaiClock } from './ChaiClock'
import { KindIcon } from './KindIcon'

// Everything logged from the /log page, one row per kind (worker/log.ts counts them in IST).
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone }) // YYYY-MM-DD
const clock = new Intl.DateTimeFormat('en-IN', { timeZone: site.timeZone, hour: 'numeric', minute: '2-digit' })
const shortDay = new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone, day: 'numeric', month: 'short' })

// "today, 8:15 pm" / "yesterday, 9:02 am" / "3 Sep, 7:40 pm". `now` is from useNow(); the data
// only arrives in the browser, so it is the visitor's clock (pre-render safe).
function when(iso: string, now: number) {
  const d = new Date(iso)
  const key = dayKey.format(d)
  const day = key === dayKey.format(now) ? 'today' : key === dayKey.format(now - 86_400_000) ? 'yesterday' : shortDay.format(d)
  return `${day}, ${clock.format(d)}`
}

// A once-a-day kind (beach days) counts days: this month and this year, with the last day and
// place. Any other kind counts taps: today and this month, with the time of the last one.
function Row({ kind, now }: { kind: LogKind & { last: string }; now: number }) {
  const main = kind.onceADay ? `${kind.month} this month` : `${kind.today} today`
  const sub = kind.onceADay
    ? `${kind.year} this year · last ${shortDay.format(new Date(kind.last))}${kind.place ? `, ${kind.place}` : ''}`
    : `${kind.month} this month · last ${when(kind.last, now)}`
  return (
    <div className="count">
      <dt>
        <KindIcon kind={kind.kind} emoji={kind.emoji} /> {kind.label}
      </dt>
      <dd className="count-main">{main}</dd>
      <dd className="count-sub">{sub}</dd>
    </div>
  )
}

// While the counts load, the clock's place and one line per kind, so the card does not grow when
// they arrive (web.dev "Optimize CLS"). It is in the pre-rendered HTML; 4 is the number of kinds today
// (log_kinds), so keep it equal when a kind is added (.claude/skills/add-log-kind).
const PENDING_ROWS = 4
const pendingRow = (i: number) => (
  <div className="count pending" key={i} aria-hidden="true">
    <dt />
    <dd className="count-main" />
    <dd className="count-sub" />
  </div>
)

const logged = (kind: LogKind): kind is LogKind & { last: string } => kind.last !== null

export function Counts() {
  const now = useNow(60_000)
  const { data, error } = useSWR('/api/log', fetcher<LogSummary>, { refreshInterval: 60_000 })
  const pending = data === undefined && !error
  // A kind never logged is hidden; with nothing logged at all, so is the card.
  const shown = data?.kinds.filter(logged) ?? []
  const chai = shown.find((k) => k.kind === 'chai')
  if (!pending && shown.length === 0) return null

  return (
    <Card title="counts" id="counts">
      {pending ? <div className="chai-clock pending" aria-hidden="true" /> : null}
      {chai && chai.hours.some(Boolean) ? <ChaiClock hours={chai.hours} /> : null}
      <dl className="counts">
        {pending
          ? Array.from({ length: PENDING_ROWS }, (_, i) => pendingRow(i))
          : shown.map((kind) => <Row key={kind.kind} kind={kind} now={now} />)}
      </dl>
    </Card>
  )
}
