import { useEffect, useRef, useState } from 'react'
import { links, site, updates } from './data'
import { Card } from './components/Card'
import { Mascot, type MascotHandle } from './components/Mascot'
import { Status } from './components/Status'
import { Stats } from './components/Stats'
import { RightNow } from './components/RightNow'
import { YearHeatmap } from './components/YearHeatmap'
import { Counts } from './components/Counts'
import { Buttons, Stamps } from './components/Buttons'
import { Photos } from './components/Photos'
import { Writing } from './components/Blog'
import { Terminal } from './components/Terminal'
import { posts } from './lib/post-list'
import type { MenuItem } from './components/CommandMenu'
import { useCounters } from './hooks/useCounters'
import { shortDate } from './lib/time'
import { toast, useToastRequested } from './lib/toast'
import { track } from './lib/track'
import { lazyPreload, whenIdle } from './lib/lazy'
import { toggleTheme } from './theme'

const CommandMenu = lazyPreload(() => import('./components/CommandMenu'))
const Toasts = lazyPreload(() => import('./components/Toasts'))

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
  const mascot = useRef<MascotHandle>(null)
  const toastRequested = useToastRequested()

  // Load the menu and toasts once the page is idle, so they open at once. The service worker
  // downloads these files anyway (scripts/sw.mjs), so this adds no data.
  useEffect(() => whenIdle(() => void (CommandMenu.preload(), Toasts.preload())), [])

  // ⌘K / Ctrl+K opens and closes the menu; only opening counts as a shortcut use.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!menuOpen) track('Menu shortcut ⌘K')
        setMenuOpen(!menuOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const items: MenuItem[] = [
    { group: 'Do', label: 'Pat the mascot', run: () => mascot.current?.pat() },
    { group: 'Do', label: 'Switch light / dark', run: () => toast(toggleTheme() === 'dark' ? 'Dark mode' : 'Light mode') },
    ...(site.email ? [{ group: 'Do', label: 'Copy email', run: copyEmail }] : []),
    ...links.map((l) => ({ group: 'Links', label: l.label, run: () => window.open(l.href, '_blank', 'noopener') })),
    // Only when the photos card is on the page (it hides with no photos). The hash jump is the
    // browser's own: it scrolls to the card and moves the Tab start there.
    ...(menuOpen && document.getElementById('photos') ? [{ group: 'Go', label: 'Photos', run: () => void (location.hash = 'photos') }] : []),
    ...(posts.length ? [{ group: 'Go', label: 'Blog', href: '/blog' }] : []),
    { group: 'Go', label: 'Now', href: '/now' },
    { group: 'Go', label: 'Colophon', href: '/colophon' },
    { group: 'Secret', label: 'Offline only', href: '/offline' },
  ]

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {/* DOM order is intro, side, main so headings read in order; CSS places them. */}
      <div className="layout">
        {/* h-card (microformats2): who this site is about, for IndieWeb tools. The <data> tags show nothing. */}
        <header className="intro-area h-card">
          <Card>
            <h1>
              hi, i’m <span className="p-name">{site.name}</span>
            </h1>
            <data className="u-url u-uid" value={`${site.url}/`} />
            <data className="p-nickname" value={site.nickname} />
            <data className="p-job-title" value={site.jobTitle} />
            <data className="p-locality" value={site.city} />
            <data className="u-photo" value={`${site.url}/icon-512.png`} />
            {site.intro ? <p className="intro p-note">{site.intro}</p> : null}
            {site.about.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <nav className="links" aria-label="Elsewhere">
              {links.map((l) => (
                <a key={l.href} className="u-url" href={l.href} target="_blank" rel="me noreferrer" data-umami-event={`${l.label} link`}>
                  {l.label} <span aria-hidden="true">↗</span>
                </a>
              ))}
              {site.email ? (
                <button type="button" onClick={copyEmail} data-umami-event="Email copy">
                  {site.email}
                </button>
              ) : null}
            </nav>
          </Card>
        </header>

        <aside className="side">
          <Card>
            <Mascot ref={mascot} pats={counters?.pats ?? null} onPat={() => bump('pats')} />
          </Card>
          {site.statusCafe ? <Status user={site.statusCafe} /> : null}
          <Stats counters={counters} />
          <Counts />
        </aside>

        <main className="main" id="main" tabIndex={-1}>
          <RightNow />
          <Writing />
          <Card title="at the terminal">
            <Terminal src="/casts/checks.cast" cols={72} rows={12} loop label="a real check run before a push: the last commits, the lint and a test" />
          </Card>
          <YearHeatmap />

          {updates.length > 0 ? (
            <Card title="updates">
              <ul className="log">
                {updates.map((u) => (
                  <li key={u.date + u.text}>
                    <time dateTime={u.date}>{shortDate(u.date)}</time>
                    <span>{u.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Buttons />
          <Stamps />
          <Photos />

          <footer>
            <button
              type="button"
              className="link-button"
              data-umami-event="Menu open"
              onClick={() => setMenuOpen(true)}
              onPointerEnter={() => void CommandMenu.preload()}
              onFocus={() => void CommandMenu.preload()}
            >
              <kbd>⌘</kbd>
              <kbd>K</kbd> menu
            </button>
            {/* Slash pages, where the IndieWeb looks for them: the footer. */}
            <nav className="slash-links" aria-label="More about kish">
              {posts.length ? <a href="/blog">blog</a> : null}
              <a href="/now">now</a>
              <a href="/colophon">colophon</a>
            </nav>
          </footer>
        </main>
      </div>

      {menuOpen ? <CommandMenu open={menuOpen} onOpenChange={setMenuOpen} items={items} /> : null}
      {toastRequested ? <Toasts /> : null}
    </>
  )
}
