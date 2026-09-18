import { z } from 'zod';
import { BlockSchema } from './block.js';
import { prose, richText } from './text.js';

/**
 * One movement of a deep dive: a heading, then body copy.
 *
 * The blocks are the very ones a case-study panel uses, so a client renders a
 * deep dive with the renderer it already has. A second block model would buy
 * nothing and cost a renderer per client.
 */
export const DeepDiveSectionSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    heading: prose(),
    blocks: z.array(BlockSchema).min(1),
  })
  .meta({ id: 'DeepDiveSection' });

export type DeepDiveSection = z.infer<typeof DeepDiveSectionSchema>;

/**
 * Where a deep dive was paid for in production: a case study, and the
 * workstream inside it.
 *
 * A reference, not a copy. The story is told once, in the case study; a deep
 * dive that retold it would become a second version of the same facts, and the
 * two would drift the first time one of them is corrected.
 */
export const DeepDiveEvidenceSchema = z
  .object({
    caseStudy: z.string().regex(/^[a-z0-9-]+$/),
    chapter: z.string().regex(/^[a-z0-9-]+$/),
  })
  .meta({
    id: 'DeepDiveEvidence',
    description: 'The case-study chapter where this technique was applied in production.',
  });

export type DeepDiveEvidence = z.infer<typeof DeepDiveEvidenceSchema>;

/**
 * An expertise topic, at the length the website has no room for.
 *
 * `expertise` points at the matching entry of `expertise` — where the title and
 * the short form already live — instead of restating them. That is the same
 * move as `profile.showcase.caseStudy`: a reference costs the client one lookup
 * and removes a second place to correct.
 *
 * What a deep dive adds is the *technique*, not the anecdote: why the approach
 * holds, what it still costs, and where it stops being worth it. The anecdote
 * stays in the case study `evidence` points to.
 */
export const DeepDiveSchema = z
  .object({
    expertise: z.string().regex(/^[a-z0-9-]+$/),
    lede: richText(),
    sections: z.array(DeepDiveSectionSchema).min(1),
    evidence: DeepDiveEvidenceSchema.nullable(),
  })
  .meta({ id: 'DeepDive' });

export type DeepDive = z.infer<typeof DeepDiveSchema>;
