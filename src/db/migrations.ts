import type { AlmaDB } from './database';
import { MIGRATIONS, SCHEMA_VERSION } from './schema';

/** Returns current applied schema version (0 if fresh). */
function getCurrentVersion(db: AlmaDB): number {
  try {
    const row = db
      .prepare("SELECT value FROM schema_meta WHERE key='schema_version'")
      .get() as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    // schema_meta table doesn't exist yet — version 0
    return 0;
  }
}

/** Run all pending migrations up to SCHEMA_VERSION. */
export function runMigrations(db: AlmaDB): void {
  const current = getCurrentVersion(db);
  if (current >= SCHEMA_VERSION) return;

  for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
    const sql = MIGRATIONS[v];
    if (!sql) throw new Error(`Missing migration for version ${v}`);

    db.transaction(() => {
      db.exec(sql);
      // schema_meta may not exist until migration 3; use direct exec for v<3
      if (v >= 3) {
        db.prepare(
          `INSERT INTO schema_meta(key, value) VALUES('schema_version', ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        ).run(String(v));
      }
    })();
  }
}
