-- "now scrolling" also keeps today so far, as the Brainrot app's Today screen shows it: the count
-- (its big number), the minutes in Reels and the seconds per reel. The card shows the day's total
-- with "scrolling now" or "last scrolled", and the time per reel on hover. SQLite has no ADD COLUMN IF NOT EXISTS, so
-- the table is made again: it holds at most two short-lived rows, and the phone fills it again
-- within 30 s of scrolling. Safe to run twice.
-- minutes and per_reel (seconds) are null when the app does not send them (an older app, or too
-- few reels to average).
-- Apply with: npx wrangler d1 migrations apply home --remote

DROP TABLE IF EXISTS scroll;

CREATE TABLE scroll (
  kind TEXT PRIMARY KEY CHECK (kind IN ('now', 'last')),
  app TEXT NOT NULL,
  reels INTEGER NOT NULL CHECK (reels >= 0),
  today INTEGER NOT NULL CHECK (today >= 0),
  minutes INTEGER CHECK (minutes >= 0),
  per_reel INTEGER CHECK (per_reel >= 0),
  started INTEGER NOT NULL,
  at INTEGER NOT NULL
);
