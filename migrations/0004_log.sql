-- Things kish logs from the /log page (chai, parotta, beach days, and any kind added later),
-- read by worker/log.ts. Apply with: npx wrangler d1 migrations apply home --remote
--
-- Raw events + rollups (Citus: "Materialized views vs. rollup tables"): log_entries keeps every tap
-- forever; log_totals keeps running sums per day, month, year and all time, updated in the same
-- transaction. A page view reads the rollups by primary key, never the whole history (D1 bills
-- rows read). STRICT: SQLite refuses a value of the wrong type (sqlite.org/stricttables.html).

-- What can be logged. A new kind is one row here, no code change.
CREATE TABLE IF NOT EXISTS log_kinds (
  kind TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  label TEXT NOT NULL,                                          -- shown on the site, e.g. 'beach days'
  once_a_day INTEGER NOT NULL DEFAULT 0 CHECK (once_a_day IN (0, 1)), -- a day counts once (beach)
  sort INTEGER NOT NULL DEFAULT 0                               -- order on the site
) STRICT, WITHOUT ROWID;

INSERT OR IGNORE INTO log_kinds (kind, emoji, label, once_a_day, sort) VALUES
  ('chai', '☕', 'chai', 0, 1),
  ('parotta', '🫓', 'parotta', 0, 2),
  ('beach', '🌊', 'beach days', 1, 3);

-- Every tap, never deleted: undo marks it (undone_at), so the full history stays.
-- No AUTOINCREMENT: rows are never deleted, so ids are never reused (sqlite.org/autoinc.html).
CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,           -- made on the phone: a request sent again counts once
  kind TEXT NOT NULL REFERENCES log_kinds (kind),
  count INTEGER NOT NULL DEFAULT 1 CHECK (count BETWEEN 1 AND 20),
  place TEXT CHECK (place IS NULL OR length(place) <= 60),
  at INTEGER NOT NULL,                      -- when it happened: UTC, ms since 1970
  tz TEXT NOT NULL,                         -- the phone's time zone then, e.g. 'Asia/Kolkata'
  day TEXT NOT NULL,                        -- the site's day (IST), YYYY-MM-DD: what the totals count
  once_day TEXT,                            -- = day for a once-a-day kind while not undone, else NULL
  undone_at INTEGER                         -- ms since 1970, set by undo
) STRICT;

-- The newest entry of a kind, in one index read (partial index: only entries not undone).
CREATE INDEX IF NOT EXISTS log_entries_newest ON log_entries (kind, id) WHERE undone_at IS NULL;
-- A once-a-day kind counts once a day. Partial: other kinds and undone entries (once_day NULL) are
-- not in it at all (D1 docs: partial indexes are faster to read and to write).
CREATE UNIQUE INDEX IF NOT EXISTS log_entries_once_a_day ON log_entries (kind, once_day) WHERE once_day IS NOT NULL;

-- Running sums. The grain is part of the key, so a range of days (a heatmap) never picks up month
-- or year rows. WITHOUT ROWID: a composite key and small rows, one B-tree lookup instead of two
-- (sqlite.org/withoutrowid.html).
CREATE TABLE IF NOT EXISTS log_totals (
  kind TEXT NOT NULL REFERENCES log_kinds (kind),
  grain TEXT NOT NULL CHECK (grain IN ('day', 'month', 'year', 'all')),
  period TEXT NOT NULL,                     -- '2026-09-26', '2026-09', '2026' or 'all' (IST)
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (kind, grain, period)
) STRICT, WITHOUT ROWID;
