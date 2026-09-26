import type { ReactNode } from 'react'
import log from '../log.json'
import { site } from '../data'
import { Card } from './Card'
import { chaiIcon } from './ChaiIcon'
import { useIsClient } from '../lib/client'

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
    <div className="count">
      <dt>{label}</dt>
      <dd className="count-main">{main}</dd>
      <dd className="count-sub">{sub}</dd>
    </div>
  )
}

// log.json is static, so everything is counted once when the module loads
// (Vercel rules rerender-memo, js-cache-function-results, js-combine-iterations).
const parotta = tally(log.parotta as Timed[])
const chai = tally(log.chai as Timed[])
const beachDays = log.beach as Day[]
const lastBeach = beachDays.at(-1)
let beachThisMonth = 0
let beachThisYear = 0
for (const b of beachDays) {
  if (b.date.startsWith(year)) beachThisYear++
  if (b.date.startsWith(month)) beachThisMonth++
}
const hasCounts = Boolean(parotta.last || chai.last || lastBeach)

export function Counts() {
  // "today" and "this month" depend on the visitor's clock: render on the client only.
  const isClient = useIsClient()
  if (!hasCounts || !isClient) return null

  return (
    <Card title="counts" id="counts">
      <dl className="counts">
        {parotta.last ? (
          <Row
            label={
              <>
                <span aria-hidden="true">🫓</span> parotta
              </>
            }
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
            label={
              <>
                <span aria-hidden="true">🌊</span> beach days
              </>
            }
            main={`${beachThisMonth} this month`}
            sub={`${beachThisYear} this year · last ${shortDay.format(new Date(lastBeach.date))}${lastBeach.place ? `, ${lastBeach.place}` : ''}`}
          />
        ) : null}
      </dl>
    </Card>
  )
}
