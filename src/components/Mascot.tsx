import { useRef, useState, type ReactNode } from 'react'
import { site } from '../data'

// The mascot follows kish's day in IST: chai in the morning, badminton by day,
// the beach at sunset, parotta for dinner, and sleep at night.
type Mode = 'chai' | 'badminton' | 'beach' | 'parotta' | 'sleep'

function modeNow(): Mode {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: site.timeZone }).format(new Date()),
  )
  if (hour >= 5 && hour < 11) return 'chai'
  if (hour >= 11 && hour < 16) return 'badminton'
  if (hour >= 16 && hour < 19) return 'beach'
  if (hour >= 19 && hour < 23) return 'parotta'
  return 'sleep'
}

const MODES: Record<Mode, { label: string; lines: string[] }> = {
  chai: { label: 'chai time ☕', lines: ['chai first, then talk', 'one more chai?', 'strong chai pls', 'hi!'] },
  badminton: { label: 'badminton time 🏸', lines: ['smash!', 'rally?', 'one more game', 'hehe'] },
  beach: { label: 'beach time 🌅', lines: ['sea breeze~', 'sunset soon', 'beach time!', 'hi!'] },
  parotta: { label: 'parotta time 🫓', lines: ['parotta time!', 'with salna pls', 'two more parotta', 'yum'] },
  sleep: { label: 'sleeping 💤', lines: ['zzz… oh, hi', '5 more minutes', 'sleepy…', '💤'] },
}
const ALWAYS = ['that tickles', '♥']

// Static SVG parts, hoisted so they are not re-created on each render.
const paw = <ellipse className="m-body" cx="95" cy="86" rx="7.5" ry="6.5" />

const ACCESSORY: Record<Mode, ReactNode> = {
  chai: (
    <g>
      <path className="m-steam" d="M95 62q-3-3 0-6t0-6M101 62q-3-3 0-6t0-6" />
      <path className="m-glass" d="M89 66h14l-1.6 18H90.6Z" />
      <path className="m-tea" d="M89.4 70.5h13.2L101.4 84H90.6Z" />
      <path className="m-foam" d="M89.4 70.5h13.2l-.2 2.2H89.6Z" />
      <path className="m-line" d="M89 66h14l-1.6 18H90.6Z" />
      {paw}
    </g>
  ),
  badminton: (
    <g>
      <path className="m-handle" d="M96 84 104 64" />
      <ellipse className="m-racket" cx="108" cy="52" rx="8" ry="11" transform="rotate(22 108 52)" />
      <path className="m-strings" d="M102 46l12 4M101 51l13 4M101 56l12 4M105 43l-3 17M109 43l-3 18M113 46l-3 15" />
      <ellipse className="m-line" cx="108" cy="52" rx="8" ry="11" transform="rotate(22 108 52)" />
      {paw}
    </g>
  ),
  beach: (
    <g>
      <rect className="m-shades" x="36" y="57" width="18" height="12" rx="4" />
      <rect className="m-shades" x="66" y="57" width="18" height="12" rx="4" />
      <path className="m-line" d="M54 61h12M36 60l-6-3M84 60l6-3" />
      <path className="m-shine" d="M40 60l4-2M70 60l4-2" />
    </g>
  ),
  parotta: (
    <g>
      <path
        className="m-parotta"
        d="M86 80q2-6 12-6.5t15 5.5q1 6-12 7.5T86 80Z"
      />
      <path className="m-spiral" d="M99 80.5q-3 0-2-1.4t4.5-.2q3 1.4-1 2.8t-7.5-.8q-2-2.6 4.5-3.8t10 1" />
      {paw}
    </g>
  ),
  sleep: (
    <g className="m-zzz">
      <text x="88" y="38">z</text>
      <text x="97" y="27" fontSize="14">z</text>
    </g>
  ),
}

function Face({ mode }: { mode: Mode }) {
  const asleep = mode === 'sleep'
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="m-shade" cx="38%" cy="32%" r="75%">
          <stop offset="0" style={{ stopColor: 'var(--accent-light)' }} />
          <stop offset="1" style={{ stopColor: 'var(--accent)' }} />
        </radialGradient>
      </defs>
      <path className="m-tail" d="M90 94q20-1 18-19-1-9-9-7" />
      <ellipse className="m-foot" cx="44" cy="104" rx="9" ry="5" />
      <ellipse className="m-foot" cx="76" cy="104" rx="9" ry="5" />
      <path className="m-body" d="M28 44 36 10l20 24Zm64 0-8-34-20 24Z" />
      <path className="m-ear" d="M34 38 38 20l10 14Zm52 0-4-18-10 14Z" />
      <ellipse className="m-body m-shaded" cx="60" cy="70" rx="42" ry="37" />
      <ellipse className="m-belly" cx="60" cy="86" rx="24" ry="17" />
      {asleep ? (
        <path className="m-mouth" d="M40 65q5 4 10 0M70 65q5 4 10 0" />
      ) : (
        <g className="m-eyes">
          <ellipse className="m-eye" cx="45" cy="64" rx="4.8" ry="6.2" />
          <ellipse className="m-eye" cx="75" cy="64" rx="4.8" ry="6.2" />
          <circle className="m-glint" cx="46.6" cy="61.6" r="1.6" />
          <circle className="m-glint" cx="76.6" cy="61.6" r="1.6" />
        </g>
      )}
      <ellipse className="m-blush" cx="35" cy="76" rx="6" ry="3.5" />
      <ellipse className="m-blush" cx="85" cy="76" rx="6" ry="3.5" />
      <path className="m-mouth" d={asleep ? 'M57 75q3 2 6 0' : 'M54 73q3 4 6 0q3 4 6 0'} />
      {ACCESSORY[mode]}
    </svg>
  )
}

export function Mascot({ pats, onPat }: { pats: number | null; onPat: () => void }) {
  const [mode] = useState(modeNow)
  // The text stays while the bubble fades out; only `talking` turns it off.
  const [line, setLine] = useState('')
  const [talking, setTalking] = useState(false)
  const [hop, setHop] = useState(0)
  const timer = useRef<number>(undefined)

  const pat = () => {
    const lines = [...MODES[mode].lines, ...ALWAYS]
    setHop((h) => h + 1)
    setLine(lines[Math.floor(Math.random() * lines.length)])
    setTalking(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setTalking(false), 1400)
    onPat()
  }

  return (
    <div className="mascot">
      <button type="button" className="mascot-button" onClick={pat} aria-label="Pat the mascot">
        <span className={`bubble${talking ? ' show' : ''}`} aria-live="polite">
          {line}
        </span>
        {/* Animate wrappers, not the SVG, so the browser can use the GPU. */}
        <div className="mascot-breathe">
          <div key={hop} className={`mascot-art${hop ? ' hop' : ''}${talking ? ' happy' : ''}`}>
            <Face mode={mode} />
          </div>
        </div>
      </button>
      <p className="small">
        {MODES[mode].label}
        {pats !== null ? ` · ${pats.toLocaleString()} ${pats === 1 ? 'pat' : 'pats'}` : ''}
      </p>
    </div>
  )
}
