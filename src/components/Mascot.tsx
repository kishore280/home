import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref, type RefObject } from 'react'
import { useIsClient } from '../lib/client'
import { site } from '../data'
import { chaiIcon } from './ChaiIcon'
import { track } from '../lib/track'

// The mascot follows kish's day in IST: badminton 6–9 am, chai in the morning and
// evening, coding in the day, the beach at sunset, parotta for dinner, sleep at night.
type Mode = 'chai' | 'badminton' | 'coding' | 'beach' | 'parotta' | 'sleep'

const hourFormat = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: site.timeZone })

function modeNow(): Mode {
  const hour = Number(hourFormat.format(new Date()))
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

// The Konami code's prize: a party hat between the ears.
const PARTY_HAT = (
  <g className="m-hat">
    <path className="m-hat-cone" d="M60 6 47 36h26Z" />
    <path className="m-hat-stripe" d="M54.5 19h11M51 28h18" />
    <circle className="m-hat-pom" cx="60" cy="6" r="4" />
  </g>
)

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

// `mode` is null while pre-rendering: a plain, awake mascot with no accessory.
function Face({ mode, dizzy, party }: { mode: Mode | null; dizzy: boolean; party: boolean }) {
  const asleep = mode === 'sleep' && !dizzy
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
      {/* Each ear is its own group, so it can swing on its base (the springs below). */}
      <g className="m-ear-l">
        <path className="m-body" d="M28 44 36 10l20 24Z" />
        <path className="m-ear" d="M34 38 38 20l10 14Z" />
      </g>
      <g className="m-ear-r">
        <path className="m-body" d="M92 44 84 10 64 34Z" />
        <path className="m-ear" d="M86 38 82 20 72 34Z" />
      </g>
      <ellipse className="m-body m-shaded" cx="60" cy="70" rx="42" ry="37" />
      <ellipse className="m-belly" cx="60" cy="86" rx="24" ry="17" />
      {dizzy ? (
        <g>
          <path className="m-dizzy" d="M40 64a5 5 0 1 0 5-5 3.4 3.4 0 1 0 2.4 5.8" />
          <path className="m-dizzy" d="M70 64a5 5 0 1 0 5-5 3.4 3.4 0 1 0 2.4 5.8" />
        </g>
      ) : asleep ? (
        <path className="m-mouth" d="M40 65q5 4 10 0M70 65q5 4 10 0" />
      ) : (
        <g className="m-look">
          <g className="m-eyes">
            <ellipse className="m-eye" cx="45" cy="64" rx="4.8" ry="6.2" />
            <ellipse className="m-eye" cx="75" cy="64" rx="4.8" ry="6.2" />
            <circle className="m-glint" cx="46.6" cy="61.6" r="1.6" />
            <circle className="m-glint" cx="76.6" cy="61.6" r="1.6" />
          </g>
        </g>
      )}
      <ellipse className="m-blush" cx="35" cy="76" rx="6" ry="3.5" />
      <ellipse className="m-blush" cx="85" cy="76" rx="6" ry="3.5" />
      <path className="m-mouth" d={asleep ? 'M57 75q3 2 6 0' : 'M54 73q3 4 6 0q3 4 6 0'} />
      {mode ? ACCESSORY[mode] : null}
      {party ? PARTY_HAT : null}
    </svg>
  )
}

export type MascotHandle = { pat: () => void }

// Game feel ("juice"): each pat floats a heart up, and a phone buzzes for 10 ms (Android; other
// browsers ignore navigator.vibrate). The hearts are a pool of the last HEARTS, so fast taps never
// pile up elements. A round total of pats (100, 500, then every 1,000) is an achievement: the
// mascot tells the one who gave it, with more hearts and a short freeze before the hop ("hit-stop").
const HEARTS = 6
const BURST = 8
const milestone = (n: number) => n > 0 && n % 100 === 0
// The pats one visitor gives on this page that get a thank-you.
const MINE = [10, 25, 50, 100]
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const HOLD_MS = 550
const SEEN = 'mascot-seen'
// Very fast pats make the cat dizzy (spiral eyes): DIZZY pats within DIZZY_MS.
const DIZZY = 6
const DIZZY_MS = 2500
const IDLE = ['twitch', 'flick', 'look'] as const

