import { z } from 'zod';
import { BlockSchema } from './block.js';
import { MediaSchema } from './media.js';
import { label, prose, richText } from './text.js';

/**
 * Les trois temps d'un récit d'ingénieur : le problème, la décision, le
 * résultat. `heading` reste une donnée parce que l'intitulé varie réellement
 * d'un cas à l'autre (« Décision » au singulier sur un chantier, « Décisions et
 * réalisations » sur un produit entier).
 */
export const PanelKindSchema = z.enum(['problem', 'decision', 'result']);

export type PanelKind = z.infer<typeof PanelKindSchema>;

export const PanelSchema = z
  .object({
    kind: PanelKindSchema,
    heading: prose(),
    blocks: z.array(BlockSchema).min(1),
  })
  .meta({ id: 'Panel' });

export type Panel = z.infer<typeof PanelSchema>;

/**
 * Un chantier d'une étude de cas. Une étude tient en un seul chapitre sans
 * titre (un produit raconté d'un bloc) ou en plusieurs chapitres titrés (cinq
 * chantiers d'un même périmètre) — la même structure porte les deux.
 */
export const ChapterSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: prose().nullable(),
    subtitle: prose().nullable(),
    panels: z.array(PanelSchema).min(1),
  })
  .meta({ id: 'Chapter' });

export type Chapter = z.infer<typeof ChapterSchema>;

export const CaseStudySchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: prose(),
    subtitle: prose(),
    intro: richText().nullable(),
    link: z.object({ label: label(), url: z.url() }).nullable(),
    chapters: z.array(ChapterSchema).min(1),
    media: z.array(MediaSchema),
    tags: z.array(label()).min(1),
  })
  .meta({ id: 'CaseStudy' });

export type CaseStudy = z.infer<typeof CaseStudySchema>;
