
import { openDatabase, closeDatabase } from '../src/db/database.js';
import { insertMemory } from '../src/memory/store.js';
import { buildDagForSession } from '../src/dag/summarizer.js';
import { assembleContext } from '../src/context/assembler.js';
import type { AlmaDB } from '../src/db/database.js';

let db: AlmaDB;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  closeDatabase(db);
});

describe('assembleContext', () => {
  it('returns empty messages for empty session', () => {
    const ctx = assembleContext(db, { session_id: 'empty' });
    expect(ctx.messages).toHaveLength(0);
    expect(ctx.totalTokens).toBe(0);
  });

  it('includes recent memories', () => {
    insertMemory(db, { session_id: 'C', role: 'user', content: 'first message' });
    insertMemory(db, { session_id: 'C', role: 'assistant', content: 'first reply' });
    const ctx = assembleContext(db, { session_id: 'C', maxTokens: 2000 });
    expect(ctx.messages.length).toBeGreaterThan(0);
    expect(ctx.memoriesUsed).toBeGreaterThan(0);
  });

  it('respects token budget', () => {
    for (let i = 0; i < 50; i++) {
      insertMemory(db, {
        session_id: 'B',
        role: 'user',
        content: `This is message number ${i} with substantial content to fill tokens`,
      });
    }
    const ctx = assembleContext(db, { session_id: 'B', maxTokens: 200 });
    expect(ctx.totalTokens).toBeLessThanOrEqual(200);
  });

  it('uses summaries when available', () => {
    for (let i = 0; i < 6; i++) {
      insertMemory(db, { session_id: 'D', role: 'user', content: `Summary test message ${i}` });
    }
    buildDagForSession(db, 'D');
    const ctx = assembleContext(db, { session_id: 'D', maxTokens: 4000 });
    expect(ctx.summariesUsed).toBeGreaterThan(0);
  });

  it('FTS query boosts relevant memories', () => {
    insertMemory(db, { session_id: 'E', role: 'user', content: 'TypeScript generics are complex' });
    insertMemory(db, { session_id: 'E', role: 'user', content: 'Lunch was delicious today' });
    const ctx = assembleContext(db, {
      session_id: 'E',
      query: 'TypeScript generics',
      maxTokens: 4000,
    });
    const contents = ctx.messages.map((m) => m.content).join(' ');
    expect(contents).toContain('TypeScript');
  });
});
