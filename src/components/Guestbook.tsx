import { useTransition, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { fetcher, post, type Note } from '../lib/api'
import { shortDate } from '../lib/time'
import { Card } from './Card'

const KEY = '/api/guestbook'

export function Guestbook({ onSigned }: { onSigned: () => void }) {
  const { data: notes, mutate } = useSWR(KEY, fetcher<Note[]>)
  const [sending, startTransition] = useTransition()

  // No list means the guestbook database is not set up yet, so the card stays hidden.
  if (!notes) return null

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fields = Object.fromEntries(new FormData(form))
    startTransition(async () => {
      try {
        const note = await post<Note>(KEY, fields)
        await mutate([note, ...notes], { revalidate: false })
        form.reset()
        onSigned()
        toast('Signed. Thank you for the note ♡')
      } catch (err) {
        toast.error((err as Error).message)
      }
    })
  }

  return (
    <Card title="guestbook" id="guestbook">
      <form className="gb-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="gb-name">
          Name
        </label>
        <input id="gb-name" name="name" maxLength={24} placeholder="name…" autoComplete="nickname" spellCheck={false} />
        <label className="sr-only" htmlFor="gb-text">
          Note
        </label>
        <input id="gb-text" name="text" maxLength={140} placeholder="leave a little note…" required autoComplete="off" />
        {/* Hidden from people; bots fill it in, and the server then ignores the note. */}
        <input className="sr-only" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button type="submit" className="button" disabled={sending}>
          {sending ? 'signing…' : 'sign ✿'}
        </button>
      </form>
      {notes.length > 0 ? (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.id}>
              <time dateTime={n.at}>{shortDate(n.at)}</time>
              <b>{n.name}</b> {n.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small">No notes yet. Be the first to sign.</p>
      )}
    </Card>
  )
}
