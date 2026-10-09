-- Splits (/experiments/split, worker/split.ts): kish makes one (a UPI ID and some items, like
-- "bus 100, food 300"), shares its link, and whoever opens it pays their share in a UPI app.
--   splits  one row per split. The id is the 8 letters and digits in the link (62^8 ways, so it
--           cannot be guessed). WITHOUT ROWID: the id is the real primary key, so a lookup is
--           one search by primary key and nothing else.
--   items   a JSON array of [label, paise], at most 20. They are read and written as a whole, never
--           searched, so one column is enough.
-- Only kish makes and deletes splits (the Worker needs SCROBBLE_TOKEN), so the table stays small.
-- The index is for kish's list: newest first, no sorting step.
-- Apply with: npx wrangler d1 migrations apply home --remote

CREATE TABLE IF NOT EXISTS splits (
  id TEXT PRIMARY KEY CHECK (length(id) = 8),
  title TEXT NOT NULL CHECK (length(title) <= 60),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  vpa TEXT NOT NULL CHECK (length(vpa) BETWEEN 5 AND 100),
  items TEXT NOT NULL CHECK (json_valid(items)),
  created INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS splits_created ON splits (created);
