import { z } from 'zod';
import { BlockSchema } from './block.js';
import { MediaSchema } from './media.js';
import { label, prose, richText } from './text.js';

/**
 * The three beats of an engineer's story: the problem, the decision, the
 * result. `heading` stays data because the wording genuinely varies from one
 * case to the next ("Décision", singular, on a single piece of work;
 * "Décisions et réalisations" on a whole product).
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
 * One piece of work within a case study. A study fits either in a single
 * untitled chapter (a product told in one go) or in several titled chapters
 * (five pieces of work within one scope) — the same structure carries both.
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
