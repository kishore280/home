import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { AID, MAX_ITEMS, money, parseRupees, readAid, total, VPA, clean, type Split } from '../lib/split'
import { useCopy } from '../lib/copy'
import { load, remove, save } from '../lib/storage'
import { shortDate } from '../lib/time'
import { TOKEN_KEY } from '../lib/token'
import { TokenForm } from './TokenForm'

// kish's side of /experiments/split: make a split (the items and a UPI ID), get a link to share,
// and see, copy or delete the splits made before. It needs the same token as /log (worker/split.ts).
const NAME_KEY = 'split-name'
const VPA_KEY = 'split-vpa'
const AID_KEY = 'split-aid'

class Unauthorized extends Error {}

// The list, newest first. A wrong token (401) is told apart from a failed request.
async function listSplits([url, token]: [string, string]) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (res.status === 401) throw new Unauthorized()
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`)
  return (await res.json()) as Split[]
}

let nextRow = 0
const emptyRow = () => ({ key: nextRow++, label: '', amount: '' })

const linkTo = (id: string) => `${location.origin}/experiments/split?s=${id}`

export function SplitOwner() {
  const [token, setToken] = useState(() => load(TOKEN_KEY))
  const [title, setTitle] = useState('')
  const [name, setName] = useState(() => load(NAME_KEY) ?? '')
  const [vpa, setVpa] = useState(() => load(VPA_KEY) ?? '')
  const [aid, setAid] = useState(() => load(AID_KEY) ?? '')
  const [rows, setRows] = useState(() => [emptyRow(), emptyRow()])
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [copied, copy] = useCopy()

  const forget = () => {
    remove(TOKEN_KEY)
    setToken(null)
  }
  const { data: splits, mutate } = useSWR(token ? ['/api/split', token] : null, listSplits, {
    onError: (error) => error instanceof Unauthorized && forget(),
  })

  const setRow = (key: number, change: Partial<{ label: string; amount: string }>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)))

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!token) return
    // The same rules as the Worker (src/lib/split.ts), so most mistakes are told here, at once.
    if (!VPA.test(vpa.trim())) return setProblem('Your UPI ID should look like name@bank.')
    if (aid.trim() && !AID.test(readAid(aid))) return setProblem('The Google Pay id should be letters and digits, like uGICAgIDDiObocw. Or paste the whole QR text.')
    if (!clean(name, 40)) return setProblem('Add your name: people see it before they pay.')
    const items = []
    for (const [i, row] of rows.entries()) {
      if (!row.label.trim() && !row.amount.trim()) continue // an empty row is left out
      const paise = parseRupees(row.amount)
      if (!clean(row.label, 40)) return setProblem(`Item ${i + 1}: add a name, like Bus.`)
      if (paise === null) return setProblem(`Item ${i + 1}: the amount should be like 100 or 99.50 (at most ₹1,00,000).`)
      items.push({ label: clean(row.label, 40), paise })
    }
    if (!items.length) return setProblem('Add at least one item with an amount.')
    setProblem('')
    setBusy(true)
    try {
      const res = await fetch(editing ? `/api/split?s=${editing}` : '/api/split', {
        method: editing ? 'PUT' : 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ title, name, vpa, aid: readAid(aid) || undefined, items }),
      })
      if (res.status === 401) return forget()
      const reply = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!res.ok || !reply.id) return setProblem(reply.error ?? 'Could not make the link. Try again.')
      save(NAME_KEY, clean(name, 40))
      save(VPA_KEY, vpa.trim())
      save(AID_KEY, readAid(aid))
      setMade(linkTo(reply.id))
      reset()
      void mutate()
    } catch {
      setProblem('No signal. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setEditing(null)
    setTitle('')
    setRows([emptyRow(), emptyRow()])
  }

  // Puts a split back in the form; saving replaces it and its link stays the same.
  function edit(s: Split) {
    setEditing(s.id)
    setMade(null)
    setProblem('')
    setTitle(s.title)
    setName(s.name)
    setVpa(s.vpa)
    setAid(s.aid ?? '')
    setRows(s.items.map((i) => ({ key: nextRow++, label: i.label, amount: String(i.paise / 100) })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteSplit(id: string) {
    if (!token) return
    setConfirming(null)
    if (editing === id) reset()
    const res = await fetch(`/api/split?s=${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }).catch(() => null)
    if (res?.status === 401) return forget()
    void mutate()
  }

  const share = (link: string, label: string) => navigator.share({ title: label, text: `Pay your share: ${label}`, url: link }).catch(() => {})

  if (!token) {
    return (
      <TokenForm onSaved={setToken}>
        <p className="small">This is kish’s page for making a split. Anyone with a split’s link can pay it.</p>
      </TokenForm>
    )
  }

  return (
    <>
      <form className="split-form" onSubmit={create} noValidate>
        <label>
          what for (optional)
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} autoComplete="off" placeholder="Goa trip" />
        </label>
        <div className="split-pair">
          <label>
            your UPI ID
            <input value={vpa} onChange={(e) => setVpa(e.target.value)} maxLength={100} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="name@bank" inputMode="email" />
          </label>
          <label>
            your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder="Kish" />
          </label>
        </div>
        <label>
          Google Pay QR id (optional)
          <input value={aid} onChange={(e) => setAid(e.target.value)} maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="aid from your QR, or the whole QR text" />
        </label>
        <fieldset>
          <legend>items</legend>
          {rows.map((row, i) => (
            <div className="split-row" key={row.key}>
              <input aria-label={`Item ${i + 1} name`} value={row.label} onChange={(e) => setRow(row.key, { label: e.target.value })} maxLength={40} autoComplete="off" placeholder={i ? 'Food' : 'Bus'} />
              <input aria-label={`Item ${i + 1} amount in rupees`} value={row.amount} onChange={(e) => setRow(row.key, { amount: e.target.value })} inputMode="decimal" autoComplete="off" placeholder="₹" />
              <button type="button" className="link-button" aria-label={`Remove item ${i + 1}`} onClick={() => setRows((all) => (all.length > 1 ? all.filter((r) => r.key !== row.key) : all))}>
                ✕
              </button>
            </div>
          ))}
          {rows.length < MAX_ITEMS ? (
            <button type="button" className="link-button" onClick={() => setRows((all) => [...all, emptyRow()])}>
              + add an item
            </button>
          ) : null}
        </fieldset>
        <p className="split-problem" role="alert">
          {problem}
        </p>
        <button type="submit" className="split-go" disabled={busy}>
          {busy ? 'saving…' : editing ? 'save changes' : 'make the link'}
        </button>
        {editing ? (
          <button type="button" className="link-button" onClick={reset}>
            cancel the edit
          </button>
        ) : null}
      </form>

      {made ? (
        <div className="split-made" role="status">
          <p>
            <b>Your link</b>
          </p>
          <a href={made}>{made}</a>
          <div className="split-actions">
            <button type="button" onClick={() => void copy(made)}>
              {copied === made ? 'copied' : 'copy'}
            </button>
            {typeof navigator.share === 'function' ? (
              <button type="button" onClick={() => void share(made, 'Split')}>
                share…
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="split-list" aria-label="Your splits">
        <h2>your splits</h2>
        {!splits ? (
          <p className="small">Loading…</p>
        ) : splits.length === 0 ? (
          <p className="small">None yet. Make one above.</p>
        ) : (
          <ul>
            {splits.map((s) => {
              const link = linkTo(s.id)
              const label = s.title || s.items.map((i) => i.label).join(', ')
              return (
                <li key={s.id}>
                  <p className="split-line">
                    <b>{label}</b> <span className="small">{money(total(s.items))} · {shortDate(new Date(s.created).toISOString())}</span>
                  </p>
                  <p className="small">{s.items.map((i) => `${i.label} ${money(i.paise)}`).join(' · ')}</p>
                  <div className="split-actions">
                    <button type="button" onClick={() => void copy(link)}>
                      {copied === link ? 'copied' : 'copy link'}
                    </button>
                    <a href={link}>open</a>
                    <button type="button" className="link-button" onClick={() => edit(s)}>
                      edit
                    </button>
                    {confirming === s.id ? (
                      <>
                        <button type="button" className="split-danger" onClick={() => void deleteSplit(s.id)}>
                          yes, delete
                        </button>
                        <button type="button" className="link-button" onClick={() => setConfirming(null)}>
                          keep
                        </button>
                      </>
                    ) : (
                      <button type="button" className="link-button" onClick={() => setConfirming(s.id)}>
                        delete
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="split-foot">
        <button type="button" className="link-button" onClick={forget}>
          forget token on this device
        </button>
      </p>
    </>
  )
}
