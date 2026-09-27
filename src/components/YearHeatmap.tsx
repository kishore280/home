import { useEffect, useRef, useState } from 'react'
import { ActivityCalendar, type Activity } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import useSWR from 'swr'
import { fetcher, type LogDays, type LogSummary } from '../lib/api'
import { useIsClient } from '../lib/client'
import { Card } from './Card'
import { KindIcon } from './KindIcon'

// A year of one kind, as GitHub's contribution graph: react-activity-calendar (grubersjoe), with the
// day totals of the last 365 days in IST (/api/log/days, one primary-key range read).
// It draws only in the browser: its loading state reads the visitor's motion setting, so the
// pre-render and the first render would not match. .heat-box keeps its place meanwhile (no shift).
// Two colours: the library mixes the levels between them (CSS colours, so the site's tokens work
// in light and dark).
const THEME = ['var(--chip)', 'var(--accent-deep)']
const shortDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })

// The first and last activity set the range, so both ends are there even with no count.
function activities(data: LogDays): Activity[] {
  const max = Math.max(1, ...data.days.map(([, n]) => n))
  const counts = new Map(data.days)
  const ends = [data.from, data.to].filter((day) => !counts.has(day)).map((day): [string, number] => [day, 0])
  return [...ends, ...data.days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count, level: count === 0 ? 0 : Math.ceil((count / max) * 4) }))
}

export function YearHeatmap() {
  const { data: summary, error } = useSWR('/api/log', fetcher<LogSummary>, { refreshInterval: 60_000 })
  const kinds = summary?.kinds.filter((k) => k.last !== null) ?? []
  const [choice, setChoice] = useState('chai')
  const kind = kinds.find((k) => k.kind === choice) ?? kinds[0]
  // No timer: day totals change slowly; SWR reloads when the visitor comes back to the tab.
  const { data: days } = useSWR(kind ? `/api/log/days?kind=${encodeURIComponent(kind.kind)}` : null, fetcher<LogDays>)
  const calendar = useRef<HTMLElement>(null)
  const client = useIsClient()

  // On a narrow screen the year scrolls sideways: start at today, on the right.
  useEffect(() => {
    const box = calendar.current?.querySelector('.react-activity-calendar__scroll-container')
    if (box) box.scrollLeft = box.scrollWidth
  }, [days])

  // Nothing logged yet (or the log cannot be read): no card.
  if (error || (summary !== undefined && kinds.length === 0)) return null

  const label = kind?.label ?? 'chai'
  return (
    <Card title={`a year of ${label}`} id="year">
      <div className="heat-kinds" role="group" aria-label="Show">
        {kinds.map((k) => (
          <button key={k.kind} type="button" aria-pressed={k.kind === kind?.kind} onClick={() => setChoice(k.kind)}>
            <KindIcon kind={k.kind} emoji={k.emoji} /> {k.kind}
          </button>
        ))}
      </div>
      <div className="heat-box">
        {client ? (
          <ActivityCalendar
            ref={calendar}
            className="heat"
            data={days ? activities(days) : []}
            loading={!days}
            theme={{ light: THEME, dark: THEME }}
            blockSize={9}
            blockMargin={2}
            blockRadius={2}
            fontSize={12}
            labels={{
              totalCount: `{{count}} ${label} in the last year`,
              legend: { less: 'less', more: 'more' },
            }}
            tooltips={{
              activity: {
                text: (a) => `${shortDay.format(Date.parse(a.date))}: ${a.count} ${label}`,
              },
            }}
          />
        ) : null}
      </div>
    </Card>
  )
}
