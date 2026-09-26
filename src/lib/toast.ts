import { useSyncExternalStore } from 'react'

// Toasts only appear after a click, so sonner is not in the first download; it is mounted on the first toast
// (Vercel rule bundle-defer-third-party). Messages wait in a queue until it mounts.
// An optional action button (e.g. "Undo") uses sonner's own `action` option.
type Action = { label: string; onClick: () => void }
type Message = { text: string; error?: boolean; action?: Action }

const queue: Message[] = []
const listeners = new Set<() => void>()
let emit: ((m: Message) => void) | null = null
let requested = false

export function toast(text: string, options: { error?: boolean; action?: Action } = {}) {
  const message = { text, ...options }
  if (emit) return emit(message)
  queue.push(message)
  if (!requested) {
    requested = true
    listeners.forEach((l) => l())
  }
}

// Called by the lazy Toasts component once sonner's Toaster is mounted.
export function connectToaster(show: (m: Message) => void) {
  emit = show
  queue.splice(0).forEach(show)
}

export const useToastRequested = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => requested,
    () => false,
  )
