import type { FormEvent, ReactNode } from 'react'
import { save } from '../lib/storage'
import { TOKEN_KEY } from '../lib/token'

// The sign-in form of kish's private pages (/log, /experiments/split): the token is kept in this
// browser once and works on both. A real sign-in form, so the phone's password manager offers to
// save it. `children` is an optional line of text above the field.
export function TokenForm({ onSaved, children }: { onSaved: (token: string) => void; children?: ReactNode }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('token')?.toString().trim()
    if (!value) return
    save(TOKEN_KEY, value)
    onSaved(value)
  }
  return (
    <form className="log-token" onSubmit={submit}>
      {children}
      <input type="text" name="username" autoComplete="username" value="kishore" readOnly hidden />
      <label>
        token
        {/* spellcheck off: the keyboard never learns or suggests the token. */}
        <input name="token" type="password" autoComplete="current-password" spellCheck={false} required minLength={20} />
      </label>
      <button type="submit">save</button>
    </form>
  )
}
