import { Command } from 'cmdk'

export type MenuItem = {
  group: string
  label: string
  shortcut?: string
  run: () => void
}

export function CommandMenu({
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
      label="Command menu"
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
    >
      <Command.Input placeholder="Type a command or search…" />
      <Command.List>
        <Command.Empty>No results</Command.Empty>
        {groups.map((group) => (
          <Command.Group key={group} heading={group}>
            {items
              .filter((i) => i.group === group)
              .map((item) => (
                <Command.Item
                  key={item.label}
                  onSelect={() => {
                    onOpenChange(false)
                    setTimeout(item.run, 120)
                  }}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <kbd>{item.shortcut}</kbd>}
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  )
}
