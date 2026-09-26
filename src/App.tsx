import { lazy, Suspense, useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { links, site, updates } from './data'
import { Card } from './components/Card'
import { Mascot } from './components/Mascot'
import { Status } from './components/Status'
import { Stats } from './components/Stats'
import { RightNow } from './components/RightNow'
import { Buttons } from './components/Buttons'
import type { MenuItem } from './components/CommandMenu'
import { useCounters } from './hooks/useCounters'
import { toggleTheme } from './theme'

const loadMenu = () => import('./components/CommandMenu')
const CommandMenu = lazy(loadMenu)

// Count one view per page load (module guard) and per browser session (storage guard).
let viewCounted = false

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(site.email)
    toast('Email copied')
  } catch {
    toast(site.email)
  }
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { counters, bump } = useCounters()

  useEffect(() => {
    if (viewCounted) return
    viewCounted = true
    try {
      if (sessionStorage.getItem('viewed')) return
      sessionStorage.setItem('viewed', '1')
    } catch {
      // Storage blocked: count the view anyway.
    }
    bump('views')
  }, [bump])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMenuOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items: MenuItem[] = [
    { group: 'Do', label: 'Pat the mascot', run: () => document.querySelector<HTMLButtonElement>('.mascot-button')?.click() },
    { group: 'Do', label: 'Switch light / dark', run: () => toast(toggleTheme() === 'dark' ? 'Dark mode' : 'Light mode') },
    ...(site.email ? [{ group: 'Do', label: 'Copy email', run: copyEmail }] : []),
    ...links.map((l) => ({ group: 'Links', label: l.label, run: () => window.open(l.href, '_blank', 'noopener') })),
  ]

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="layout">
        <aside className="side">
          <Card>
            <Mascot pats={counters?.pats ?? null} onPat={() => bump('pats')} />
          </Card>
          {site.statusCafe ? <Status user={site.statusCafe} /> : null}
          <Stats counters={counters} />
        </aside>

        <main className="main" id="main">
          <Card>
            <h1>
              hi, i'm {site.name}{' '}
              <span className="wave" aria-hidden="true">
                👋
              </span>
            </h1>
            {site.intro ? <p className="intro">{site.intro}</p> : null}
            {site.about.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <nav className="links" aria-label="Elsewhere">
              {links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                  {l.label} ↗
                </a>
              ))}
              {site.email ? (
                <button type="button" onClick={copyEmail}>
                  {site.email}
                </button>
              ) : null}
            </nav>
          </Card>

          <RightNow />

          {updates.length > 0 ? (
            <Card title="updates">
              <ul className="log">
                {updates.map((u) => (
                  <li key={u.date + u.text}>
                    <time dateTime={u.date}>{u.date}</time>
                    <span>{u.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Buttons />

          <footer>
            <button
              type="button"
              className="link-button"
              onClick={() => setMenuOpen(true)}
              onPointerEnter={() => void loadMenu()}
              onFocus={() => void loadMenu()}
            >
              <kbd>⌘</kbd>
              <kbd>K</kbd> menu
            </button>
          </footer>
        </main>
      </div>

      {menuOpen ? (
        <Suspense fallback={null}>
          <CommandMenu open={menuOpen} onOpenChange={setMenuOpen} items={items} />
        </Suspense>
      ) : null}
      <Toaster position="bottom-center" toastOptions={{ className: 'toast' }} />
    </>
  )
}
