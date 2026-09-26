import { useCallback, useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { building, links, photos, reading, site } from './data'
import { Clock } from './components/Clock'
import { NowPlaying } from './components/NowPlaying'
import { useNowPlaying } from './hooks/useNowPlaying'
import { Photos } from './components/Photos'
import { Guestbook } from './components/Guestbook'
import { CommandMenu, type MenuItem } from './components/CommandMenu'
import { toggleTheme, useTheme } from './theme'

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [photo, setPhoto] = useState<number | null>(null)
  const music = useNowPlaying()
  const theme = useTheme()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMenuOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(site.email)
      toast('Email copied')
    } catch {
      toast(site.email)
    }
  }, [])

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  const items: MenuItem[] = [
    { group: 'Navigate', label: 'Photos', run: () => scrollTo('photos') },
    {
      group: 'Navigate',
      label: 'Guestbook',
      run: () => {
        scrollTo('guestbook')
        setTimeout(() => document.getElementById('guestbook-input')?.focus(), 400)
      },
    },
    { group: 'Actions', label: 'Copy email', run: copyEmail },
    {
      group: 'Actions',
      label: theme === 'dark' ? 'Light theme' : 'Dark theme',
      run: () => toast(toggleTheme() === 'dark' ? 'Dark theme' : 'Light theme'),
    },
    ...(music.live
      ? []
      : [{ group: 'Actions', label: 'Skip to next song', run: () => toast(`Now playing: ${music.next().title}`) }]),
    {
      group: 'Actions',
      label: 'Open a random photo',
      run: () => setPhoto(Math.floor(Math.random() * photos.length)),
    },
    ...links.map((l) => ({ group: 'Links', label: l.label, shortcut: '↗', run: () => window.open(l.href, '_blank') })),
  ]

  return (
    <>
      <main>
        <header>
          <div>
            <h1>{site.name}</h1>
            <p className="muted">{site.bio}</p>
          </div>
          <Clock />
        </header>

        <section aria-labelledby="now">
          <h2 id="now">right now</h2>
          <div className="status">
            <NowPlaying state={music} />
            <div className="row">
              <div className="row-key">
                <span className="dot" aria-hidden="true" />
                building
              </div>
              <div className="row-value">
                {building.project} <span className="muted">— “{building.message}”</span>
              </div>
              <div className="row-meta">{building.ago}</div>
            </div>
            <div className="row">
              <div className="row-key">reading</div>
              <div className="row-value">
                {reading.title} <span className="muted">— {reading.detail}</span>
              </div>
              <div className="row-meta">{reading.progress}</div>
            </div>
          </div>
        </section>

        <section aria-labelledby="about">
          <h2 id="about">about</h2>
          <p className="prose">{site.about}</p>
        </section>

        <section id="photos" aria-labelledby="photos-heading">
          <h2 id="photos-heading">photos</h2>
          <Photos open={photo} onOpen={setPhoto} />
        </section>

        <section id="guestbook" aria-labelledby="guestbook-heading">
          <h2 id="guestbook-heading">guestbook</h2>
          <Guestbook />
        </section>

        <section aria-labelledby="elsewhere">
          <h2 id="elsewhere">elsewhere</h2>
          <div className="links">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            ))}
            <button type="button" onClick={copyEmail}>
              {site.email}
            </button>
          </div>
        </section>

        <footer>
          <span>built with cmdk · sonner · motion · geist</span>
          <button type="button" className="menu-button" onClick={() => setMenuOpen(true)}>
            <kbd>⌘</kbd> <kbd>K</kbd> menu
          </button>
        </footer>
      </main>

      <CommandMenu open={menuOpen} onOpenChange={setMenuOpen} items={items} />
      <Toaster position="bottom-center" theme={theme} toastOptions={{ className: 'toast' }} />
    </>
  )
}
