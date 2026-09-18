import { z } from 'zod';
import { LocaleSchema, type Locale } from './locale.js';

/**
 * The envelope wrapped around every content response.
 *
 * The HTTP headers already carry `Content-Language` and `ETag`; the envelope
 * exists for one precise reason: the iOS app **writes the response to disk**
 * as an offline snapshot (ADR 0002). A snapshot that does not carry its own
 * language and its own version cannot be checked — and an uncheckable snapshot
 * becomes a second, stale source of truth.
 */
export const MetaSchema = z
  .object({
    locale: LocaleSchema,
    contentVersion: z.string().min(1),
  })
  .meta({
    id: 'Meta',
    description:
      'Langue servie et version du contenu. La version change si et seulement si le contenu change.',
  });

export type Meta = z.infer<typeof MetaSchema>;

export interface Envelope<T> {
  readonly meta: Meta;
  readonly data: T;
}

export function envelopeOf<T extends z.ZodType>(
  data: T,
): z.ZodObject<{
  meta: typeof MetaSchema;
  data: T;
}> {
  return z.object({ meta: MetaSchema, data });
}

export function envelope<T>(locale: Locale, contentVersion: string, data: T): Envelope<T> {
  return { meta: { locale, contentVersion }, data };
}
