// The home terminal's session, written at the time of the visit from kish's live data: the `kish`
// command types out each card's numbers (the idea kish picked from the mockup). It reads only what
// the cards already fetched (the SWR cache, one entry per address), so it sends no request of its
// own and adds no load on the API. A command with no data is left out (real data only).
// The result is an asciicast v2 file (docs.asciinema.org/manual/asciicast/v2), played by
// components/Terminal.tsx.
import type { Counters, LogDays, LogSummary, PhotoAlbum, Push, Scroll, Track } from './api'
import { timeAgo } from './time'
import { site } from '../data'

export const COLS = 72
export const ROWS = 12

// Read one address from the SWR cache (SWR docs: "Cache", cache.get(key).data).
export type Read = <T>(key: string) => T | null | undefined

// ANSI colours; Terminal.tsx maps them to Rosé Pine Moon (src/index.css).
const paint = (code: number) => (s: string | number) => `\x1b[${code}m${s}\x1b[0m`
const iris = paint(35)
const gold = paint(33)
const foam = paint(32)
const rose = paint(36)
const dim = paint(90)

const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone || undefined })
const plural = (n: number, word: string) => `${rose(n)} ${word}${n === 1 ? '' : 's'}`

// One command and its reply lines, or null when there is no data for it.
type Command = [command: string, path: string, lines: string[]]

function commands(read: Read, daysKey: string | undefined, now: number): Command[] {
  const out: (Command | null)[] = []
  const track = read<Track>('/api/now-playing')
  out.push(track ? ['kish now', '/api/now-playing', [`${gold('♪')} ${track.title} ${dim(`· ${track.artist}`)}`, dim(now < Date.parse(track.until) ? 'playing now' : `played ${timeAgo(track.at, now)}`)]] : null)

  const scroll = read<Scroll>('/api/scroll')
  if (scroll) {
    // The phone's numbers are for its day; on a new day there are none yet.
    const today = dayOf.format(Date.parse(scroll.at)) === dayOf.format(now)
    const rotting = scroll.scrolling && now - Date.parse(scroll.at) < 3 * 60_000
    const stats = today
      ? [plural(scroll.today, 'reel') + ' today', scroll.minutes != null ? `${rose(scroll.minutes)} min` : '', scroll.perReel != null ? `${rose(scroll.perReel)} s a reel` : ''].filter(Boolean).join(dim(' · '))
      : 'no reels yet today'
    const binge = scroll.binge.reels ? dim(`${rotting ? 'scrolling now' : 'not scrolling now'} · ${rotting ? 'this' : 'last'} binge ${scroll.binge.reels} ${scroll.binge.reels === 1 ? 'reel' : 'reels'}`) : ''
    out.push(['kish reels', '/api/scroll', [stats, binge].filter(Boolean)])
  }

  const kinds = (read<LogSummary>('/api/log')?.kinds ?? []).filter((k) => k.total > 0)
  for (const k of kinds) {
    const last = k.last ? ` · last one ${timeAgo(k.last, now)}` : ''
    const unit = k.onceADay ? ` ${k.label} ${k.year === 1 ? 'day' : 'days'}` : ` ${k.label}`
    out.push([`kish ${k.kind}`, '/api/log', [`${rose(k.year)}${unit} this year ${dim(`· ${k.today} today${last}`)}`]])
  }
  // The clock of the most logged kind: one bar per hour of the day (IST), as in the chai clock card.
  const clocked = [...kinds].sort((a, b) => b.total - a.total)[0]
  const most = clocked ? Math.max(...clocked.hours) : 0
  if (clocked && most > 0) {
    const bars = clocked.hours.map((n) => (n ? '▁▂▃▄▅▆▇█'[Math.round((n / most) * 7)] : '·')).join('')
    const peaks = clocked.hours.flatMap((n, h) => (n === most ? [`${String(h).padStart(2, '0')}:00`] : [])).slice(0, 3)
    out.push([`kish ${clocked.kind} --clock`, '/api/log', [`${dim('00')} ${gold(bars)} ${dim('23')}`, `${dim(`most ${clocked.label} at`)} ${peaks.join(dim(' and '))}`]])
  }

  const days = daysKey ? read<LogDays>(daysKey) : null
  if (days?.days.length) out.push(['kish days', '/api/log/days', grid(days, now)])

  const push = read<Push>('/api/github')
  out.push(push ? ['kish push', '/api/github', [`${foam('↑')} pushed to ${foam(push.repo)} ${dim(`· ${timeAgo(push.at, now)}`)}`]] : null)

  const photos = read<PhotoAlbum>('/api/photos')?.photos ?? []
  out.push(photos.length ? ['kish photos', '/api/photos', [`${gold('▣')} ${plural(photos.length, 'photo')} in the album ${dim(`· newest added ${timeAgo(photos[0].added, now)}`)}`]] : null)

  const counters = read<Counters>('/api/counters')
  out.push(counters ? ['kish cat', '/api/counters', [gold(' /\\_/\\'), `${gold('( o.o )')}  ${plural(counters.pats, 'pat')}`, `${gold(' > ^ <')}   ${plural(counters.views, 'visit')}`]] : null)
  return out.filter((c) => c !== null)
}

