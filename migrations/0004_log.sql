-- Chai, parotta and beach days logged from the phone (worker/log.ts).
-- Apply with: npx wrangler d1 migrations apply home --remote
--
-- log_totals keeps the sums: the D1 free plan counts rows read (scanned), 5 million a day, so a
-- page view reads a few rows by primary key and never scans every entry.

CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL UNIQUE, -- UUID from the phone: a replayed request (offline queue) is not counted twice
  kind TEXT NOT NULL CHECK (kind IN ('chai', 'parotta', 'beach')),
  count INTEGER NOT NULL DEFAULT 1 CHECK (count BETWEEN 1 AND 20),
  place TEXT,                     -- beach only, optional, max 60 characters
  at INTEGER NOT NULL,            -- ms since 1970: when it was tapped on the phone
  day TEXT NOT NULL               -- the IST date (YYYY-MM-DD) of `at`
);

-- The newest entry of a kind (ORDER BY id DESC LIMIT 1) without a scan.
CREATE INDEX IF NOT EXISTS log_entries_kind ON log_entries (kind, id);

-- A beach day counts once, however many times it is logged.
CREATE UNIQUE INDEX IF NOT EXISTS log_one_beach_a_day ON log_entries (day) WHERE kind = 'beach';

CREATE TABLE IF NOT EXISTS log_totals (
  kind TEXT NOT NULL,
  period TEXT NOT NULL, -- 'all', 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' (IST)
  count INTEGER NOT NULL, -- beach: days (one a day)
  PRIMARY KEY (kind, period)
);
