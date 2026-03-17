import type { AlmaDB } from '../db/database';
import type {
  AssembledContext,
  ContextAssemblyOptions,
  Memory,
} from '../memory/types';
import { getMemoriesBySession, searchMemories } from '../memory/store';
import { getRootSummaries } from '../dag/summarizer';

const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_RETRIEVAL_LIMIT = 30;

export function assembleContext(
  db: AlmaDB,
  opts: ContextAssemblyOptions,
): AssembledContext {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const retrievalLimit = opts.retrievalLimit ?? DEFAULT_RETRIEVAL_LIMIT;
  let budget = maxTokens;

  const messages: Array<{ role: Memory['role'] | 'system'; content: string }> = [];
  let memoriesUsed = 0;
  let summariesUsed = 0;
  let tokensUsedBySummaries = 0;
  let tokensUsedByRelevant = 0;
  let tokensUsedByRecent = 0;

  // --- 1. Root summaries (compressed history) ---------------------------------
  const roots = getRootSummaries(db, opts.session_id);
  // Track which memory IDs are already covered by summaries (via dag_edges)
  const coveredBySum = new Set<string>();
  for (const s of roots) {
    if (budget - s.tokens < 0) break;
    messages.push({ role: 'system', content: `[Summary] ${s.content}` });
    budget -= s.tokens;
    tokensUsedBySummaries += s.tokens;
    summariesUsed++;

    // Collect memory IDs covered under this summary node (recursive via dag)
    collectCoveredMemories(db, s.id, coveredBySum);
  }

  // --- 2. Relevant memories via FTS (query boost) ----------------------------
  const relevantIds = new Set<string>();
  if (opts.query) {
    const results = searchMemories(db, {
      query: opts.query,
      session_id: opts.session_id,
      limit: retrievalLimit,
    });
    for (const r of results) {
      const m = r.memory;
      // Skip if already covered by a summary span
      if (coveredBySum.has(m.id)) continue;
      if (relevantIds.has(m.id)) continue;
      if (budget - m.tokens < 0) break;
      messages.push({ role: m.role, content: m.content });
      budget -= m.tokens;
      tokensUsedByRelevant += m.tokens;
      relevantIds.add(m.id);
      memoriesUsed++;
    }
  }

  // --- 3. Fill remaining budget with recent chronological memories -----------
  const recent = getMemoriesBySession(db, opts.session_id, 200);
  // Walk newest-first to prefer most recent
  for (const m of recent.slice().reverse()) {
    if (coveredBySum.has(m.id)) continue;
    if (relevantIds.has(m.id)) continue;
    if (budget - m.tokens < 0) continue;
    messages.push({ role: m.role, content: m.content });
    budget -= m.tokens;
    tokensUsedByRecent += m.tokens;
    relevantIds.add(m.id);
    memoriesUsed++;
  }

  // Sort: system summaries first, then other messages in insertion order
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const otherMsgs = messages.filter((m) => m.role !== 'system');

  const result: AssembledContext = {
    messages: [...systemMsgs, ...otherMsgs],
    totalTokens: maxTokens - budget,
    memoriesUsed,
    summariesUsed,
  };

  if (opts.debug) {
    result.debugInfo = {
      tokenBudget: maxTokens,
      tokensUsedBySummaries,
      tokensUsedByRelevant,
      tokensUsedByRecent,
      tokensRemaining: budget,
    };
  }

  return result;
}

/**
 * Recursively collect all memory IDs that are descendants of a summary node.
 * This prevents the assembler from including memories already covered by summaries.
 */
function collectCoveredMemories(
  db: AlmaDB,
  summaryId: string,
  out: Set<string>,
): void {
  const edges = db
    .prepare('SELECT child_id, child_type FROM dag_edges WHERE parent_id = ?')
    .all(summaryId) as { child_id: string; child_type: string }[];

  for (const edge of edges) {
    if (edge.child_type === 'memory') {
      out.add(edge.child_id);
    } else {
      collectCoveredMemories(db, edge.child_id, out);
    }
  }
}
