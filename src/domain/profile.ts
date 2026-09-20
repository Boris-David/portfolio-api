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
 * Two forms of the name coexist by editorial decision. `display` is shown
 * everywhere; `formal` is the one the résumé header carries — the surname in
 * capitals, the way a French CV sets it.
 *
 * It was called `full` and held the civil name in full until 2026-09-20. The
 * author asked for the short form there too: *"tout le monde n'a pas
 * forcément accès à mon nom complet aussi facilement"*. The field was renamed
 * with the value, because a field named `full` holding an abbreviation is a
 * small lie that the next reader pays for.
 */
export const ProfileSchema = z
  .object({
    name: z.object({
      display: z.string().min(1),
      formal: z.string().min(1),
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
     *
     * `description` says what the **product** does. It is separate from
     * `media.alt`, which describes the **picture** for somebody who cannot see
     * it — the two were the same string, so the sentence a sighted reader read
     * as a pitch was also the one VoiceOver read as a description of a
     * screenshot. Neither job was done well.
     */
    showcase: z.object({
      media: MediaSchema,
      description: prose(),
      caseStudy: z.string().regex(/^[a-z0-9-]+$/),
    }),
    /**
     * Who he is when he is not writing code.
     *
     * ## Why this is content and not a paragraph of the summary
     *
     * The summary answers "what has he done". This answers "what is he like to
     * work with", and a reader looks for it at a different moment — usually
     * after being convinced by the rest, never before. Two questions, two
     * places, so a reader who only wants the first does not wade through the
     * second.
     *
     * ## Facts, not adjectives
     *
     * The editorial rule is explicit: *the facts carry the personality better
     * than the adjectives do*. "Class representative, president of the student
     * committee, team captain" says leader without using the word, and it is
     * checkable in a way "leader" never is. `interests` stays a plain list —
     * it is the one place where naming things is the honest form.
     */
    personality: z.object({
      /**
       * The one fact worth setting apart, because a reader remembers it.
       *
       * It was a paragraph among the others and it disappeared into them. A
       * distinction voted by a whole company is not a sentence of running
       * prose — it is the thing somebody repeats about him afterwards, and
       * the surfaces set it as such.
       */
      highlight: z.object({ title: label(), detail: prose() }),
      summary: z.array(richText()).min(1),
      /**
       * `id` is a stable identity, `label` is what a reader sees.
       *
       * The identity exists so a client can put a glyph beside it. The glyph
       * name itself stays out of the content: an SF Symbol means nothing to
       * the website and nothing at all to the résumé.
       */
      interests: z.array(z.object({ id: z.string().regex(/^[a-z-]+$/), label: label() })).min(1),
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
 * A publishable figure, what it counts, and what it means.
 *
 * `value` and `unit` are separate because presentation treats them
 * differently — the unit carries the visual accent. `countTo` is filled in
 * only for genuinely countable values: a client can animate those, while the
 * others ("~5", "> 99,9") have no count-up that would mean anything.
 *
 * ## Two lengths, two jobs — not two copies
 *
 * `caption` names what the figure counts, in a few words: it goes under the
 * number wherever the column is narrow, and the résumé puts three of them side
 * by side on a page that has to stay at two.
 *
 * `detail` is the sentence the author would say out loud. It goes where there
 * is a measure to read it on — a full-width row in the app, the proof bar on
 * the site. Neither can be derived from the other, and a surface picks the one
 * its layout can carry rather than truncating the wrong one.
 */
export const MetricSchema = z
  .object({
    id: z.string().min(1),
    value: label(),
    unit: label().nullable(),
    countTo: z.number().int().positive().nullable(),
    caption: prose(),
    detail: prose(),
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
