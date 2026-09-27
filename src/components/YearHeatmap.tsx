import { cloneElement, useEffect, useRef, useState, type MouseEvent } from 'react'
import { ActivityCalendar, type Activity } from 'react-activity-calendar'
import useSWR from 'swr'
import { fetcher, type LogDays, type LogKind, type LogSummary } from '../lib/api'
import { useIsClient } from '../lib/client'
import { Card } from './Card'
import { KindIcon } from './KindIcon'

// Every logged day, as the 2026 coding tools show activity (Claude Code /stats, opencode stats):
// the numbers first (streaks, days), then a grid of the last 12 weeks, the year on request.
// "all" is the default: one grid for every kind, as GitHub puts commits, pull requests and issues
// in one graph. A day is darker for more different things done, not a sum (3 chai and 1 beach
// day are not "4"). A tap on a day, or the ‹ › buttons, says what it had.
// The grid is react-activity-calendar (grubersjoe). It draws only in the browser: its loading state
// reads the visitor's motion setting, so the pre-render and the first render would not match.
// .heat-box keeps its place meanwhile (no shift). Each day's text is an SVG <title> added with
// renderBlock, as the library's docs show; its `tooltips` prop puts a Floating UI tooltip on every
// square (measured: about 400 ms more long tasks on a 4x slowed CPU). One click listener on the
// box serves every square.
// Two colours: the library mixes the levels between them (CSS colours, so the site's tokens work
// in light and dark).
const THEME = ['var(--chip)', 'var(--accent-deep)']
const RANGES = [
  [84, '12 weeks'],
  [365, 'year'],
] as const
const DAY_MS = 86_400_000
const shortDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const dayName = (day: string) => shortDay.format(Date.parse(day))
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10)

type Counts = Map<string, Map<string, number>> // day → kind → count

function byDay(data: LogDays): Counts {
  const counts: Counts = new Map()
  for (const [day, kind, count] of data.days) {
    if (!counts.has(day)) counts.set(day, new Map())
    counts.get(day)!.set(kind, count)
  }
  return counts
}

// Every day of the window, oldest first (the library needs the first and last day to set the range).
const everyDay = (data: LogDays) =>
  Array.from({ length: Math.round((Date.parse(data.to) - Date.parse(data.from)) / DAY_MS) + 1 }, (_, i) => addDays(data.from, i))

// Streak now: the days in a row up to today, or up to yesterday while today is still empty
// (a streak is not broken before the day is over). Best: the longest run in the window.
function streaks(values: number[]) {
  let best = 0
  let run = 0
  for (const v of values) {
    run = v > 0 ? run + 1 : 0
    best = Math.max(best, run)
  }
  let now = 0
  for (let i = values.at(-1) ? values.length - 1 : values.length - 2; i >= 0 && values[i] > 0; i--) now++
  return { now, best }
}

// "27 Sep: 🍵 2 chai · 🏸 badminton"
function DayNote({ day, today, counts, kinds }: { day: string; today: string; counts: Counts; kinds: LogKind[] }) {
  const had = kinds.filter((k) => counts.get(day)?.get(k.kind))
  return (
    <>
      <b>
        {dayName(day)}
        {day === today ? ' (today)' : ''}
      </b>
      {': '}
      {had.length === 0
        ? 'nothing logged'
        : had.map((k, i) => (
            <span key={k.kind}>
              {i ? ' · ' : ''}
              <KindIcon kind={k.kind} emoji={k.emoji} /> {k.onceADay ? k.kind : `${counts.get(day)!.get(k.kind)} ${k.kind}`}
            </span>
          ))}
    </>
  )
}

