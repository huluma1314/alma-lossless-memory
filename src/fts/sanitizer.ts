/**
 * FTS5 query sanitizer.
 *
 * FTS5 has a rich query syntax (AND, OR, NOT, phrases, column filters, ^prefix,
 * NEAR/n). This sanitizer strips characters that would cause parse errors when
 * doing a simple keyword search, while preserving intent.
 */

/** Characters that are special in FTS5 and need escaping/removal */
const FTS5_SPECIAL = /["'()\[\]{}*^<>=!\\;:,|&]/g;

/**
 * Sanitize a raw user string for safe use in an FTS5 MATCH expression.
 *
 * Strategy:
 *  1. Remove null bytes.
 *  2. Strip FTS5 operator characters.
 *  3. Collapse whitespace.
 *  4. Trim.
 *  5. Append * to each token for prefix matching.
 */
export function sanitizeFts(raw: string): string {
  const cleaned = raw
    .replace(/\0/g, '')
    .replace(FTS5_SPECIAL, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  // Prefix-match each token
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((t) => `${t}*`)
    .join(' ');
}
