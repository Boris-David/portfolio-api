import { z } from 'zod';

/**
 * The portfolio's two languages. They are not a nicety: the target audience
 * includes remote roles in Paris and abroad, so the content is bilingual
 * **end to end** — no resource exists in a single language.
 */
export const LOCALES = ['fr', 'en'] as const;

export const LocaleSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof LocaleSchema>;

/** The language served when a request asks for none. */
export const DEFAULT_LOCALE: Locale = 'fr';

export function isLocale(candidate: string): candidate is Locale {
  return (LOCALES as readonly string[]).includes(candidate);
}

/**
 * A value carried in every language. This is the type of the **stored
 * content**; the API never serves this shape — it serves the projection for a
 * locale (see `content/projection.ts`). Keeping the pair on the storage side
 * makes a forgotten translation impossible: the schema demands both keys.
 */
export type Localized<T> = Readonly<Record<Locale, T>>;
