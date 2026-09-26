// Versioned localStorage helpers. Storage can throw (private mode, blocked), so every call is guarded.
const VERSION = 'v1'

export function load(key: string): string | null {
  try {
    return localStorage.getItem(`${key}:${VERSION}`)
  } catch {
    return null
  }
}

export function save(key: string, value: string) {
  try {
    localStorage.setItem(`${key}:${VERSION}`, value)
  } catch {
    // Not saved; the change still applies for this visit.
  }
}
