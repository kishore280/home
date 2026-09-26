-- Site counters (views, pats).
-- Apply with: npx wrangler d1 execute home --remote --file migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO counters (key, value) VALUES ('views', 0), ('pats', 0);