// "Look-at", as game characters do: the eyes turn toward the pointer or the last tap, at most once a
// frame (requestAnimationFrame), through two CSS variables, so React does not re-render. Off with
// reduced motion.
function useLookAt(el: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const node = el.current
    if (!node || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let x = 0
    let y = 0
    const aim = () => {
      frame = 0
      const r = node.getBoundingClientRect()
      const dx = x - (r.left + r.width / 2)
      const dy = y - (r.top + r.height * 0.55)
      const d = Math.hypot(dx, dy) || 1
      const k = Math.min(1, d / 240) // near the face, the eyes move less
      node.style.setProperty('--lx', `${((dx / d) * k * 3).toFixed(2)}px`)
      node.style.setProperty('--ly', `${((dy / d) * k * 2.4).toFixed(2)}px`)
    }
    const move = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      frame ||= requestAnimationFrame(aim)
    }
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointerdown', move, { passive: true })
    return () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerdown', move)
      cancelAnimationFrame(frame)
    }
  }, [el])
}

// Idle actions, now and then (an ear twitch, a tail flick, a look around), set as a data attribute
// for CSS. None while the tab is hidden, as a game pauses when it loses focus.
function useIdle(el: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const node = el.current
    if (!node) return
    let timer = 0
    const next = () => {
      timer = window.setTimeout(() => {
        if (!document.hidden) node.dataset.idle = IDLE[Math.floor(Math.random() * IDLE.length)]
        timer = window.setTimeout(() => {
          delete node.dataset.idle
          next()
        }, 1600)
      }, 6000 + Math.random() * 6000)
    }
    next()
    return () => window.clearTimeout(timer)
  }, [el])
}

