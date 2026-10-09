import { useState } from 'react'

// A copy button's state: the text that was just copied (or null), and a function to copy. With no
// clipboard (an old browser, or permission refused) nothing happens, and the text can still be selected.
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied((now) => (now === text ? null : now)), 2000)
    } catch {
      // Not copied: the text is on the page to select.
    }
  }
  return [copied, copy] as const
}
