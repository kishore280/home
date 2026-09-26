-- Music for the "right now" card, stored the way ListenBrainz does it: "playing now" apart from
-- listens. Two rows at most, no history:
--   playing_now  set from the server's clock, until it expires (the song's length)
--   listen       the newest finished listen, by the phone's listened_at
-- Replaces 0002 (one row that mixed both clocks). Its row is only the latest song, so nothing is lost.
-- Apply with: npx wrangler d1 migrations apply home --remote

DROP TABLE IF EXISTS now_playing;

CREATE TABLE IF NOT EXISTS music (
  kind TEXT PRIMARY KEY CHECK (kind IN ('playing_now', 'listen')),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  at INTEGER NOT NULL,  -- ms since 1970: when the song started
  until INTEGER         -- ms since 1970: when "playing now" expires (playing_now only)
);
