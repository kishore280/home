-- The chai clock: how many of each kind in each hour of the day (IST), for all time. Read by
-- worker/log.ts; drawn by src/components/ChaiClock.tsx. At most 24 rows a kind.
-- Apply with: npx wrangler d1 migrations apply home --remote
--
-- Only adds: a table, the hours of the entries already logged, and three more triggers on
-- log_entries (SQLite runs every trigger of an event). Safe to run twice: the fill recounts.
-- Same rules as 0004_log.sql for the remote D1 splitter: uppercase BEGIN/END, no comments inside
-- trigger bodies, no quotes in comments. The hour of an entry is its UTC time plus 5:30 (IST).

CREATE TABLE IF NOT EXISTS log_hours (
  kind TEXT NOT NULL REFERENCES log_kinds (kind),
  hour INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (kind, hour)
) STRICT, WITHOUT ROWID;

INSERT INTO log_hours (kind, hour, count)
SELECT kind, CAST(strftime('%H', at / 1000, 'unixepoch', '+330 minutes') AS INTEGER) AS h, sum(count)
FROM log_entries
GROUP BY kind, h
ON CONFLICT (kind, hour) DO UPDATE SET count = excluded.count;

CREATE TRIGGER IF NOT EXISTS log_hours_add
AFTER INSERT ON log_entries
BEGIN
  INSERT INTO log_hours (kind, hour, count)
  VALUES (NEW.kind, CAST(strftime('%H', NEW.at / 1000, 'unixepoch', '+330 minutes') AS INTEGER), NEW.count)
  ON CONFLICT (kind, hour) DO UPDATE SET count = count + excluded.count;
END;

CREATE TRIGGER IF NOT EXISTS log_hours_remove
AFTER DELETE ON log_entries
BEGIN
  UPDATE log_hours SET count = count - OLD.count
  WHERE kind = OLD.kind AND hour = CAST(strftime('%H', OLD.at / 1000, 'unixepoch', '+330 minutes') AS INTEGER);
  DELETE FROM log_hours
  WHERE kind = OLD.kind AND count = 0 AND hour = CAST(strftime('%H', OLD.at / 1000, 'unixepoch', '+330 minutes') AS INTEGER);
END;

CREATE TRIGGER IF NOT EXISTS log_hours_change
AFTER UPDATE OF kind, count, at ON log_entries
BEGIN
  UPDATE log_hours SET count = count - OLD.count
  WHERE kind = OLD.kind AND hour = CAST(strftime('%H', OLD.at / 1000, 'unixepoch', '+330 minutes') AS INTEGER);
  DELETE FROM log_hours
  WHERE kind = OLD.kind AND count = 0 AND hour = CAST(strftime('%H', OLD.at / 1000, 'unixepoch', '+330 minutes') AS INTEGER);
  INSERT INTO log_hours (kind, hour, count)
  VALUES (NEW.kind, CAST(strftime('%H', NEW.at / 1000, 'unixepoch', '+330 minutes') AS INTEGER), NEW.count)
  ON CONFLICT (kind, hour) DO UPDATE SET count = count + excluded.count;
END;
