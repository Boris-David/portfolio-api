import { z } from 'zod';
import { RichTextSchema } from './rich-text.js';

/**
 * The model's three text primitives, and what each one declares.
 *
 * The schema written here is the one **the API serves**: a resolved locale,
 * bare strings. The schema of the **content files** — bilingual — is derived
 * from it mechanically (`src/content/derive.ts`) using the marks placed below.
 * One declaration, then, for the model, the OpenAPI contract, the TypeScript
 * types and the content validation.
 *
 * | primitive    | what the author writes in the file        | intent                  |
 * |--------------|-------------------------------------------|-------------------------|
 * | `prose()`    | `{ "fr": "…", "en": "…" }`, mandatory     | a sentence: a missing translation is a defect |
 * | `label()`    | `"Brest"` **or** the pair                 | a short term: the same in both languages unless stated otherwise |
 * | `richText()` | the pair, with `**bold**` and `` `code` ``| a sentence carrying emphasis |
 *
 * The `prose` / `label` distinction is not cosmetic: it puts the invariant
 * where it matters. On a sentence, a single string would slip French into the
 * English payload without a sound. On "Brest", demanding the pair would
 * protect nothing and cost 33 duplicates.
 */
export type TranslatableKind = 'prose' | 'label' | 'rich';

const marks = new WeakMap<z.ZodType, TranslatableKind>();

function mark<T extends z.ZodType>(schema: T, kind: TranslatableKind): T {
  marks.set(schema, kind);
  return schema;
}

/** A node's translatability mark, if it has one. */
export function translatableKind(schema: z.ZodType): TranslatableKind | undefined {
  return marks.get(schema);
}

const PROSE = mark(z.string().min(1), 'prose');
const LABEL = mark(z.string().min(1), 'label');
const RICH = mark(RichTextSchema, 'rich');

/** A sentence. Both languages are mandatory on the file side. */
export function prose(): z.ZodString {
  return PROSE;
}

/** A short term. A bare string means "the same in both languages". */
export function label(): z.ZodString {
  return LABEL;
}

/** A sentence carrying emphasis, transported as spans. */
export function richText(): typeof RichTextSchema {
  return RICH;
}
