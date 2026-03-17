
import { openDatabase, closeDatabase } from '../src/db/database.js';
import { insertMemory } from '../src/memory/store.js';
import {
  buildDagForSession,
  getSummariesForSession,
  getRootSummaries,
} from '../src/dag/summarizer.js';
import type { AlmaDB } from '../src/db/database.js';

let db: AlmaDB;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  closeDatabase(db);
});

describe('buildDagForSession', () => {
  it('returns empty array for session with no memories', () => {
    const roots = buildDagForSession(db, 'empty-session');
    expect(roots).toHaveLength(0);
  });

  it('creates at least one summary for a session with memories', () => {
    for (let i = 0; i < 5; i++) {
      insertMemory(db, { session_id: 'S', role: 'user', content: `Message number ${i} with some content` });
    }
    const roots = buildDagForSession(db, 'S');
    expect(roots.length).toBeGreaterThan(0);
  });

  it('produces a single root for small sessions', () => {
    for (let i = 0; i < 3; i++) {
      insertMemory(db, { session_id: 'T', role: 'user', content: `Short msg ${i}` });
    }
    const roots = buildDagForSession(db, 'T');
    expect(roots).toHaveLength(1);
  });

  it('summaries are stored in the db', () => {
    for (let i = 0; i < 4; i++) {
      insertMemory(db, { session_id: 'U', role: 'assistant', content: `Reply ${i} about topic` });
    }
    buildDagForSession(db, 'U');
    const summaries = getSummariesForSession(db, 'U');
    expect(summaries.length).toBeGreaterThan(0);
  });
});

describe('getRootSummaries', () => {
  it('returns empty for session with no summaries', () => {
    expect(getRootSummaries(db, 'nosummaries')).toHaveLength(0);
  });

  it('returns roots after building dag', () => {
    for (let i = 0; i < 5; i++) {
      insertMemory(db, { session_id: 'R', role: 'user', content: `Root test message ${i}` });
    }
    buildDagForSession(db, 'R');
    const roots = getRootSummaries(db, 'R');
    expect(roots.length).toBeGreaterThan(0);
    // All roots should have the highest level for this session
    const maxLevel = Math.max(...roots.map((r) => r.level));
    expect(roots.every((r) => r.level === maxLevel)).toBe(true);
  });
});
