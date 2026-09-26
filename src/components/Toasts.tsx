import { useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { connectToaster } from '../lib/toast'

const OPTIONS = { className: 'toast' }

// Loaded with lazyPreload (src/lib/lazy.tsx), mounted on the first toast. Toaster subscribes in its own effect,
// which runs before this one, so the queued messages are not lost.
export default function Toasts() {
  useEffect(() => connectToaster((m) => (m.error ? toast.error(m.text) : toast(m.text))), [])
  return <Toaster position="bottom-center" toastOptions={OPTIONS} />
}