export function Mascot({
  pats,
  onPat,
  ref,
}: {
  pats: number | null
  onPat: () => void
  ref?: Ref<MascotHandle>
}) {
  // The mode depends on the visitor's clock, so it is chosen on the client only.
  const mode = useIsClient() ? modeNow() : null
  // The text stays while the bubble fades out; only `talking` turns it off.
  const [line, setLine] = useState('')
  const [talking, setTalking] = useState(false)
  const [hop, setHop] = useState(0)
  const [hearts, setHearts] = useState(0)
  const [big, setBig] = useState(false)
  const [dizzy, setDizzy] = useState(false)
  const [purr, setPurr] = useState(false)
  const [party, setParty] = useState(false)
  const timer = useRef<number>(undefined)
  const hold = useRef<number>(undefined)
  const held = useRef(false)
  const downAt = useRef(0)
  const recent = useRef<number[]>([])
  const mine = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  useLookAt(root)
  useIdle(root)

  // The bubble says one line for a while, then fades; later lines replace it.
  const say = (text: string, ms: number) => {
    setLine(text)
    setTalking(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setTalking(false)
      setDizzy(false)
      setPurr(false)
    }, ms)
  }

  // A visitor back after 12 hours or more is welcomed (the time is kept on this device only).
  useEffect(() => {
    let last = 0
    try {
      last = Number(localStorage.getItem(SEEN)) || 0
      localStorage.setItem(SEEN, String(Date.now()))
    } catch {
      return
    }
    if (!last || Date.now() - last < 12 * 3600_000) return
    const t = window.setTimeout(() => say('welcome back! ♥', 2600), 1200)
    return () => window.clearTimeout(t)
  }, [])

  // ↑ ↑ ↓ ↓ ← → ← → B A: a party hat, as in the old games.
  useEffect(() => {
    let at = 0
    const key = (e: KeyboardEvent) => {
      at = e.key === KONAMI[at] ? at + 1 : e.key === KONAMI[0] ? 1 : 0
      if (at < KONAMI.length) return
      at = 0
      setParty(true)
      say('cheat unlocked! 🎉', 2600)
      track('Mascot Konami code')
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])

  // Hold the cat to make it purr (long press); the click after a hold is not a pat. A hold is judged
  // by the real press time (event time stamps), not only by the timer: on a busy phone a quick tap's
  // pointerup can wait in the queue past the timer, and it must still count as a pat.
  const press = (e: ReactPointerEvent<HTMLButtonElement>) => {
    held.current = false
    downAt.current = e.timeStamp
    window.clearTimeout(hold.current)
    hold.current = window.setTimeout(() => {
      held.current = true
      setPurr(true)
      navigator.vibrate?.([20, 40, 20, 40, 20])
      say('purrr… ♥', 1800)
      track('Mascot purr')
    }, HOLD_MS)
  }
  const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
    window.clearTimeout(hold.current)
    if (e.type === 'pointerup' && e.timeStamp - downAt.current < HOLD_MS) held.current = false
  }
  // A tap on the cat: a pat, unless it ended a hold. Counted here, not with data-umami-event, so a
  // hold is not also counted as a pat.
  const tap = () => {
    if (held.current) {
      held.current = false
      return
    }
    track('Mascot pat')
    pat()
  }

  const pat = () => {
    const lines = mode ? [...MODES[mode].lines, ...ALWAYS] : ALWAYS
    const total = pats === null ? 0 : pats + 1
    const achieved = milestone(total)
    const thanks = MINE.includes(++mine.current)
    const now = performance.now()
    recent.current = [...recent.current.filter((t) => now - t < DIZZY_MS), now]
    // More pats while dizzy keep it dizzy.
    const spun = !achieved && !thanks && (dizzy || recent.current.length >= DIZZY)
    navigator.vibrate?.(achieved ? [10, 60, 30] : 10)
    setHop((h) => h + 1)
    setHearts((h) => h + (achieved ? BURST : 1))
    setBig(achieved)
    if (spun) setDizzy(true)
    if (achieved) say(`you are the ${total.toLocaleString()}th! ${total % 1000 ? '🎉' : '🏆'}`, 3200)
    else if (thanks) say(`${mine.current} pats from you ♥`, 2200)
    else if (spun) say('whoa… dizzy', 2200)
    else say(lines[Math.floor(Math.random() * lines.length)], 1400)
    onPat()
  }
  // Lets the ⌘K menu pat the mascot without reaching into the DOM.
  useImperativeHandle(ref, () => ({ pat }))

  return (
    <div className="mascot" ref={root}>
      <button
        type="button"
        className="mascot-button"
        onClick={tap}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Pat the mascot"
      >
        {/* A long line starts further left (a longer --tail), so it stays inside the card and the
            tail still points at the mouth. */}
        <span
          className={`bubble${talking ? ' show' : ''}`}
          style={line.length > 18 ? ({ '--tail': '74px' } as CSSProperties) : undefined}
          aria-live="polite"
          translate="no"
        >
          {line}
        </span>
        {/* Animate wrappers, not the SVG, so the browser can use the GPU. */}
        <span className="mascot-breathe">
          <span key={hop} className={`mascot-art${hop ? ' hop' : ''}${big ? ' big' : ''}${purr ? ' purr' : ''}${talking ? ' happy' : ''}`}>
            <Face mode={mode} dizzy={dizzy} party={party} />
          </span>
        </span>
        {Array.from({ length: Math.min(hearts, big ? BURST : HEARTS) }, (_, i) => hearts - i).map((id) => (
          // A fixed spread from the heart's number, so the render stays pure.
          <span key={id} className="heart" aria-hidden="true" style={{ '--x': `${((id * 37) % 120) - 60}px` } as CSSProperties}>
            ♥
          </span>
        ))}
      </button>
      <p className="small">
        {mode ? MODES[mode].label : null}
        {pats !== null ? (
          <>
            {' · '}
            {/* A new key on each change replays a small pop on the number. */}
            <span key={pats} className="count-pop">
              {pats.toLocaleString()}
            </span>{' '}
            {pats === 1 ? 'pat' : 'pats'}
          </>
        ) : null}
      </p>
    </div>
  )
}
