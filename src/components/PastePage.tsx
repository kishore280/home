import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { pastePage } from '../data'
import { BackHome } from './BackHome'
import { Card } from './Card'

// /p in a browser: a text box styled like the home terminal (the "B" look kish picked). It sends the
// same POST as `curl --data-binary @- kichoow.com/p` (worker/paste.ts) and shows the link it answers.
// The Worker checks everything (text only, 100 KB, the rate limit); this page only shows its answer.
type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; link: string } | { kind: 'error'; message: string }

export function PastePage() {
  const [text, setText] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [copied, setCopied] = useState(false)
  const boxId = useId()

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    if (state.kind === 'sending') return
    if (!text.trim()) return setState({ kind: 'error', message: 'empty paste.' })
    setState({ kind: 'sending' })
    setCopied(false)
    try {
      const res = await fetch('/p', { method: 'POST', body: text, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      const answer = (await res.text()).trim()
      setState(res.status === 201 ? { kind: 'done', link: answer } : { kind: 'error', message: answer.toLowerCase() })
    } catch {
      setState({ kind: 'error', message: 'no network. try again.' })
    }
  }
  // ⌘/Ctrl + Enter sends, as in many chat and code tools.
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send()
  }
  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // No clipboard: the link is plain text the reader can select.
    }
  }

  return (
    <main className="narrow-page paste-page" id="main">
      <Card>
        <h1>{pastePage.heading}</h1>
        <form className="paste-term" onSubmit={send}>
          <p className="paste-cmd" aria-hidden="true">
            <span className="p">kish@home</span> <span className="d">~ $</span> cat | curl --data-binary @- kichoow.com/p
          </p>
          <label htmlFor={boxId} className="sr-only">
            Text or code to paste
          </label>
          <textarea id={boxId} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder="paste some text or code…" spellCheck={false} />
          <div className="paste-row">
            <span className="d">
              <span className="paste-keys">ctrl ⏎ to send · </span>plain text · gone in 1 day
            </span>
            <button type="submit" disabled={state.kind === 'sending'} data-umami-event="Paste">
              {state.kind === 'sending' ? 'sending…' : 'paste ⏎'}
            </button>
          </div>
          <div className="paste-out" role="status">
            {state.kind === 'done' ? (
              <>
                <a href={state.link}>{state.link}</a>
                <button type="button" className="paste-copy" onClick={() => copy(state.link)} data-umami-event="Paste copy link">
                  {copied ? 'copied' : 'copy'}
                </button>
              </>
            ) : state.kind === 'error' ? (
              <span className="paste-error">{state.message}</span>
            ) : null}
          </div>
        </form>
        <p className="small">
          Or from a terminal: <code>curl --data-binary @file.txt https://kichoow.com/p</code>
        </p>
      </Card>
      <BackHome />
    </main>
  )
}
