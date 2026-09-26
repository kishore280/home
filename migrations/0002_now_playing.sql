-- The latest song sent by the phone (worker/scrobble.ts). One row only: no listening history is kept.
-- Apply with: npx wrangler d1 migrations apply home --remote

CREATE TABLE IF NOT EXISTS now_playing (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  started_at INTEGER NOT NULL, -- ms since 1970
  duration_ms INTEGER          -- null when the player does not say
);
