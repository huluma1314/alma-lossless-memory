
import { estimateTokens } from '../src/memory/tokenizer.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns positive number for normal text', () => {
    expect(estimateTokens('hello world')).toBeGreaterThan(0);
  });

  it('longer text has more tokens', () => {
    const short = estimateTokens('hi');
    const long = estimateTokens('hello world this is a longer piece of text');
    expect(long).toBeGreaterThan(short);
  });

  it('approximates GPT token count within 2x', () => {
    // ~14 words => roughly 18-20 tokens by GPT-4 counting
    const tokens = estimateTokens(
      'The quick brown fox jumps over the lazy dog near the river bank'
    );
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(50);
  });
});
