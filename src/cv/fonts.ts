import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from '../node/paths.js';

/**
 * The résumé's fonts, **embedded in the document**.
 *
 * A CI machine has neither Fraunces nor Instrument Sans installed: without
 * embedding, Chromium would fall back to a system font and the PDF would stop
 * looking like the website. The subsets are therefore versioned in the repo
 * (168 KB in total, OFL licence alongside) and injected as `data:` — the
 * rendering depends on no network and yields the same byte everywhere.
 */
interface FontSubset {
  readonly family: string;
  readonly file: string;
  /** The code points this subset covers, exactly as Google slices them. */
  readonly unicodeRange: string;
}

const DISPLAY_FAMILY = 'Fraunces';
const TEXT_FAMILY = 'Instrument Sans';

/** Basic Latin and Latin-1 Supplement — most of what French needs. */
const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, ' +
  'U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

/** Latin Extended — rare diacritics and currency symbols. */
const LATIN_EXT_RANGE =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, ' +
  'U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, ' +
  'U+2C60-2C7F, U+A720-A7FF';

/**
 * The rightwards arrow. It is in neither Latin subset, and the content uses it
 * ("Objective-C → Swift"). So it is embedded separately, on the text font —
 * the only one of the two Google serves as a made-to-measure subset.
 *
 * The template puts the text font as the display font's fallback: inside a PDF
 * no system font exists, so a character missing from Fraunces must fall back
 * to an **embedded** font, never to a generic one. That is what makes the
 * coverage below true anywhere in the document.
 */
const ARROWS_RANGE = 'U+2192';

const SUBSETS: readonly FontSubset[] = [
  { family: DISPLAY_FAMILY, file: 'fraunces-latin.woff2', unicodeRange: LATIN_RANGE },
  { family: DISPLAY_FAMILY, file: 'fraunces-latin-ext.woff2', unicodeRange: LATIN_EXT_RANGE },
  { family: TEXT_FAMILY, file: 'instrument-sans-latin.woff2', unicodeRange: LATIN_RANGE },
  {
    family: TEXT_FAMILY,
    file: 'instrument-sans-latin-ext.woff2',
    unicodeRange: LATIN_EXT_RANGE,
  },
  { family: TEXT_FAMILY, file: 'instrument-sans-arrows.woff2', unicodeRange: ARROWS_RANGE },
];

const WEIGHT_RANGE = { [DISPLAY_FAMILY]: '400 900', [TEXT_FAMILY]: '400 700' } as const;

/** The template's `@font-face` rules, font bytes included. */
export function embeddedFontFaces(directory: string = PATHS.fonts): string {
  return SUBSETS.map((subset) => {
    const data = readFileSync(join(directory, subset.file)).toString('base64');
    const weights = WEIGHT_RANGE[subset.family as keyof typeof WEIGHT_RANGE];
    return [
      '@font-face {',
      `  font-family: "${subset.family}";`,
      '  font-style: normal;',
      `  font-weight: ${weights};`,
      '  font-display: block;',
      `  src: url(data:font/woff2;base64,${data}) format("woff2");`,
      `  unicode-range: ${subset.unicodeRange};`,
      '}',
    ].join('\n');
  }).join('\n');
}

/**
 * The set of code points the embedded fonts cover.
 *
 * It exists for one reason: an uncovered character renders as an empty box in
 * the PDF, and a résumé with an empty box in it is a résumé thrown away. The
 * guard (`assertCharactersAreCovered`) turns that into a build failure.
 */
export function coveredCodePoints(): ReadonlySet<number> {
  const covered = new Set<number>();
  for (const range of [LATIN_RANGE, LATIN_EXT_RANGE, ARROWS_RANGE]) {
    for (const part of range.split(',')) {
      const [start, end] = parseUnicodeRange(part.trim());
      for (let code = start; code <= end; code += 1) covered.add(code);
    }
  }
  return covered;
}

/** The hexadecimal code points of a `unicode-range`. */
const HEX_RADIX = 16;

/** The first printable character: below it, nothing is drawn. */
const FIRST_PRINTABLE_CODE_POINT = 0x20;

/** "U+00E9": four digits, the way the spec writes them. */
const CODE_POINT_DIGITS = 4;

function parseUnicodeRange(token: string): [number, number] {
  const body = token.replace(/^U\+/i, '');
  const [from, to] = body.split('-');
  const start = Number.parseInt(from ?? '', HEX_RADIX);
  if (Number.isNaN(start)) {
    throw new Error(`Unreadable Unicode range: ${JSON.stringify(token)}`);
  }
  const end = to === undefined ? start : Number.parseInt(to, HEX_RADIX);
  return [start, end];
}

/**
 * Refuses to render if a character in the résumé falls outside the fonts'
 * coverage.
 *
 * Line breaks and layout whitespace are ignored: they are not drawn.
 */
export function assertCharactersAreCovered(text: string): void {
  const covered = coveredCodePoints();
  const missing = new Set<string>();
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code === undefined || code < FIRST_PRINTABLE_CODE_POINT) continue;
    if (!covered.has(code)) missing.add(character);
  }
  if (missing.size > 0) {
    const listed = [...missing]
      .map(
        (char) =>
          `${char} (U+${char.codePointAt(0)?.toString(HEX_RADIX).toUpperCase().padStart(CODE_POINT_DIGITS, '0') ?? '?'})`,
      )
      .join(', ');
    throw new Error(
      `The résumé uses characters the embedded fonts do not cover: ${listed}. ` +
        `They would render as an empty box in the PDF.`,
    );
  }
}
