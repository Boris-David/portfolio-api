import { z } from 'zod';
import { ContentValidationError } from '../domain/errors.js';
import { LOCALES, type Locale } from '../domain/locale.js';
import {
  PART_SCHEMAS,
  PORTFOLIO_PARTS,
  PortfolioSchema,
  type Portfolio,
  type PortfolioPart,
} from '../domain/portfolio.js';
import { deriveContentSchema } from './derive.js';
import { digest } from './digest.js';
import { CONTENT_DOCUMENTS, type ContentDocuments } from './documents.js';

/**
 * A part's file name and URL segment, derived from its name.
 *
 * A correspondence table would be a third place to keep in step with the
 * schema and the directory tree; a function cannot drift.
 */
export function kebabCase(part: string): string {
  return part.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function contentFileName(part: PortfolioPart): string {
  return `${kebabCase(part)}.json`;
}

/**
 * Strips the comment keys (`$comment`, `$note`…) before validation.
 *
 * A content file gets re-read; an author's comment belongs in it. But the
 * schema is strict — an unknown key is a typo — so `$…` keys are removed
 * explicitly, never tolerated by loosening the schema.
 */
export function stripAuthorComments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripAuthorComments);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('$'))
      .map(([key, entry]) => [key, stripAuthorComments(entry)]),
  );
}

export interface LoadedContent {
  /** Digest of all the content: the published version. */
  readonly version: string;
  readonly portfolio: Readonly<Record<Locale, Portfolio>>;
}

/**
 * Validates and projects the whole content — once, at isolate startup.
 *
 * No disk read: the documents are bundled at compile time. The content does
 * not change during an isolate's lifetime, so revalidating it on every request
 * would redo the same work for the same response.
 *
 * Any failure here is fatal, and that is deliberate — a half-wrong portfolio
 * is worse than an API that refuses to start.
 */
export function loadContent(documents: ContentDocuments = CONTENT_DOCUMENTS): LoadedContent {
  const portfolio = Object.fromEntries(
    LOCALES.map((locale) => [locale, buildPortfolio(documents, locale)]),
  ) as Record<Locale, Portfolio>;

  return { version: versionOf(documents), portfolio };
}

function buildPortfolio(documents: ContentDocuments, locale: Locale): Portfolio {
  const parts: Record<string, unknown> = {};
  for (const part of PORTFOLIO_PARTS) {
    parts[part] = projectPart(part, documents[part], locale);
  }

  // Second pass: the projected value must satisfy the domain schema itself.
  // This is what catches whatever the derivation does not reproduce, and what
  // turns a projection bug into a loud error at startup.
  const parsed = PortfolioSchema.safeParse(parts);
  if (!parsed.success) {
    throw new ContentValidationError(`${locale} projection`, z.prettifyError(parsed.error));
  }
  return parsed.data;
}

function projectPart(part: PortfolioPart, document: unknown, locale: Locale): unknown {
  const schema = deriveContentSchema(PART_SCHEMAS[part], locale);
  const result = schema.safeParse(stripAuthorComments(document));
  if (!result.success) {
    throw new ContentValidationError(
      `${contentFileName(part)} (${locale})`,
      z.prettifyError(result.error),
    );
  }
  return result.data;
}

/**
 * The content version: the digest of the documents, in part order.
 *
 * It is computed over the **already-parsed** values, never over the files'
 * bytes. That is what makes it identical everywhere — the Worker receives the
 * bundled content, the build reads it through the same module — and immune to
 * a mere reformat, which changes nothing about what is published.
 */
export function versionOf(documents: ContentDocuments): string {
  const material = PORTFOLIO_PARTS.map((part) => `${part} ${JSON.stringify(documents[part])}`).join(
    ' ',
  );
  return digest(material);
}
