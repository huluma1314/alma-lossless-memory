/**
 * Lightweight token estimator — no external deps.
 * Uses character-based heuristic: ~4 chars per token (GPT-family average).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
