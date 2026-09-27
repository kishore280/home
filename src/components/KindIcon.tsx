import { chaiIcon } from './ChaiIcon'

// The icon of a logged kind: chai is always the glass from ChaiIcon (a tea-kadai glass), never the
// ☕ cup in log_kinds.emoji; any other kind shows its emoji.
export function KindIcon({ kind, emoji }: { kind: string; emoji: string }) {
  return kind === 'chai' ? (
    chaiIcon
  ) : (
    <span className="kind-emoji" aria-hidden="true">
      {emoji}
    </span>
  )
}