export function YearHeatmap() {
  const { data: summary, error } = useSWR('/api/log', fetcher<LogSummary>, { refreshInterval: 60_000 })
  const kinds = summary?.kinds.filter((k) => k.last !== null) ?? []
  const [choice, setChoice] = useState('all')
  const [range, setRange] = useState<number>(RANGES[0][0])
  const [picked, setPicked] = useState<string | null>(null)
  const kind = kinds.find((k) => k.kind === choice)
  // No timer: day totals change slowly; SWR reloads when the visitor comes back to the tab.
  const { data } = useSWR(kinds.length ? `/api/log/days?range=${range}` : null, fetcher<LogDays>)
  const calendar = useRef<HTMLElement>(null)
  const client = useIsClient()

  // On a narrow screen the year scrolls sideways: start at today, on the right.
  useEffect(() => {
    const box = calendar.current?.querySelector('.react-activity-calendar__scroll-container')
    if (box) box.scrollLeft = box.scrollWidth
  }, [data])

  // Nothing logged yet (or the log cannot be read): no card.
  if (error || (summary !== undefined && kinds.length === 0)) return null

  const counts = data ? byDay(data) : new Map<string, Map<string, number>>()
  const days = data ? everyDay(data) : []
  // "all": how many of the shown kinds that day. Only those, so a level never goes past maxLevel
  // (the library throws) when /api/log and /api/log/days come from different moments.
  const value = (day: string) =>
    kind ? (counts.get(day)?.get(kind.kind) ?? 0) : kinds.filter((k) => counts.get(day)?.get(k.kind)).length
  const values = days.map(value)
  const max = kind ? Math.max(1, ...values) : Math.max(1, kinds.length)
  const levels = kind ? 4 : max
  const activities: Activity[] = days.map((date, i) => ({
    date,
    count: values[i],
    level: kind ? (values[i] ? Math.ceil((values[i] / max) * 4) : 0) : values[i],
  }))
  const { now, best } = streaks(values)
  const active = values.filter(Boolean).length
  // The labels are fixed text, so they are in the pre-rendered HTML and only the numbers arrive
  // later: the tiles keep their size (web.dev "Optimize CLS").
  const tiles: [number, string][] = kind
    ? [
        [now, 'day streak'],
        [best, 'best streak'],
        [active, `${kind.kind} days`],
        [values.reduce((a, b) => a + b, 0), kind.onceADay ? 'days in all' : 'in all'],
      ]
    : [
        [now, 'day streak'],
        [best, 'best streak'],
        [active, 'days with something'],
        [values.filter((v) => v >= 3).length, 'days with 3+ things'],
      ]
  const today = data?.to ?? ''
  const day = picked && days.includes(picked) ? picked : today
  const step = (n: number) => setPicked(addDays(day, n))
  const pick = (e: MouseEvent) => {
    const date = (e.target as Element).closest('rect[data-date]')?.getAttribute('data-date')
    if (date) setPicked(date)
  }
  const title = kind ? kind.label : 'my days'
  const span = range === 84 ? 'last 12 weeks' : 'last 12 months'

  return (
    <Card title={title} id="year">
      <div className="heat-kinds" role="group" aria-label="Show">
        {kinds.length ? (
          <button type="button" aria-pressed={!kind} onClick={() => setChoice('all')}>
            all
          </button>
        ) : null}
        {kinds.map((k) => (
          <button key={k.kind} type="button" aria-pressed={k.kind === kind?.kind} onClick={() => setChoice(k.kind)}>
            <KindIcon kind={k.kind} emoji={k.emoji} /> {k.kind}
          </button>
        ))}
      </div>
      <dl className="heat-tiles">
        {tiles.map(([n, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{data ? n : '\u00a0'}</dd>
          </div>
        ))}
      </dl>
      {/* The squares are for pointers; the ‹ › buttons below do the same from a keyboard. */}
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events jsx-a11y/no-static-element-interactions */}
      <div className={`heat-box range-${range}`} onClick={pick}>
        {client ? (
          <ActivityCalendar
            ref={calendar}
            className="heat"
            data={activities}
            loading={!data}
            maxLevel={levels}
            theme={{ light: THEME, dark: THEME }}
            blockSize={range === 84 ? 14 : 9}
            blockMargin={range === 84 ? 3 : 2}
            blockRadius={range === 84 ? 3 : 2}
            fontSize={12}
            showTotalCount={false}
            labels={{ legend: kind ? { less: 'less', more: 'more' } : { less: '0', more: `${levels} things` } }}
            renderBlock={(block, a) =>
              cloneElement(
                block,
                { className: a.date === day ? 'picked' : undefined },
                <title>{`${dayName(a.date)}: ${kind ? `${a.count} ${kind.kind}` : `${a.count} of ${levels}`}`}</title>,
              )
            }
          />
        ) : null}
      </div>
      <p className="heat-day" aria-live="polite">
        {data ? <DayNote day={day} today={today} counts={counts} kinds={kinds} /> : null}
      </p>
      <div className="heat-foot">
        <button type="button" className="heat-step" aria-label="Day before" disabled={!data || day === days[0]} onClick={() => step(-1)}>
          ‹
        </button>
        <button type="button" className="heat-step" aria-label="Day after" disabled={!data || day === today} onClick={() => step(1)}>
          ›
        </button>
        <span>{span}</span>
        <div className="heat-range" role="group" aria-label="Time range">
          {RANGES.map(([n, label]) => (
            <button key={n} type="button" aria-pressed={range === n} onClick={() => setRange(n)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
