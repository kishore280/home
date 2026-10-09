-- The optional `aid` of a Google Pay QR code (worker/split.ts). With it, the pay link is written like
-- the QR code Google Pay makes (pa, pn, am, cu, aid), which Google Pay accepts. Without it, the app
-- refused the payment ("exceeded the bank limit").
-- No index: the id is the primary key and this column is only read with the row.
-- Apply with: npx wrangler d1 migrations apply home --remote
-- SQLite has no "ADD COLUMN IF NOT EXISTS", so wrangler's list of applied migrations keeps it from running twice.

ALTER TABLE splits ADD COLUMN aid TEXT CHECK (aid IS NULL OR length(aid) BETWEEN 1 AND 64);
