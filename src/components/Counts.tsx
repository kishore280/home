import type { ReactNode } from 'react'
import useSWR from 'swr'
import { site } from '../data'
import { fetcher, type LogSummary, type LogTotals } from '../lib/api'
import { useNow } from '../lib/client'
import { Card } from './Card'
import { chaiIcon } from './ChaiIcon'

// Chai, parotta and beach days, logged from the /log page (worker/log.ts counts them in IST).
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

function Row({ label, main, sub }: { label: ReactNode; main: string; sub: string }) {
  return (
    <div className="count">
      <dt>{label}</dt>
      <dd className="count-main">{main}</dd>
      <dd className="count-sub">{sub}</dd>
    </div>
  )
}

// A line kept for each kind while the counts load, so the card does not grow when they arrive
// (web.dev "Optimize CLS"). It is in the pre-rendered HTML.
const pendingRow = (key: string) => (
  <div className="count pending" key={key} aria-hidden="true">
    <dt />
    <dd className="count-main" />
    <dd className="count-sub" />
  </div>
)

const rows: [keyof LogSummary, (t: LogTotals, now: number) => ReactNode][] = [
  [
    'parotta',
    (t, now) => (
      <Row
        key="parotta"
        label={
          <>
            <span aria-hidden="true">🫓</span> parotta
          </>
        }
        main={`${t.month} this month`}
        sub={`${t.total} total · last ${when(t.last, now)}`}
      />
    ),
  ],
  [
    'chai',
    (t, now) => (
      <Row key="chai" label={<>{chaiIcon} chai</>} main={`${t.today} today`} sub={`${t.month} this month · last ${when(t.last, now)}`} />
    ),
  ],
  [
    'beach',
    (t) => (
      <Row
        key="beach"
        label={
          <>
            <span aria-hidden="true">🌊</span> beach days
          </>
        }
        main={`${t.month} this month`}
        sub={`${t.year} this year · last ${shortDay.format(new Date(t.last))}${t.place ? `, ${t.place}` : ''}`}
      />
    ),
  ],
]

export function Counts() {
  const now = useNow(60_000)
  const { data, error } = useSWR('/api/log', fetcher<LogSummary>, { refreshInterval: 60_000 })
  const pending = data === undefined && !error
  // A kind never logged is hidden; with nothing logged at all, so is the card.
  const shown = rows.flatMap(([kind, render]) => {
    const totals = data?.[kind]
    return totals ? [render(totals, now)] : []
  })
  if (!pending && shown.length === 0) return null

  return (
    <Card title="counts" id="counts">
      <dl className="counts">{pending ? rows.map(([kind]) => pendingRow(kind)) : shown}</dl>
    </Card>
  )
}
