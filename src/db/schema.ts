/**
 * Database schema definitions and SQL statements.
 * All schema changes go through the migrations system.
 */

export const SCHEMA_VERSION = 4;

/** Migration SQL indexed by version number (applied sequentially) */
export const MIGRATIONS: Record<number, string> = {
  1: `
    -- Core memories table
    -- rowid is the INTEGER PK used by FTS5; id is the TEXT UUID
    CREATE TABLE IF NOT EXISTS memories (
      rowid       INTEGER PRIMARY KEY AUTOINCREMENT,
      id          TEXT    NOT NULL UNIQUE,
      session_id  TEXT    NOT NULL DEFAULT 'default',
      role        TEXT    NOT NULL CHECK(role IN ('system','user','assistant','tool')),
      content     TEXT    NOT NULL,
      tokens      INTEGER NOT NULL DEFAULT 0,
      importance  REAL    NOT NULL DEFAULT 0.5,
      metadata    TEXT    NOT NULL DEFAULT '{}',
      tags        TEXT    NOT NULL DEFAULT '[]',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','utc'))
    );

    CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_id ON memories(id);

    -- FTS5 virtual table mirroring memory content
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      role,
      session_id,
      content='memories',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, role, session_id)
        VALUES (new.rowid, new.content, new.role, new.session_id);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, role, session_id)
        VALUES ('delete', old.rowid, old.content, old.role, old.session_id);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, role, session_id)
        VALUES ('delete', old.rowid, old.content, old.role, old.session_id);
      INSERT INTO memories_fts(rowid, content, role, session_id)
        VALUES (new.rowid, new.content, new.role, new.session_id);
    END;
  `,

  2: `
    -- DAG summary nodes
    CREATE TABLE IF NOT EXISTS summaries (
      id           TEXT    PRIMARY KEY,
      session_id   TEXT    NOT NULL DEFAULT 'default',
      level        INTEGER NOT NULL DEFAULT 0,
      content      TEXT    NOT NULL,
      tokens       INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now','utc'))
    );

    CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_id, level, created_at);

    -- DAG edges between summaries and their children
    CREATE TABLE IF NOT EXISTS dag_edges (
      parent_id  TEXT NOT NULL,
      child_id   TEXT NOT NULL,
      child_type TEXT NOT NULL CHECK(child_type IN ('memory','summary')),
      PRIMARY KEY (parent_id, child_id)
    );

    CREATE INDEX IF NOT EXISTS idx_dag_edges_child ON dag_edges(child_id, child_type);
  `,

  3: `
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `,

  4: `
    -- Per-session summarization checkpoint for incremental summarize
    CREATE TABLE IF NOT EXISTS summarize_checkpoints (
      session_id             TEXT PRIMARY KEY,
      last_summarized_row    INTEGER NOT NULL DEFAULT 0,
      updated_at             TEXT    NOT NULL DEFAULT (datetime('now','utc'))
    );
  `,
};