// The last 12 weeks and this one, a row per weekday (Monday first): a logged day is a block, taller
// for more entries.
function grid(data: LogDays, now: number) {
  const perDay = new Map<string, number>()
  for (const [day, , count] of data.days) perDay.set(day, (perDay.get(day) ?? 0) + count)
  const today = new Date(`${dayOf.format(now)}T12:00:00Z`)
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - 7 * 12)
  let logged = 0
  const rows = [...'MTWTFSS'].map((name, weekday) => {
    let row = `${dim(name)} `
    for (let week = 0; week <= 12; week++) {
      const day = new Date(monday)
      day.setUTCDate(monday.getUTCDate() + week * 7 + weekday)
      if (day > today) break
      const n = perDay.get(day.toISOString().slice(0, 10)) ?? 0
      if (n) logged++
      row += n ? `${gold(n >= 3 ? '█' : n === 2 ? '▆' : '▄')} ` : `${dim('·')} `
    }
    return row
  })
  return [...rows, `${plural(logged, 'day')} logged ${dim('in the last 12 weeks')}`]
}

// The session as asciicast v2: each command typed out, a short spinner for its request, the reply,
// a pause to read it. With no data at all (the API is down), it says so.
export function liveCast(read: Read, keys: Iterable<string>, now = Date.now()): string {
  const daysKey = [...keys].find((k) => k.startsWith('/api/log/days?'))
  const found = commands(read, daysKey, now)
  const list: Command[] = found.length ? found : [['kish', '/api', [dim('no answer from the API right now. back soon')]]]
  const events: [number, 'o', string][] = []
  let t = 0.5
  const say = (s: string, after: number) => {
    events.push([Number(t.toFixed(3)), 'o', s])
    t += after
  }
  const prompt = `${iris('kish@home')} ${dim('~ $')} `
  let i = 0
  for (const [command, path, lines] of list) {
    say(prompt, 0.6)
    // Typing speed varies a little, like a person's (fixed steps, so every visit plays the same).
    for (const ch of command) say(ch, 0.05 + ((i++ * 7) % 5) * 0.015)
    say('\r\n', 0.25)
    for (const frame of '⠋⠙⠹⠸⠼⠴') say(`\r${iris(frame)} ${dim(`GET ${path}`)}`, 0.07)
    say(`\r\x1b[2K${lines.join('\r\n')}\r\n`, 2.2 + lines.length * 0.3)
  }
  say(prompt, 3)
  say('', 0)
  const header = { version: 2, width: COLS, height: ROWS, title: 'kish, live' }
  return [JSON.stringify(header), ...events.map((e) => JSON.stringify(e))].join('\n') + '\n'
}
