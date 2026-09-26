import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { useEffect, useRef } from 'react'
import { track } from '../lib/track'

// An item runs an action, or opens a page on this site in the same tab.
export type MenuItem = { group: string; label: string } & ({ run: () => void } | { href: string })

// Loaded with lazyPreload (src/lib/lazy.tsx): cmdk is not in the first download; it loads when idle.
// Built on Radix Dialog (what cmdk's Command.Dialog uses) so a tap outside closes the menu
// on the click, not on pointer down: the overlay takes that click, and nothing under it does.
export default function CommandMenu({
  open,
  onOpenChange,
  items,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: MenuItem[]
}) {
  // Radix returns focus only to a Dialog.Trigger. The menu opens from a button or ⌘K,
  // so remember what had focus and give it back on close.
  const opener = useRef<Element | null>(null)
  // Set once an item opens a page, so a second tap does not count or navigate again.
  const leaving = useRef(false)

  // A page item leaves the menu open (below); if Back brings this page back from the
  // back/forward cache, close it then (web.dev "bfcache": update state on pageshow).
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && onOpenChange(false)
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [onOpenChange])

  // One pass to group items (Vercel rule js-index-maps).
  const groups = new Map<string, MenuItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmdk-overlay" onClick={() => onOpenChange(false)} />
        <Dialog.Content
          className="cmdk-content"
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={() => (opener.current = document.activeElement)}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (opener.current instanceof HTMLElement) opener.current.focus()
          }}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          {/* Plain "contains" search: cmdk's fuzzy match put "Switch light / dark" first for "git". */}
          <Command label="Menu" filter={(value, search) => (value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
            <Command.Input placeholder="Type to search…" />
            <Command.List>
              <Command.Empty>Nothing found.</Command.Empty>
              {[...groups].map(([group, groupItems]) => (
                <Command.Group key={group} heading={group}>
                  {groupItems.map((item) => (
                    <Command.Item
                      key={item.label}
                      onSelect={() => {
                        if (leaving.current) return
                        void track(`Menu: ${item.label}`)
                        if ('run' in item) {
                          onOpenChange(false)
                          return item.run()
                        }
                        // Keep the menu open: the browser shows this page until the next one
                        // paints (Chrome "paint holding"), so the home page never flashes.
                        // No wait: Umami sends with fetch({ keepalive: true }), which finishes
                        // after the page is gone (MDN, "keepalive"), like gtag's beacon transport.
                        leaving.current = true
                        window.location.assign(item.href)
                      }}
                    >
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
