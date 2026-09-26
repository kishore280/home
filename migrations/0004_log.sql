-- Things kish logs from the /log page (chai, parotta, beach days, and any kind added later),
-- read by worker/log.ts. Apply with: npx wrangler d1 migrations apply home --remote
--
-- Raw events + rollups (Citus: "Materialized views vs. rollup tables"): log_entries keeps every tap;
-- log_totals keeps running sums per day, month, year and all time. Triggers keep the sums right
-- for every write, from the API or typed in the D1 Console (sqlite.org/lang_createtrigger.html), so
-- a page view reads the sums by key and never counts the history (D1 bills rows read).
-- STRICT: SQLite refuses a value of the wrong type (sqlite.org/stricttables.html).
--
-- Remote D1 splits SQL itself (cloudflare/workers-sdk issues 4998 and 10998): trigger bodies use
-- uppercase BEGIN/END and hold no comments, and no comment here uses an apostrophe or a quote.
-- Trigger writes skip the D1 type check (workers-sdk issue 5786); these only copy values of the
-- entry, so the types always match.

-- What can be logged. A new kind is one row here, no code change.
CREATE TABLE IF NOT EXISTS log_kinds (
  kind TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  label TEXT NOT NULL,                                          -- shown on the site, e.g. beach days
  once_a_day INTEGER NOT NULL DEFAULT 0 CHECK (once_a_day IN (0, 1)), -- a day counts once (beach)
  sort INTEGER NOT NULL DEFAULT 0                               -- order on the site
) STRICT, WITHOUT ROWID;

INSERT OR IGNORE INTO log_kinds (kind, emoji, label, once_a_day, sort) VALUES
  ('chai', '☕', 'chai', 0, 1),
  ('parotta', '🫓', 'parotta', 0, 2),
  ('beach', '🌊', 'beach days', 1, 3);

-- Every tap. Undo deletes the entry: an undone tap is a mistake, not history (brandur.org/soft-deletion).
-- A tap typed in the Console needs only the kind and the time (see README).
CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))), -- made on the phone: sent again, counted once
  kind TEXT NOT NULL REFERENCES log_kinds (kind),
  count INTEGER NOT NULL DEFAULT 1 CHECK (count BETWEEN 1 AND 20),
  place TEXT CHECK (place IS NULL OR length(place) <= 60),
  at INTEGER NOT NULL,                                          -- when it happened: UTC, ms since 1970
  tz TEXT NOT NULL DEFAULT 'Asia/Kolkata',                      -- the time zone of the phone then
  -- The day of the site (IST): computed from at, so it can never disagree with it. IST has no
  -- daylight saving time, so +05:30 is exact (IANA Asia/Kolkata).
  day TEXT NOT NULL GENERATED ALWAYS AS (date(at / 1000, 'unixepoch', '+330 minutes')) STORED
) STRICT;

-- The newest entry of a kind by time (an entry from the offline queue can arrive late).
CREATE INDEX IF NOT EXISTS log_entries_newest ON log_entries (kind, at);
-- Entries of a kind on a day: the once-a-day check below.
CREATE INDEX IF NOT EXISTS log_entries_day ON log_entries (kind, day);

-- Running sums. The grain is part of the key, so a range of days (a heatmap) never picks up month
-- or year rows. WITHOUT ROWID: a composite key and small rows, one B-tree lookup instead of two
-- (sqlite.org/withoutrowid.html). Written only by the triggers below.
CREATE TABLE IF NOT EXISTS log_totals (
  kind TEXT NOT NULL REFERENCES log_kinds (kind),
  grain TEXT NOT NULL CHECK (grain IN ('day', 'month', 'year', 'all')),
  period TEXT NOT NULL,                     -- 2026-09-26, 2026-09, 2026 or all (IST)
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (kind, grain, period)
) STRICT, WITHOUT ROWID;

-- A once-a-day kind (beach days): one entry a day, and it counts one.
CREATE TRIGGER IF NOT EXISTS log_entries_once_a_day
BEFORE INSERT ON log_entries
WHEN (SELECT once_a_day FROM log_kinds WHERE kind = NEW.kind) = 1
BEGIN
  SELECT RAISE(ABORT, 'once a day') WHERE EXISTS (SELECT 1 FROM log_entries WHERE kind = NEW.kind AND day = NEW.day);
  SELECT RAISE(ABORT, 'a day counts one') WHERE NEW.count <> 1;
END;

-- Each entry adds to its day, month, year and all time...
CREATE TRIGGER IF NOT EXISTS log_totals_add
AFTER INSERT ON log_entries
BEGIN
  INSERT INTO log_totals (kind, grain, period, count) VALUES
    (NEW.kind, 'day', NEW.day, NEW.count),
    (NEW.kind, 'month', substr(NEW.day, 1, 7), NEW.count),
    (NEW.kind, 'year', substr(NEW.day, 1, 4), NEW.count),
    (NEW.kind, 'all', 'all', NEW.count)
  ON CONFLICT (kind, grain, period) DO UPDATE SET count = count + excluded.count;
END;

-- ...takes it away when deleted (undo); a sum that reaches 0 is removed, so no empty days are
-- left for a heatmap to read...
CREATE TRIGGER IF NOT EXISTS log_totals_remove
AFTER DELETE ON log_entries
BEGIN
  UPDATE log_totals SET count = count - OLD.count
  WHERE kind = OLD.kind AND (
    (grain = 'day' AND period = OLD.day) OR (grain = 'month' AND period = substr(OLD.day, 1, 7)) OR
    (grain = 'year' AND period = substr(OLD.day, 1, 4)) OR (grain = 'all' AND period = 'all'));
  DELETE FROM log_totals
  WHERE kind = OLD.kind AND count = 0 AND (
    (grain = 'day' AND period = OLD.day) OR (grain = 'month' AND period = substr(OLD.day, 1, 7)) OR
    (grain = 'year' AND period = substr(OLD.day, 1, 4)) OR (grain = 'all' AND period = 'all'));
END;

-- ...and moves it when a fix in the Console changes its kind, count or time.
CREATE TRIGGER IF NOT EXISTS log_totals_change
AFTER UPDATE OF kind, count, at ON log_entries
BEGIN
  UPDATE log_totals SET count = count - OLD.count
  WHERE kind = OLD.kind AND (
    (grain = 'day' AND period = OLD.day) OR (grain = 'month' AND period = substr(OLD.day, 1, 7)) OR
    (grain = 'year' AND period = substr(OLD.day, 1, 4)) OR (grain = 'all' AND period = 'all'));
  DELETE FROM log_totals
  WHERE kind = OLD.kind AND count = 0 AND (
    (grain = 'day' AND period = OLD.day) OR (grain = 'month' AND period = substr(OLD.day, 1, 7)) OR
    (grain = 'year' AND period = substr(OLD.day, 1, 4)) OR (grain = 'all' AND period = 'all'));
  INSERT INTO log_totals (kind, grain, period, count) VALUES
    (NEW.kind, 'day', NEW.day, NEW.count),
    (NEW.kind, 'month', substr(NEW.day, 1, 7), NEW.count),
    (NEW.kind, 'year', substr(NEW.day, 1, 4), NEW.count),
    (NEW.kind, 'all', 'all', NEW.count)
  ON CONFLICT (kind, grain, period) DO UPDATE SET count = count + excluded.count;
END;
