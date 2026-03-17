
import { openDatabase, closeDatabase } from '../src/db/database.js';
import {
  insertMemory,
  getMemoryById,
  getMemoriesBySession,
  searchMemories,
  deleteMemory,
  updateImportance,
  addTag,
  getSessionIds,
} from '../src/memory/store.js';
import type { AlmaDB } from '../src/db/database.js';

let db: AlmaDB;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  closeDatabase(db);
});

describe('insertMemory', () => {
  it('inserts and returns a memory', () => {
    const m = insertMemory(db, { session_id: 's1', role: 'user', content: 'hello world' });
    expect(m.id).toBeTruthy();
    expect(m.session_id).toBe('s1');
    expect(m.role).toBe('user');
    expect(m.content).toBe('hello world');
    expect(m.tokens).toBeGreaterThan(0);
    expect(m.importance).toBe(0.5);
  });

  it('respects custom importance', () => {
    const m = insertMemory(db, { session_id: 's1', role: 'assistant', content: 'hi', importance: 0.9 });
    expect(m.importance).toBe(0.9);
  });

  it('stores metadata as object', () => {
    const m = insertMemory(db, {
      session_id: 's1', role: 'system', content: 'ctx',
      metadata: { source: 'test' },
    });
    expect(m.metadata).toEqual({ source: 'test' });
  });
});

describe('getMemoryById', () => {
  it('returns null for unknown id', () => {
    expect(getMemoryById(db, 'nonexistent')).toBeNull();
  });

  it('retrieves inserted memory', () => {
    const m = insertMemory(db, { session_id: 's1', role: 'user', content: 'lookup test' });
    const found = getMemoryById(db, m.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(m.id);
  });
});

describe('getMemoriesBySession', () => {
  it('returns empty array for unknown session', () => {
    expect(getMemoriesBySession(db, 'no-such-session')).toEqual([]);
  });

  it('returns only memories for requested session', () => {
    insertMemory(db, { session_id: 'A', role: 'user', content: 'msg A1' });
    insertMemory(db, { session_id: 'A', role: 'assistant', content: 'msg A2' });
    insertMemory(db, { session_id: 'B', role: 'user', content: 'msg B1' });
    const mems = getMemoriesBySession(db, 'A');
    expect(mems).toHaveLength(2);
    expect(mems.every((m) => m.session_id === 'A')).toBe(true);
  });

  it('respects limit', () => {
    for (let i = 0; i < 10; i++) {
      insertMemory(db, { session_id: 'S', role: 'user', content: `msg ${i}` });
    }
    expect(getMemoriesBySession(db, 'S', 3)).toHaveLength(3);
  });
});

describe('searchMemories', () => {
  it('finds memories by keyword', () => {
    insertMemory(db, { session_id: 's1', role: 'user', content: 'TypeScript is great' });
    insertMemory(db, { session_id: 's1', role: 'user', content: 'Python is also good' });
    const results = searchMemories(db, { query: 'TypeScript', session_id: 's1' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].memory.content).toContain('TypeScript');
  });

  it('returns score and snippet', () => {
    insertMemory(db, { session_id: 's1', role: 'user', content: 'SQLite FTS5 is powerful' });
    const results = searchMemories(db, { query: 'SQLite', session_id: 's1' });
    expect(results[0].score).toBeDefined();
    expect(results[0].snippet).toBeDefined();
  });

  it('returns empty for no match', () => {
    insertMemory(db, { session_id: 's1', role: 'user', content: 'nothing relevant' });
    const results = searchMemories(db, { query: 'xyzzy12345', session_id: 's1' });
    expect(results).toHaveLength(0);
  });
});

describe('deleteMemory', () => {
  it('returns false for unknown id', () => {
    expect(deleteMemory(db, 'fake')).toBe(false);
  });

  it('deletes an existing memory', () => {
    const m = insertMemory(db, { session_id: 's1', role: 'user', content: 'to delete' });
    expect(deleteMemory(db, m.id)).toBe(true);
    expect(getMemoryById(db, m.id)).toBeNull();
  });
});

describe('updateImportance', () => {
  it('updates importance value', () => {
    const m = insertMemory(db, { session_id: 's1', role: 'user', content: 'update me' });
    updateImportance(db, m.id, 0.99);
    const found = getMemoryById(db, m.id);
    expect(found!.importance).toBe(0.99);
  });
});

describe('addTag', () => {
  it('tags a memory without error', () => {
    const m = insertMemory(db, { session_id: 's1', role: 'user', content: 'tag me' });
    expect(() => addTag(db, m.id, 'memory', 'important')).not.toThrow();
  });

  it('deduplicates tags (INSERT OR IGNORE)', () => {
    const m = insertMemory(db, { session_id: 's1', role: 'user', content: 'dupe tag' });
    addTag(db, m.id, 'memory', 'dup');
    expect(() => addTag(db, m.id, 'memory', 'dup')).not.toThrow();
  });
});

describe('getSessionIds', () => {
  it('returns all unique session ids', () => {
    insertMemory(db, { session_id: 'alpha', role: 'user', content: 'a' });
    insertMemory(db, { session_id: 'beta', role: 'user', content: 'b' });
    insertMemory(db, { session_id: 'alpha', role: 'assistant', content: 'c' });
    const ids = getSessionIds(db);
    expect(ids).toContain('alpha');
    expect(ids).toContain('beta');
    expect(new Set(ids).size).toBe(ids.length);
  });
});
