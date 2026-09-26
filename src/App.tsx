import { useCallback, useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { links, photos, site } from './data'
import { Clock } from './components/Clock'
import { NowPlaying, type Track } from './components/NowPlaying'
import { Building, type Activity } from './components/Building'
import { Photos } from './components/Photos'
import { CommandMenu, type MenuItem } from './components/CommandMenu'
import { useLive } from './hooks/useLive'
import { toggleTheme, useTheme } from './theme'

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [photo, setPhoto] = useState<number | null>(null)
  const track = useLive<Track>('/api/now-playing', 30_000)
  const activity = useLive<Activity>(site.github ? `/api/github?user=${site.github}` : null, 300_000)
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

  const items: MenuItem[] = [
    ...(photos.length
      ? [
          {
            group: 'Navigate',
            label: 'Photos',
            run: () => document.getElementById('photos')?.scrollIntoView({ behavior: 'smooth' }),
          },
          {
            group: 'Actions',
            label: 'Open a random photo',
            run: () => setPhoto(Math.floor(Math.random() * photos.length)),
          },
        ]
      : []),
    ...(site.email ? [{ group: 'Actions', label: 'Copy email', run: copyEmail }] : []),
    {
      group: 'Actions',
      label: theme === 'dark' ? 'Light theme' : 'Dark theme',
      run: () => toast(toggleTheme() === 'dark' ? 'Dark theme' : 'Light theme'),
    },
    ...links.map((l) => ({ group: 'Links', label: l.label, shortcut: '↗', run: () => window.open(l.href, '_blank') })),
  ]

  return (
    <>
      <main>
        <header>
          <div>
            <h1>{site.name}</h1>
            {site.bio && <p className="muted">{site.bio}</p>}
          </div>
          {site.timeZone && <Clock />}
        </header>

        {(track || activity) && (
          <section aria-labelledby="now">
            <h2 id="now">right now</h2>
            <div className="status">
              {track && <NowPlaying track={track} />}
              {activity && <Building activity={activity} />}
            </div>
          </section>
        )}

        {site.about && (
          <section aria-labelledby="about">
            <h2 id="about">about</h2>
            <p className="prose">{site.about}</p>
          </section>
        )}

        {photos.length > 0 && (
          <section id="photos" aria-labelledby="photos-heading">
            <h2 id="photos-heading">photos</h2>
            <Photos open={photo} onOpen={setPhoto} />
          </section>
        )}

        <section aria-labelledby="elsewhere">
          <h2 id="elsewhere">elsewhere</h2>
          <div className="links">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            ))}
            {site.email && (
              <button type="button" onClick={copyEmail}>
                {site.email}
              </button>
            )}
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
