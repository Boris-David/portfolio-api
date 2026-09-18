import { z } from 'zod';
import { MarkupError } from '../domain/errors.js';
import { UnsupportedSchemaNodeError } from '../domain/errors.js';
import type { Locale } from '../domain/locale.js';
import { parseMarkup } from '../domain/markup.js';
import { translatableKind } from '../domain/text.js';

/**
 * Derives, from a domain schema, the schema of the **content files** for a
 * given locale.
 *
 * The domain schema describes what the API serves: a resolved locale, bare
 * strings, rich text as spans. The files, by contrast, carry both languages
 * and the author's markup. Rather than writing that second schema by hand —
 * which would recreate exactly the divergence ADR 0002 refuses — we
 * **compute** it, replacing each leaf marked translatable by its bilingual
 * form followed by its projection.
 *
 * Parsing a file with the derived schema therefore does three things at once:
 * validates the structure, checks that no translation is missing, and produces
 * the domain value for the requested locale directly.
 *
 * What the derivation does **not** reproduce — the constraints carried by
 * containers (`array().min()`, object refinements) — is caught by a second
 * validation of the projected value against the domain schema itself
 * (`loader.ts`). The two passes complement each other, and a derivation bug
 * becomes a loud error at startup rather than a silently wrong payload.
 */
export function deriveContentSchema(schema: z.ZodType, locale: Locale, path = '$'): z.ZodType {
  const kind = translatableKind(schema);
  if (kind !== undefined) {
    switch (kind) {
      case 'prose':
        return localizedPair(NON_EMPTY, locale);
      case 'label':
        return localizedLabel(locale);
      case 'rich':
        return localizedRichText(locale);
    }
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const derived: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(shape)) {
      derived[key] = deriveContentSchema(value, locale, `${path}.${key}`);
    }
    // `strictObject`: an unknown key in a content file is a typo, not an
    // extension. It has to fail, not be ignored.
    return z.strictObject(derived);
  }

  if (schema instanceof z.ZodArray) {
    return z.array(deriveContentSchema(schema.element as z.ZodType, locale, `${path}[]`));
  }

  if (schema instanceof z.ZodNullable) {
    return deriveContentSchema(schema.unwrap() as z.ZodType, locale, path).nullable();
  }

  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
    // A discriminated union derives to a plain union: the discriminant is a
    // non-translatable literal, so exactly one branch can still match. The
    // domain schema keeps the discriminated form — that is the one producing
    // the contract and the error messages.
    const options = (schema.options as readonly z.ZodType[]).map((option, index) =>
      deriveContentSchema(option, locale, `${path}|${String(index)}`),
    );
    return z.union(options);
  }

  if (LEAF_TYPES.has(schema.def.type)) {
    // Non-translatable leaf: identifier, URL, date, enum. It is taken as-is,
    // constraints included.
    return schema;
  }

  throw new UnsupportedSchemaNodeError(schema.constructor.name, path);
}

/** The leaf types the content is allowed to carry untranslated. */
const LEAF_TYPES = new Set(['string', 'number', 'boolean', 'enum', 'literal']);

const NON_EMPTY = z.string().min(1);

/**
 * The author's markup: `**bold**` and `` `code` ``. An unclosed delimiter
 * surfaces with its reason, at the exact spot in the file — not as an
 * "invalid string".
 */
const MARKUP = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    try {
      parseMarkup(value);
    } catch (error) {
      if (!(error instanceof MarkupError)) throw error;
      ctx.addIssue({ code: 'custom', message: error.message });
    }
  });

function pair<T extends z.ZodType>(inner: T): z.ZodObject<{ fr: T; en: T }> {
  return z.strictObject({ fr: inner, en: inner });
}

function localizedPair(inner: z.ZodString, locale: Locale): z.ZodType<string> {
  return pair(inner).transform((value) => value[locale]);
}

function localizedLabel(locale: Locale): z.ZodType<string> {
  return z
    .union([NON_EMPTY, pair(NON_EMPTY)])
    .transform((value) => (typeof value === 'string' ? value : value[locale]));
}

function localizedRichText(locale: Locale): z.ZodType {
  return pair(MARKUP).transform((value) => parseMarkup(value[locale]));
}
