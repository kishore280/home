import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { guestbookSeed } from '../data'

// Notes stay in this browser for now. The next step moves them to Cloudflare D1.
const KEY = 'guestbook'

function loadNotes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function Guestbook() {
  const [mine, setMine] = useState(loadNotes)
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    const next = [...mine, value].slice(-5)
    setMine(next)
    setText('')
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Storage can be blocked; the note still shows for this visit.
    }
    toast('Signed. Thanks for the note.')
  }

  const notes = [...mine.map((t) => ({ name: 'you', text: t })).reverse(), ...guestbookSeed]

  return (
    <div className="guestbook">
      <form onSubmit={submit}>
        <label htmlFor="guestbook-input" className="sr-only">
          Your note
        </label>
        <input
          id="guestbook-input"
          maxLength={80}
          placeholder="Leave a note…"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="button">
          Sign
        </button>
      </form>
      <ul className="notes">
        <AnimatePresence initial={false}>
          {notes.map((n, i) => (
            <motion.li
              key={`${n.name}-${n.text}-${notes.length - i}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <b>{n.name}</b>
              <span className="muted">{n.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
