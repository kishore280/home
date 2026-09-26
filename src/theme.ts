import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function current(): Theme {
  return stored() ?? (media.matches ? 'dark' : 'light')
}

function apply() {
  document.documentElement.dataset.theme = current()
  listeners.forEach((l) => l())
}

media.addEventListener('change', apply)
apply()

export function toggleTheme(): Theme {
  const next = current() === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Storage can be blocked; the theme still changes for this visit.
  }
  document.documentElement.dataset.theme = next
  listeners.forEach((l) => l())
  return next
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => (document.documentElement.dataset.theme as Theme) ?? current(),
  )
}
