import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

export type Db = Database.Database;

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS segments (tag TEXT NOT NULL, wallet TEXT NOT NULL, PRIMARY KEY (tag, wallet));
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY, advertiser TEXT NOT NULL, tags TEXT NOT NULL, price_per_view INTEGER NOT NULL,
      min_dwell_ms INTEGER NOT NULL, freq_cap INTEGER NOT NULL, budget INTEGER NOT NULL, creative TEXT NOT NULL,
      segment_root TEXT NOT NULL, leaves TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS impressions (
      id TEXT PRIMARY KEY, nonce TEXT NOT NULL, campaign_id INTEGER NOT NULL, identity TEXT NOT NULL,
      viewer TEXT NOT NULL, host_ata TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'issued', claim_id TEXT, audit_hash TEXT, tx TEXT
    );
    CREATE INDEX IF NOT EXISTS impressions_identity_day ON impressions (identity, issued_at);
  `);
  return db;
}
