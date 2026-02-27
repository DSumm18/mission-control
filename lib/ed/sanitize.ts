/**
 * PII redaction for Ed chat messages.
 * Strips common PII patterns before storing or sending to LLMs.
 */

const PATTERNS: { regex: RegExp; replacement: string }[] = [
  // UK phone numbers
  { regex: /(\+44|0)\s?\d{4}\s?\d{6}/g, replacement: '[PHONE]' },
  // Email addresses
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  // National Insurance numbers
  { regex: /[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]/gi, replacement: '[NINO]' },
  // UK postcodes
  { regex: /[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/gi, replacement: '[POSTCODE]' },
  // Credit card numbers (basic)
  { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CARD]' },
  // Sort codes
  { regex: /\b\d{2}-\d{2}-\d{2}\b/g, replacement: '[SORTCODE]' },
  // UK bank account numbers (8 digits standalone)
  { regex: /\b\d{8}\b/g, replacement: '[ACCOUNT]' },
];

/**
 * Redact PII from text. Returns sanitized text.
 * Only applied when explicitly called — David's own messages are trusted.
 */
export function sanitizePII(text: string): string {
  let result = text;
  for (const { regex, replacement } of PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Check if text likely contains PII.
 */
export function containsPII(text: string): boolean {
  return PATTERNS.some(({ regex }) => {
    regex.lastIndex = 0;
    return regex.test(text);
  });
}
