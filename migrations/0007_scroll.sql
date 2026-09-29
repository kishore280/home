-- "Now scrolling" for the right-now card, sent by the phone's Brainrot app (github.com/kishore280/brainRot,
-- SiteReporter) to worker/scroll.ts. Like the music table: two rows at most, no history.
--   now   the Reels session that is open: its running count, and when the phone last reported
--         (a heartbeat every 30 s; the card drops it when the heartbeats stop)
--   last  the newest finished session: its total, and when it ended
-- Times are ms since 1970. Apply with: npx wrangler d1 migrations apply home --remote

CREATE TABLE IF NOT EXISTS scroll (
  kind TEXT PRIMARY KEY CHECK (kind IN ('now', 'last')),
  app TEXT NOT NULL,
  reels INTEGER NOT NULL CHECK (reels >= 0),
  started INTEGER NOT NULL,
  at INTEGER NOT NULL
);
