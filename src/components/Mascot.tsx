import { useRef, useState } from 'react'

const LINES = ['hi!', 'hehe', 'more pats pls', 'that tickles', '♡', 'yay!']

// Static SVG, hoisted so it is not re-created on each render.
const face = (
  <svg viewBox="0 0 120 120" aria-hidden="true">
    <path className="m-body" d="M30 42 38 12l16 24Zm60 0-8-30-16 24Z" />
    <ellipse className="m-body" cx="60" cy="70" rx="42" ry="38" />
    <ellipse className="m-belly" cx="60" cy="84" rx="24" ry="18" />
    <ellipse className="m-eye" cx="45" cy="64" rx="4.5" ry="6" />
    <ellipse className="m-eye" cx="75" cy="64" rx="4.5" ry="6" />
    <ellipse className="m-blush" cx="36" cy="76" rx="6" ry="3.5" />
    <ellipse className="m-blush" cx="84" cy="76" rx="6" ry="3.5" />
    <path className="m-mouth" d="M55 74q5 5 10 0" />
  </svg>
)

export function Mascot({ pats, onPat }: { pats: number | null; onPat: () => void }) {
  const [line, setLine] = useState<string | null>(null)
  const [hop, setHop] = useState(0)
  const timer = useRef<number>(undefined)

  const pat = () => {
    setHop((h) => h + 1)
    setLine(LINES[Math.floor(Math.random() * LINES.length)])
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setLine(null), 1200)
    onPat()
  }

  return (
    <div className="mascot">
      <button type="button" className="mascot-button" onClick={pat} aria-label="Pat the mascot">
        <span className={`bubble${line ? ' show' : ''}`} aria-live="polite">
          {line}
        </span>
        {/* Animate the wrapper, not the SVG, so the browser can use the GPU. */}
        <div key={hop} className={`mascot-art${hop ? ' hop' : ''}${line ? ' happy' : ''}`}>
          {face}
        </div>
      </button>
      {pats !== null ? (
        <p className="small">
          {pats.toLocaleString()} {pats === 1 ? 'pat' : 'pats'}
        </p>
      ) : null}
    </div>
  )
}
