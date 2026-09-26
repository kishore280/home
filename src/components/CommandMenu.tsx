import { Command } from 'cmdk'

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
  const groups = [...new Set(items.map((i) => i.group))]

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
        {groups.map((group) => (
          <Command.Group key={group} heading={group}>
            {items
              .filter((i) => i.group === group)
              .map((item) => (
                <Command.Item
                  key={item.label}
                  onSelect={() => {
                    onOpenChange(false)
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
