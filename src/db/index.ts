import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations';

export type DB = BetterSqlite3.Database;

let _db: DB | null = null;

/**
 * Opens (or returns cached) the SQLite database.
 * @param dbPath  Path to the .sqlite file. Defaults to ./alma.db
 */
export function openDb(dbPath?: string): DB {
  if (_db) return _db;

  const resolved = dbPath ?? path.join(process.cwd(), 'alma.db');
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new BetterSqlite3(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  runMigrations(db);
  _db = db;
  return db;
}

/** Close the database (useful in tests). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/** Reset the cached db instance (tests only). */
export function resetDbInstance(): void {
  _db = null;
}
