import { MarkupError } from './errors.js';
import type { RichText, Span, SpanStyle } from './rich-text.js';

/**
 * Grammaire d'emphase inline du contenu.
 *
 * Le contenu porte de l'emphase — la page de référence met en gras le **fait**
 * dans chaque phrase, et en `code` les noms d'API. Trois façons de la
 * transporter existaient :
 *
 * 1. du HTML dans le JSON — injecté tel quel par les clients, donc une surface
 *    d'injection et un couplage du contenu au web ; l'app iOS n'en fait rien ;
 * 2. des spans structurés écrits à la main dans les fichiers — illisibles à
 *    écrire et à relire pour ~200 phrases ;
 * 3. un balisage minimal à l'écriture, **converti en spans structurés** au
 *    chargement.
 *
 * C'est la troisième : on écrit `**gras**` et `` `code` ``, l'API sert des
 * spans. Un seul analyseur existe, ici ; aucun client n'en réécrit un, et
 * aucun client ne reçoit de HTML.
 */

const STRONG_DELIMITER = '**';
const CODE_DELIMITER = '`';

interface DelimiterRule {
  readonly delimiter: string;
  readonly style: Exclude<SpanStyle, 'plain'>;
}

/** `String.indexOf` quand il ne trouve rien. */
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
 * Convertit une source balisée en spans. Lève `MarkupError` sur un délimiteur
 * non fermé ou une emphase vide : un balisage cassé est une faute de contenu,
 * pas un texte à rendre tel quel.
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
      throw new MarkupError(source, `délimiteur « ${rule.delimiter} » jamais fermé`);
    }

    const emphasised = source.slice(contentStart, closing);
    if (emphasised.length === 0) {
      throw new MarkupError(source, `emphase vide « ${rule.delimiter}${rule.delimiter} »`);
    }
    if (nextOpening(emphasised, 0) !== null) {
      throw new MarkupError(source, 'emphases imbriquées');
    }

    push(spans, source.slice(cursor, at), 'plain');
    push(spans, emphasised, rule.style);
    cursor = closing + rule.delimiter.length;
  }

  push(spans, source.slice(cursor), 'plain');

  if (spans.length === 0) {
    throw new MarkupError(source, 'texte vide');
  }
  return spans;
}

/** Vrai si la source respecte la grammaire — utilisé par le schéma. */
export function isValidMarkup(source: string): boolean {
  try {
    parseMarkup(source);
    return true;
  } catch (error) {
    if (error instanceof MarkupError) return false;
    throw error;
  }
}

/** Le texte nu d'un contenu balisé, emphases retirées. */
export function plainText(rich: RichText): string {
  return rich.map((span) => span.text).join('');
}
