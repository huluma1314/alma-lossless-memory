/**
 * Config system: JSON file loaded via --config <path>.
 * All fields are optional; CLI flags override config file values.
 */
import fs from 'fs';
import path from 'path';

export interface AlmaConfig {
  /** Path to the SQLite database file */
  dbPath?: string;
  /** How many recent raw messages to keep outside summaries */
  keepRecentRaw?: number;
  /** Max tokens per leaf summary chunk */
  leafChunkSize?: number;
  /** How many leaf summaries to merge into one parent node */
  fanIn?: number;
  /** Default token budget for context assembly */
  tokenBudget?: number;
  /** Default retrieval limit for FTS search */
  retrievalLimit?: number;
}

export const DEFAULT_CONFIG: Required<AlmaConfig> = {
  dbPath: process.env.ALMA_DB ?? './alma.db',
  keepRecentRaw: 20,
  leafChunkSize: 800,
  fanIn: 4,
  tokenBudget: 4000,
  retrievalLimit: 30,
};

/**
 * Load config from a JSON file, merging with defaults.
 * Missing keys fall back to DEFAULT_CONFIG.
 */
export function loadConfig(configPath?: string): Required<AlmaConfig> {
  if (!configPath) return { ...DEFAULT_CONFIG };

  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as AlmaConfig;
  return { ...DEFAULT_CONFIG, ...raw };
}
