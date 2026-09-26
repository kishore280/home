import { save } from './lib/storage'

// index.html applies the saved theme before first paint; this only handles the toggle.
export function toggleTheme(): 'light' | 'dark' {
  const root = document.documentElement
  const dark =
    root.dataset.theme === 'dark' ||
    (!root.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const next = dark ? 'light' : 'dark'
  root.dataset.theme = next
  save('theme', next)
  return next
}
