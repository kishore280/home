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
  // Keep the browser bar colour in step with the chosen theme.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = next === 'dark' ? '#1b1726' : '#f6f3fc'
  }
  return next
}
