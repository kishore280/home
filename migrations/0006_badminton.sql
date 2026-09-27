-- Badminton days: a new kind for the /log page. The buttons, the counts row, the heatmap chip and
-- the toasts all come from log_kinds, so a kind is one row (.claude/skills/add-log-kind).
-- Apply with: npx wrangler d1 migrations apply home --remote (or paste the INSERT in the D1 Console).
--
-- Once a day, like beach days: a morning on the court is one day, with an optional place (the
-- court). To count sessions instead: UPDATE log_kinds SET once_a_day = 0 WHERE kind = 'badminton';
-- ON CONFLICT (kind) DO NOTHING, not INSERT OR IGNORE: safe to run twice, and a wrong value (a
-- CHECK or NOT NULL failure) is still an error instead of a silently skipped row (sqlite.org/lang_conflict.html).

INSERT INTO log_kinds (kind, emoji, label, once_a_day, sort)
VALUES ('badminton', '🏸', 'badminton days', 1, 4)
ON CONFLICT (kind) DO NOTHING;
