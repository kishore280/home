import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { site } from '../data'
import { chaiIcon } from './ChaiIcon'

// The mascot follows kish's day in IST: badminton 6–9 am, chai in the morning and
// evening, coding in the day, the beach at sunset, parotta for dinner, sleep at night.
type Mode = 'chai' | 'badminton' | 'coding' | 'beach' | 'parotta' | 'sleep'

function modeNow(): Mode {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: site.timeZone }).format(new Date()),
  )
  if (hour >= 6 && hour < 9) return 'badminton'
  if (hour >= 10 && hour < 16) return 'coding'
  if (hour >= 5 && hour < 17) return 'chai' // 5–6 am, 9–10 am, 4–5 pm
  if (hour >= 17 && hour < 19) return 'beach'
  if (hour >= 19 && hour < 23) return 'parotta'
  return 'sleep'
}

const MODES: Record<Mode, { label: ReactNode; lines: string[] }> = {
  chai: { label: <>chai time {chaiIcon}</>, lines: ['chai first!', 'one strong chai', 'parippu vada pls', 'pazham pori + chai', 'chai kada gossip', 'no chai, no code', 'chai > coffee', 'dip the biscuit', 'less sugar… jk', 'anna, oru tea!', 'one by two podu', 'strong-a oru tea', 'sakkarai kammi', 'tea kudichiya?', 'vadai irukka?', 'semma tea da', 'bun butter jam pls', 'tea kadai meeting', 'tea soodaa irukku', 'tea + biscuit podu', 'tea time-u da'] },
  badminton: { label: <>badminton time <span aria-hidden="true">🏸</span></>, lines: ['smash!', 'shuttle in the fan', 'it was IN!!', 'net ball, sorry', 'court booked 6am', 'my court, my rules', 'one more game'] },
  coding: { label: <>coding time <span aria-hidden="true">💻</span></>, lines: ['git push!', 'it compiled?!', 'npm install…', 'prod is fine 🔥', 'who wrote this? me', 'semicolon hunt', 'one more bug…'] },
  beach: { label: <>beach time <span aria-hidden="true">🌅</span></>, lines: ['sea breeze~', 'sand in my code', 'sundal pls', 'wave > my inbox', 'ran 5k… maybe 2', 'salt air, 0 bugs', 'sunset soon'] },
  parotta: { label: <>parotta time <span aria-hidden="true">🫓</span></>, lines: ['porotta + beef = ♥', 'my BF? beef fry', 'beef fry, extra', 'tear it, don’t cut', 'kothu tap tap tap', '2 parotta? no, 5', 'extra gravy pls', 'diet starts tmrw', 'free salna?', '5 layers of joy', 'parotta soori mode', 'salna oothunga!', 'kothu podu anna', 'innum 2 parotta', 'saaptiya?', 'semma parotta da', 'vayiru full-u'] },
  sleep: { label: <>sleeping <span aria-hidden="true">💤</span></>, lines: ['zzz… oh, hi', 'brb, dreaming', '404: cat asleep', '5 more min…', 'zzz… parotta?', 'shh, compiling'] },
}
// Tea and parotta lines mix in Tanglish, the way people talk at the kadai.
const ALWAYS = ['pat pat pat', 'that tickles', 'more pats, more ♥', '10/10 pat', 'hey, i’m working!', 'again? ok fine ♥', 'you found me!', 'psst… try ⌘K', '*purr*']

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
  coding: (
    <g>
      <g className="m-code">
        <text x="96" y="46">&lt;/&gt;</text>
        <text x="6" y="52" fontSize="9">{'{ }'}</text>
      </g>
      {/* laptop seen from behind: the lid covers the belly, paws rest on the keyboard */}
      <rect className="m-lid" x="33" y="72" width="54" height="32" rx="3" />
      <path className="m-sticker" d="M60 91q-5-3.5-5-6.5a2.6 2.6 0 0 1 5-1 2.6 2.6 0 0 1 5 1q0 3-5 6.5Z" />
      <path className="m-line" d="M28 104h64" />
      <ellipse className="m-body" cx="44" cy="72" rx="7" ry="5" />
      <ellipse className="m-body" cx="76" cy="72" rx="7" ry="5" />
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

export type MascotHandle = { pat: () => void }

export function Mascot({
  pats,
  onPat,
  ref,
}: {
  pats: number | null
  onPat: () => void
  ref?: Ref<MascotHandle>
}) {
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
  // Lets the ⌘K menu pat the mascot without reaching into the DOM.
  useImperativeHandle(ref, () => ({ pat }))

  return (
    <div className="mascot">
      <button type="button" className="mascot-button" onClick={pat} aria-label="Pat the mascot">
        <span className={`bubble${talking ? ' show' : ''}`} aria-live="polite" translate="no">
          {line}
        </span>
        {/* Animate wrappers, not the SVG, so the browser can use the GPU. */}
        <span className="mascot-breathe">
          <span key={hop} className={`mascot-art${hop ? ' hop' : ''}${talking ? ' happy' : ''}`}>
            <Face mode={mode} />
          </span>
        </span>
      </button>
      <p className="small">
        {MODES[mode].label}
        {pats !== null ? ` · ${pats.toLocaleString()} ${pats === 1 ? 'pat' : 'pats'}` : null}
      </p>
    </div>
  )
}
