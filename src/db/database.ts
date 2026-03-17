import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations';

export type AlmaDB = BetterSqlite3.Database;

/**
 * Opens a new SQLite database instance (no singleton — callers manage lifecycle).
 * @param dbPath  Path to the .sqlite file, or ':memory:' for in-process tests.
 */
export function openDatabase(dbPath?: string): AlmaDB {
  const resolved = dbPath ?? path.join(process.cwd(), 'alma.db');
  if (resolved !== ':memory:') {
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const db = new BetterSqlite3(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  runMigrations(db);
  return db;
}

/** Close the database. */
export function closeDatabase(db: AlmaDB): void {
  db.close();
}
