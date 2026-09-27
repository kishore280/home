---
name: add-log-kind
description: "Add a new thing to count on kichoow.com (a new kind for the /log page, the counts card and the "my days" card), for example badminton, gym or sleep. Use when the user asks to track, log or count something new, or to change or remove a kind."
---

# Add a kind to the log

The /log page, the counts card, the "my days" card (its chips, its grid and the day note) and the toasts all read the kinds from the D1
table `log_kinds`. A new kind is **one row**. Only the parts in step 3 do not follow by themselves.
Badminton days (`migrations/0006_badminton.sql`, PR "Badminton days") is the worked example.

## 1. Decide the row (ask the user only if it is not clear)

| Column | Meaning | Example |
|---|---|---|
| `kind` | The id: lowercase, one word, never changed later (entries point to it). Also the button text and the `?add=` shortcut. | `badminton` |
| `emoji` | Shown before the name. Chai is the exception: `KindIcon.tsx` draws the chai glass. | `🏸` |
| `label` | The name on the counts card and the "my days" title when the kind's chip is picked. Plural of days for a once-a-day kind. | `badminton days` |
| `once_a_day` | `1`: one per day (a "day" button and an optional place, like beach). `0`: taps with +1 and +2 buttons (like chai). | `1` |
| `sort` | The order on the page, the counts and the "my days" chips. | `4` |

## 2. The migration (the database)

Add `migrations/000N_<kind>.sql` with one statement:

```sql
INSERT INTO log_kinds (kind, emoji, label, once_a_day, sort)
VALUES ('badminton', '🏸', 'badminton days', 1, 4)
ON CONFLICT (kind) DO NOTHING;
```

- Use `ON CONFLICT (kind) DO NOTHING`, not `INSERT OR IGNORE`. Both are safe to run twice, but
  `OR IGNORE` also silently skips a row that fails a `CHECK` or `NOT NULL`
  ([SQLite: ON CONFLICT](https://sqlite.org/lang_conflict.html)).
- The live D1 was set up by hand in the dashboard Console, so give the user this SQL, with no
  comments, to run in **Cloudflare → D1 → `home` → Console**. The tests apply the file themselves
  (`playwright.config.ts` runs `wrangler d1 migrations apply home --local`).
- Follow the SQL review rule in `AGENTS.md` (run it twice on a local D1, no new full scans).
  Adding a row adds no query and no read per visit, apart from one more counts row.

## 3. The code that does not follow by itself

| File | What to change | Why |
|---|---|---|
| `src/components/Counts.tsx` | `PENDING_ROWS` = the number of kinds | The loading rows before the counts arrive, one per kind (a kind shows its row only once it is logged). |
| `public/log.webmanifest` | Add a shortcut `/log?add=<kind>` with a distinct `name`; update `description` | Long-press shortcuts of the installed app. Order them by use: **Chrome for Android shows only the first 3** ([web.dev: App shortcuts](https://web.dev/articles/app-shortcuts)). |
| `src/components/KindIcon.tsx` | Only for a kind that needs a drawn icon instead of its emoji (like chai) | |
| `src/components/ChaiClock.tsx` | Nothing: the clock is for chai only | |

The /log buttons, the place field (shared by all once-a-day kinds: its label lists them, like
"beach / badminton place (optional)"), the toasts, the counts row, the "my days" chip, its "all" grid (the legend goes to the number of kinds) and the day note need no change.

## 4. Tests (all must pass: `npm run build`, `npm run lint`, `npm run audit`)

- `tests/log.spec.ts`
  - The first summary test lists every kind (`{ chai: null, …, <kind>: null }`).
  - Add a test like "badminton days (migrations/0006)": run the migration file a second time, check
    the order of kinds, the emoji, the label and `onceADay`, log one, check the counts, undo it.
  - Add a /log page test: the button logs, the toast shows, the counts card shows the kind.
  - The manifest test lists every shortcut URL, in order.
  - A once-a-day kind changes the place field label: update `getByLabel('… place (optional)')`.
- `tests/ui.spec.ts`
  - Add the kind to `logReply` (and to its type).
  - The pre-render test counts `PENDING_ROWS` placeholder rows.
  - The layout shift test mocks every kind and expects that many `.count` rows.

## 5. Docs and ship

- README: the list of kinds in "Log" and the set-up steps (the new migration).
- Ship as `AGENTS.md` says. After the merge, give the user the SQL for the Console, then check
  `curl https://kichoow.com/api/log` lists the kind.

## Change or remove a kind

- Rename what people see: `UPDATE log_kinds SET label = '…', emoji = '…' WHERE kind = '…';`
  (never change `kind`: the entries point to it).
- Once a day ↔ taps: `UPDATE log_kinds SET once_a_day = 0 WHERE kind = '…';` Past entries stay.
- Remove: delete its entries first (the triggers take the totals back), then the row:
  `DELETE FROM log_entries WHERE kind = '…'; DELETE FROM log_kinds WHERE kind = '…';`
  Then take it out of the manifest, `PENDING_ROWS` and the tests.
