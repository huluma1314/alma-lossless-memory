// Public API surface
export { openDatabase, closeDatabase } from './db/database';
export type { AlmaDB } from './db/database';

export {
  insertMemory,
  getMemoryById,
  getMemoriesBySession,
  searchMemories,
  deleteMemory,
  updateImportance,
  addTag,
  getSessionIds,
} from './memory/store';

export { estimateTokens } from './memory/tokenizer';

export {
  buildDagForSession,
  getSummariesForSession,
  getRootSummaries,
  CHUNK_TOKEN_LIMIT,
} from './dag/summarizer';

export { assembleContext } from './context/assembler';

export { loadConfig } from './config';
export type { AlmaConfig } from './config';

export type {
  Memory,
  InsertMemoryInput,
  SearchOptions,
  SearchResult,
  Summary,
  ContextAssemblyOptions,
  AssembledContext,
  Role,
} from './memory/types';
