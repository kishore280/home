import { scaleRadial } from 'd3-scale'
import { arc } from 'd3-shape'
import { chaiIcon } from './ChaiIcon'

// The chai clock: one wedge per hour of the day (IST), longer and darker for more chai, for all
// time (log_hours, migrations/0005_log_hours.sql). Midnight at the top, like a clock.
// Wedges: d3-shape's arc() (angles in radians, clockwise from 12 o'clock).
const HOUR = (2 * Math.PI) / 24
const INNER = 30
const OUTER = 74
const wedge = arc<{ hour: number; outer: number }>()
  .innerRadius(INNER)
  .outerRadius((d) => d.outer)
  .startAngle((d) => d.hour * HOUR)
  .endAngle((d) => (d.hour + 1) * HOUR)
  .padAngle(0.04)
  .cornerRadius(2)

// "5 pm": the hour on a 12-hour clock, as the site writes times.
const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`
const TICKS: [number, string][] = [
  [0, '12a'],
  [6, '6a'],
  [12, '12p'],
  [18, '6p'],
]
const level = (n: number, max: number) => (n === 0 ? 0 : Math.ceil((n / max) * 4))

export function ChaiClock({ hours }: { hours: number[] }) {
  const max = Math.max(...hours)
  const peak = hours.indexOf(max)
  // d3's scaleRadial: the wedge's area, not its length, grows with the count (D3 docs, radial bars).
  const radius = scaleRadial().domain([0, max]).range([INNER + 8, OUTER])
  const second = hours.reduce((best, n, h) => (h !== peak && n > 0 && (best < 0 || n > hours[best]) ? h : best), -1)

  return (
    <figure className="chai-clock">
      <div className="chai-clock-dial">
        <svg viewBox="-80 -80 160 160" role="img" aria-label={`Chai by hour of the day: most at ${hourLabel(peak)}`}>
          {hours.map((n, hour) => (
            <path
              key={hour}
              className={`wedge lvl-${level(n, max)}`}
              d={wedge({ hour, outer: n ? radius(n) : INNER + 3 }) ?? undefined}
            >
              <title>{`${hourLabel(hour)}: ${n} chai`}</title>
            </path>
          ))}
          {TICKS.map(([hour, label]) => (
            <text key={hour} className="tick" x={Math.sin(hour * HOUR) * 21} y={-Math.cos(hour * HOUR) * 21 + 3} textAnchor="middle">
              {label}
            </text>
          ))}
        </svg>
        <span className="chai-clock-glass">{chaiIcon}</span>
      </div>
      <figcaption>
        most chai at <strong>{hourLabel(peak)}</strong>
        {second >= 0 ? `, then ${hourLabel(second)}` : ''}
      </figcaption>
    </figure>
  )
}
