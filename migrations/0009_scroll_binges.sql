-- "now scrolling", split the way presence systems are built: the live state apart from the history.
--   scroll_now     one row: the open binge, refreshed by the phone's heartbeat (every 30 s). It is
--                  live while its last heartbeat is under 3 min old.
--   scroll_binges  one row per finished binge, written once when it stops (a retried stop updates
--                  the same row: one binge per start time). Kept 30 days. The newest is "last rot",
--                  and the rows are ready for a day's timeline.
-- Each row also keeps today so far as the phone counted it then (reels, minutes, seconds per reel).
-- Replaces the two-row `scroll` table (0007, 0008); its rows were only the live state, soon sent again.
-- Apply with: npx wrangler d1 migrations apply home --remote

DROP TABLE IF EXISTS scroll;

CREATE TABLE IF NOT EXISTS scroll_now (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  app TEXT NOT NULL,
  reels INTEGER NOT NULL CHECK (reels >= 0),
  today INTEGER NOT NULL CHECK (today >= 0),
  minutes INTEGER CHECK (minutes >= 0),
  per_reel INTEGER CHECK (per_reel >= 0),
  started INTEGER NOT NULL,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scroll_binges (
  started INTEGER PRIMARY KEY,
  app TEXT NOT NULL,
  reels INTEGER NOT NULL CHECK (reels > 0),
  today INTEGER NOT NULL CHECK (today >= 0),
  minutes INTEGER CHECK (minutes >= 0),
  per_reel INTEGER CHECK (per_reel >= 0),
  ended INTEGER NOT NULL CHECK (ended >= started)
);

CREATE INDEX IF NOT EXISTS scroll_binges_ended ON scroll_binges (ended);
