import { z } from 'zod';
import { MediaSchema } from './media.js';
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
 * The identity and the headline.
 *
 * Two forms of the name coexist by editorial decision: the short form is shown
 * everywhere, the long form is reserved for the footer and the résumé. So they
 * are two fields, not one string to be truncated.
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
    /**
     * The visual featured next to the headline, and the case study it
     * illustrates. The reference is by `slug`, not by URL: the App Store
     * address is already carried by the case study, and copying it here would
     * make a second place to fix.
     */
    showcase: z.object({
      media: MediaSchema,
      caseStudy: z.string().regex(/^[a-z0-9-]+$/),
    }),
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
 * A publishable figure and its caption.
 *
 * `value` and `unit` are separate because presentation treats them
 * differently — the unit carries the visual accent. `countTo` is filled in
 * only for genuinely countable values: a client can animate those, while the
 * others ("~1", "> 99,8") have no count-up that would mean anything.
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
 * The editorial header of a section. The number shown on the reference page
 * ("01 · ") is not stored: it is the rank in the list, and duplicating it in
 * the content would guarantee that one day the two stop matching.
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
