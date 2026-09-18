import { MarkupError } from './errors.js';
import type { RichText, Span, SpanStyle } from './rich-text.js';

/**
 * The content's inline emphasis grammar.
 *
 * The content carries emphasis — the reference page bolds the **fact** in each
 * sentence and puts API names in `code`. There were three ways to transport it:
 *
 * 1. HTML inside the JSON — injected as-is by clients, so an injection surface
 *    and a coupling of the content to the web; the iOS app has no use for it;
 * 2. structured spans written by hand in the files — unreadable to write and
 *    to review across ~200 sentences;
 * 3. minimal markup at authoring time, **converted into structured spans** at
 *    load time.
 *
 * It is the third: you write `**bold**` and `` `code` ``, the API serves
 * spans. One parser exists, here; no client rewrites one, and no client is
 * ever handed HTML.
 */

const STRONG_DELIMITER = '**';
const CODE_DELIMITER = '`';

interface DelimiterRule {
  readonly delimiter: string;
  readonly style: Exclude<SpanStyle, 'plain'>;
}

/** What `String.indexOf` returns when it finds nothing. */
const NOT_FOUND = -1;

const RULES: readonly DelimiterRule[] = [
  { delimiter: STRONG_DELIMITER, style: 'strong' },
  { delimiter: CODE_DELIMITER, style: 'code' },
];

function nextOpening(source: string, from: number): { rule: DelimiterRule; at: number } | null {
  let best: { rule: DelimiterRule; at: number } | null = null;
  for (const rule of RULES) {
    const at = source.indexOf(rule.delimiter, from);
    if (at === NOT_FOUND) continue;
    if (best === null || at < best.at) best = { rule, at };
  }
  return best;
}

function push(spans: Span[], text: string, style: SpanStyle): void {
  if (text.length === 0) return;
  spans.push({ text, style });
}

/**
 * Turns a marked-up source into spans. Throws `MarkupError` on an unclosed
 * delimiter or an empty emphasis: broken markup is a content defect, not a
 * text to render as-is.
 */
export function parseMarkup(source: string): RichText {
  const spans: Span[] = [];
  let cursor = 0;

  for (;;) {
    const opening = nextOpening(source, cursor);
    if (opening === null) break;

    const { rule, at } = opening;
    const contentStart = at + rule.delimiter.length;
    const closing = source.indexOf(rule.delimiter, contentStart);
    if (closing === NOT_FOUND) {
      throw new MarkupError(source, `delimiter "${rule.delimiter}" never closed`);
    }

    const emphasised = source.slice(contentStart, closing);
    if (emphasised.length === 0) {
      throw new MarkupError(source, `empty emphasis "${rule.delimiter}${rule.delimiter}"`);
    }
    if (nextOpening(emphasised, 0) !== null) {
      throw new MarkupError(source, 'nested emphasis');
    }

    push(spans, source.slice(cursor, at), 'plain');
    push(spans, emphasised, rule.style);
    cursor = closing + rule.delimiter.length;
  }

  push(spans, source.slice(cursor), 'plain');

  if (spans.length === 0) {
    throw new MarkupError(source, 'empty text');
  }
  return spans;
}

/** True when the source obeys the grammar — used by the schema. */
export function isValidMarkup(source: string): boolean {
  try {
    parseMarkup(source);
    return true;
  } catch (error) {
    if (error instanceof MarkupError) return false;
    throw error;
  }
}

/** The bare text of marked-up content, emphasis stripped. */
export function plainText(rich: RichText): string {
  return rich.map((span) => span.text).join('');
}
