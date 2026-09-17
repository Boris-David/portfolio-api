import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from '../config.js';

/**
 * Les polices du CV, **embarquées dans le document**.
 *
 * Un conteneur de rendu n'a pas Fraunces ni Instrument Sans installées : sans
 * embarquement, Chromium retomberait sur une police système et le PDF ne
 * ressemblerait plus au site. Les sous-ensembles sont donc versionnés dans le
 * dépôt (168 Ko au total, licence OFL à côté) et injectés en `data:` — le
 * rendu ne dépend d'aucun réseau et donne le même octet partout.
 */
interface FontSubset {
  readonly family: string;
  readonly file: string;
  /** Les points de code que ce sous-ensemble couvre, tels que Google les découpe. */
  readonly unicodeRange: string;
}

const DISPLAY_FAMILY = 'Fraunces';
const TEXT_FAMILY = 'Instrument Sans';

/** Latin de base et supplément Latin-1 — l'essentiel du français. */
const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, ' +
  'U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

/** Latin étendu — diacritiques rares et symboles monétaires. */
const LATIN_EXT_RANGE =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, ' +
  'U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, ' +
  'U+2C60-2C7F, U+A720-A7FF';

/**
 * La flèche droite. Elle n'est dans aucun des deux sous-ensembles latins, et
 * le contenu l'emploie (« Objective-C → Swift »). Elle est donc embarquée à
 * part, sur la police de texte — la seule des deux que Google sert en
 * sous-ensemble sur mesure.
 *
 * Le gabarit met la police de texte en repli de la police d'affichage : dans
 * un PDF il n'existe aucune police système, donc un caractère absent de
 * Fraunces doit retomber sur une police **embarquée**, jamais sur un
 * générique. C'est ce qui rend la couverture ci-dessous vraie quel que soit
 * l'endroit du document.
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

/** Les `@font-face` du gabarit, polices incluses. */
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
 * L'ensemble des points de code couverts par les polices embarquées.
 *
 * Il existe pour une seule raison : un caractère non couvert se rend en carré
 * vide dans le PDF, et un CV avec un carré vide est un CV grillé. La garde
 * (`assertCharactersAreCovered`) le transforme en échec de build.
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

/** Les points de code hexadécimaux d'une plage `unicode-range`. */
const HEX_RADIX = 16;

/** Le premier caractère imprimable : en dessous, rien ne se dessine. */
const FIRST_PRINTABLE_CODE_POINT = 0x20;

/** « U+00E9 » : quatre chiffres, comme l'écrit la spécification. */
const CODE_POINT_DIGITS = 4;

function parseUnicodeRange(token: string): [number, number] {
  const body = token.replace(/^U\+/i, '');
  const [from, to] = body.split('-');
  const start = Number.parseInt(from ?? '', HEX_RADIX);
  if (Number.isNaN(start)) {
    throw new Error(`Plage Unicode illisible : ${JSON.stringify(token)}`);
  }
  const end = to === undefined ? start : Number.parseInt(to, HEX_RADIX);
  return [start, end];
}

/**
 * Refuse le rendu si un caractère du CV sort de la couverture des polices.
 *
 * Les retours à la ligne et les espaces d'agencement sont ignorés : ils ne se
 * dessinent pas.
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
      `Le CV emploie des caractères que les polices embarquées ne couvrent pas : ${listed}. ` +
        `Ils se rendraient en carré vide dans le PDF.`,
    );
  }
}
