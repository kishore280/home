import { Command } from 'cmdk'
import { track } from '../lib/track'

export type MenuItem = { group: string; label: string; run: () => void }

// Loaded with React.lazy, so cmdk is only downloaded when someone opens the menu.
export default function CommandMenu({
  open,
  onOpenChange,
  items,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: MenuItem[]
}) {
  // One pass to group items (Vercel rule js-index-maps).
  const groups = new Map<string, MenuItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Menu"
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
    >
      <Command.Input placeholder="Type to search…" />
      <Command.List>
        <Command.Empty>Nothing found.</Command.Empty>
        {[...groups].map(([group, groupItems]) => (
          <Command.Group key={group} heading={group}>
            {groupItems.map((item) => (
                <Command.Item
                  key={item.label}
                  onSelect={() => {
                    onOpenChange(false)
                    track(`Menu: ${item.label}`)
                    item.run()
                  }}
                >
                  {item.label}
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  )
}
