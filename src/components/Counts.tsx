import type { ReactNode } from 'react'
import log from '../log.json'
import { site } from '../data'
import { Card } from './Card'
import { chaiIcon } from './ChaiIcon'

// Everything is counted in IST, so "today" and "this month" match kish's day.
type Timed = { at: string; count?: number }
type Day = { date: string; place?: string }

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone }) // YYYY-MM-DD
const clock = new Intl.DateTimeFormat('en-IN', { timeZone: site.timeZone, hour: 'numeric', minute: '2-digit' })
const shortDay = new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone, day: 'numeric', month: 'short' })

const today = dayKey.format(new Date())
const yesterday = dayKey.format(new Date(Date.now() - 86_400_000))
const month = today.slice(0, 7)
const year = today.slice(0, 4)

function when(iso: string) {
  const d = new Date(iso)
  const key = dayKey.format(d)
  const day = key === today ? 'today' : key === yesterday ? 'yesterday' : shortDay.format(d)
  return `${day}, ${clock.format(d)}`
}

function tally(entries: Timed[]) {
  let total = 0
  let thisMonth = 0
  let todayCount = 0
  for (const e of entries) {
    const n = e.count ?? 1
    const key = dayKey.format(new Date(e.at))
    total += n
    if (key.startsWith(month)) thisMonth += n
    if (key === today) todayCount += n
  }
  return { total, thisMonth, today: todayCount, last: entries.at(-1) }
}

function Row({ label, main, sub }: { label: ReactNode; main: string; sub: string }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>
        <span className="count-main">{main}</span>
        <span className="muted"> · {sub}</span>
      </dd>
    </div>
  )
}

export function Counts() {
  const parotta = tally(log.parotta as Timed[])
  const chai = tally(log.chai as Timed[])
  const beach = log.beach as Day[]
  const lastBeach = beach.at(-1)

  if (!parotta.last && !chai.last && !lastBeach) return null

  return (
    <Card title="counts" id="counts">
      <dl className="rows">
        {parotta.last ? (
          <Row
            label="🫓 parotta"
            main={`${parotta.thisMonth} this month`}
            sub={`${parotta.total} total · last ${when(parotta.last.at)}`}
          />
        ) : null}
        {chai.last ? (
          <Row
            label={<>{chaiIcon} chai</>}
            main={`${chai.today} today`}
            sub={`${chai.thisMonth} this month · last ${when(chai.last.at)}`}
          />
        ) : null}
        {lastBeach ? (
          <Row
            label="🌊 beach days"
            main={`${beach.filter((b) => b.date.startsWith(month)).length} this month`}
            sub={`${beach.filter((b) => b.date.startsWith(year)).length} this year · last ${shortDay.format(new Date(lastBeach.date))}${lastBeach.place ? `, ${lastBeach.place}` : ''}`}
          />
        ) : null}
      </dl>
    </Card>
  )
}
