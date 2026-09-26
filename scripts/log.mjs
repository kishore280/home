// Add an entry to src/log.json with the current time in IST.
//   npm run log parotta 2        → 2 parottas now
//   npm run log chai             → 1 chai now
//   npm run log beach "Marina"   → a beach day today, with an optional place
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../src/log.json', import.meta.url)
const [kind, arg] = process.argv.slice(2)

// Local IST time as an ISO string with the +05:30 offset, e.g. 2026-09-26T20:15:00+05:30
const ist = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 19) + '+05:30'

const log = JSON.parse(readFileSync(FILE, 'utf8'))
if (kind === 'parotta' || kind === 'chai') {
  const count = Number(arg ?? 1)
  if (!Number.isInteger(count) || count < 1) throw new Error(`Count must be a whole number, got "${arg}".`)
  log[kind].push(count === 1 ? { at: ist } : { at: ist, count })
} else if (kind === 'beach') {
  log.beach.push(arg ? { date: ist.slice(0, 10), place: arg } : { date: ist.slice(0, 10) })
} else {
  throw new Error('Use: npm run log parotta [count] | chai [count] | beach [place]')
}

writeFileSync(FILE, JSON.stringify(log, null, 2) + '\n')
console.log(`Added ${kind} at ${ist}.`)
