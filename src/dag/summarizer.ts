import { randomUUID } from 'crypto';
import type { AlmaDB } from '../db/database';
import type { Summary } from '../memory/types';
import { estimateTokens } from '../memory/tokenizer';
import { getMemoriesBySession } from '../memory/store';

export const CHUNK_TOKEN_LIMIT = 800;

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------
function rowToSummary(row: Record<string, unknown>): Summary {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    level: row.level as number,
    content: row.content as string,
    tokens: row.tokens as number,
    created_at: row.created_at as string,
  };
}

function insertSummaryNode(
  db: AlmaDB,
  session_id: string,
  level: number,
  content: string,
  children: Array<{ id: string; type: 'memory' | 'summary' }>,
): Summary {
  const id = randomUUID();
  const tokens = estimateTokens(content);
  db.transaction(() => {
    db.prepare(
      'INSERT INTO summaries (id, level, content, tokens, session_id) VALUES (?,?,?,?,?)',
    ).run(id, level, content, tokens, session_id);
    for (const c of children) {
      db.prepare(
        'INSERT OR IGNORE INTO dag_edges (parent_id, child_id, child_type) VALUES (?,?,?)',
      ).run(id, c.id, c.type);
    }
  })();
  return rowToSummary(
    db.prepare('SELECT * FROM summaries WHERE id = ?').get(id) as Record<string, unknown>,
  );
}

function naiveSummarize(items: string[]): string {
  const joined = items.join(' | ');
  return joined.length <= 600 ? joined : joined.slice(0, 597) + '...';
}

// ---------------------------------------------------------------------------
// Checkpoint helpers
// ---------------------------------------------------------------------------
function getCheckpointRow(db: AlmaDB, session_id: string): number {
  const row = db
    .prepare('SELECT last_summarized_row FROM summarize_checkpoints WHERE session_id = ?')
    .get(session_id) as { last_summarized_row: number } | undefined;
  return row?.last_summarized_row ?? 0;
}

function upsertCheckpoint(db: AlmaDB, session_id: string, lastRow: number): void {
  db.prepare(`
    INSERT INTO summarize_checkpoints (session_id, last_summarized_row, updated_at)
    VALUES (?, ?, datetime('now','utc'))
    ON CONFLICT(session_id) DO UPDATE
      SET last_summarized_row = excluded.last_summarized_row,
          updated_at = excluded.updated_at
  `).run(session_id, lastRow);
}

// ---------------------------------------------------------------------------
// DAG builder  (incremental — only processes new memories since checkpoint)
// ---------------------------------------------------------------------------
export function buildDagForSession(db: AlmaDB, session_id: string): Summary[] {
  const allMemories = getMemoriesBySession(db, session_id);
  if (allMemories.length === 0) return [];

  // Incremental: skip memories whose rowid <= last checkpoint
  const lastRow = getCheckpointRow(db, session_id);
  const newMemories = allMemories.filter((_m, idx) => idx >= lastRow);
  if (newMemories.length === 0) {
    // Nothing new — return existing roots (idempotent)
    return getRootSummaries(db, session_id);
  }

  // Chunk new memories by token budget
  const chunks: Array<Array<{ id: string; content: string; tokens: number }>> = [];
  let cur: Array<{ id: string; content: string; tokens: number }> = [];
  let curTok = 0;
  for (const m of newMemories) {
    if (curTok + m.tokens > CHUNK_TOKEN_LIMIT && cur.length > 0) {
      chunks.push(cur);
      cur = [];
      curTok = 0;
    }
    cur.push({ id: m.id, content: m.content, tokens: m.tokens });
    curTok += m.tokens;
  }
  if (cur.length > 0) chunks.push(cur);

  // Build leaf summaries for new chunks
  let levelNodes: Summary[] = chunks.map((chunk) =>
    insertSummaryNode(
      db,
      session_id,
      0,
      naiveSummarize(chunk.map((c) => c.content)),
      chunk.map((c) => ({ id: c.id, type: 'memory' as const })),
    ),
  );

  // Merge up the DAG
  let level = 1;
  while (levelNodes.length > 1) {
    const nextNodes: Summary[] = [];
    for (let i = 0; i < levelNodes.length; i += 4) {
      const group = levelNodes.slice(i, i + 4);
      if (group.length === 1) {
        nextNodes.push(group[0]);
        continue;
      }
      nextNodes.push(
        insertSummaryNode(
          db,
          session_id,
          level,
          naiveSummarize(group.map((s) => s.content)),
          group.map((s) => ({ id: s.id, type: 'summary' as const })),
        ),
      );
    }
    levelNodes = nextNodes;
    level++;
  }

  // Persist checkpoint — index of last processed memory
  upsertCheckpoint(db, session_id, allMemories.length);

  return getRootSummaries(db, session_id);
}

export function getSummariesForSession(db: AlmaDB, session_id: string): Summary[] {
  const rows = db
    .prepare('SELECT * FROM summaries WHERE session_id = ? ORDER BY level ASC, created_at ASC')
    .all(session_id) as Record<string, unknown>[];
  return rows.map(rowToSummary);
}

export function getRootSummaries(db: AlmaDB, session_id: string): Summary[] {
  // Root = summaries not referenced as children of another summary
  const rows = db
    .prepare(`
      SELECT s.* FROM summaries s
      WHERE s.session_id = ?
        AND s.id NOT IN (SELECT child_id FROM dag_edges WHERE child_type = 'summary')
      ORDER BY s.level DESC, s.created_at ASC
    `)
    .all(session_id) as Record<string, unknown>[];
  return rows.map(rowToSummary);
}
