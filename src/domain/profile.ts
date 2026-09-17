import { z } from 'zod';
import { label, prose, richText } from './text.js';

export const LinkSchema = z
  .object({
    id: z.enum(['github', 'linkedin']),
    label: z.string().min(1),
    url: z.url(),
  })
  .meta({ id: 'Link' });

export type Link = z.infer<typeof LinkSchema>;

/**
 * L'identité et l'accroche.
 *
 * Deux formes du nom coexistent par décision éditoriale : la forme courte
 * s'affiche partout, la forme longue est réservée au pied de page et au CV.
 * Elles sont donc deux champs, pas une chaîne qu'on tronquerait.
 */
export const ProfileSchema = z
  .object({
    name: z.object({
      display: z.string().min(1),
      full: z.string().min(1),
    }),
    headline: prose(),
    availability: prose(),
    location: prose(),
    remote: prose(),
    languages: prose(),
    summary: z.array(richText()).min(1),
    contact: z.object({
      email: z.email(),
      title: prose(),
      body: prose(),
      links: z.array(LinkSchema).min(1),
    }),
    footer: z.object({
      role: prose(),
      location: prose(),
    }),
  })
  .meta({ id: 'Profile' });

export type Profile = z.infer<typeof ProfileSchema>;

/**
 * Un chiffre publiable et son libellé.
 *
 * `value` et `unit` sont séparés parce que la mise en forme les traite
 * différemment — l'unité porte l'accent visuel. `countTo` n'est renseigné que
 * pour les valeurs réellement dénombrables : un client peut les animer, les
 * autres (« ~1 », « > 99,8 ») n'ont pas de compte à rebours qui ait un sens.
 */
export const MetricSchema = z
  .object({
    id: z.string().min(1),
    value: label(),
    unit: label().nullable(),
    countTo: z.number().int().positive().nullable(),
    caption: prose(),
  })
  .meta({ id: 'Metric' });

export type Metric = z.infer<typeof MetricSchema>;

export const SectionIdSchema = z.enum(['case-studies', 'apps', 'depth', 'background']);

export type SectionId = z.infer<typeof SectionIdSchema>;

/**
 * L'en-tête éditorial d'une section. Le numéro affiché sur la page de
 * référence (« 01 · ») n'est pas stocké : c'est le rang dans la liste, et le
 * dupliquer dans le contenu garantirait qu'un jour il ne corresponde plus.
 */
export const SectionSchema = z
  .object({
    id: SectionIdSchema,
    eyebrow: prose(),
    title: prose(),
    intro: richText().nullable(),
    note: richText().nullable(),
  })
  .meta({ id: 'Section' });

export type Section = z.infer<typeof SectionSchema>;
