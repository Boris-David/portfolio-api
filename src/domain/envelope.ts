import { z } from 'zod';
import { LocaleSchema, type Locale } from './locale.js';

/**
 * L'enveloppe de toute réponse de contenu.
 *
 * Les en-têtes HTTP portent déjà `Content-Language` et `ETag` ; l'enveloppe
 * existe pour une raison précise : l'app iOS **écrit la réponse sur disque**
 * comme instantané hors ligne (ADR 0002). Un instantané qui ne porte pas sa
 * propre langue et sa propre version n'est pas vérifiable — et un instantané
 * non vérifiable devient une seconde source de vérité périmée.
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
