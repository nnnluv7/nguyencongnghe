-- D1 schema for the Netlify Blobs-compatible store used by functions/_cf/store.mjs.
--
-- One table holds all 12 Blobs stores (distinguished by the `store` column).
-- JSON and short text values live in `value`; binary payloads (story images,
-- avatars, MP3 samples) live in the R2 bucket, with only their metadata row
-- (kind='binary', value NULL) kept here so CAS/etag semantics stay uniform.
--
-- Create the database on the Cloudflare dashboard (or `wrangler d1 create`),
-- then apply this file:
--   wrangler d1 execute NCN_DB --file=functions/_cf/schema.sql
-- For local development:
--   wrangler d1 execute NCN_DB --local --file=functions/_cf/schema.sql

CREATE TABLE IF NOT EXISTS blobs (
  store      TEXT NOT NULL,
  key        TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('json', 'text', 'binary')),
  value      TEXT,
  etag       TEXT NOT NULL,
  metadata   TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (store, key)
);

CREATE INDEX IF NOT EXISTS blobs_store_key ON blobs (store, key);
