import { z } from 'zod';
import { CertificationSchema, EducationSchema, ExperienceSchema } from './background.js';
import type { Portfolio } from './portfolio.js';

/**
 * One moment of the career, whatever kind of moment it is.
 *
 * A discriminated union carrying the source entry whole, rather than a flat row
 * with a common denominator: flattening would force a job, a degree and a
 * certification into the same fields, and the three genuinely do not have the
 * same ones. A client switches on `kind` and reuses the renderer it already has
 * for that resource.
 */
export const TimelineEntrySchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('experience'), experience: ExperienceSchema }),
    z.object({ kind: z.literal('education'), education: EducationSchema }),
    z.object({ kind: z.literal('certification'), certification: CertificationSchema }),
  ])
  .meta({ id: 'TimelineEntry' });

export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

/**
 * The whole career as one ordered run, newest first.
 *
 * Chronological rank is **not** a stored field: it is the position in this
 * array, exactly as a section's number is its rank in `sections`. Storing it
 * would be a second fact to keep in step with the dates that already decide it.
 */
export const TimelineSchema = z.array(TimelineEntrySchema).min(1).meta({
  id: 'Timeline',
  description: 'Jobs, degrees and certifications merged into a single run, newest first.',
});

export type Timeline = z.infer<typeof TimelineSchema>;

/** The month a year-only date is anchored to, so every entry sorts on one key. */
const FIRST_MONTH = '-01';

const MONTH_SEPARATOR = '-';

const BEFORE = -1;
const AFTER = 1;
const SAME = 0;

interface DatedEntry {
  /** A sortable `YYYY-MM`, normalised from whatever the source entry carries. */
  readonly since: string;
  readonly entry: TimelineEntry;
}

/**
 * Merges the career into a single ordered run.
 *
 * It **derives**: nothing here is stored, and no content file describes a
 * timeline. Jobs, degrees and certifications already exist, each with its own
 * dates and its own date format; a stored timeline would be a second copy of
 * facts that are already published, and the copy would be the one that goes
 * stale. What this route adds is precisely what a stored copy could not: the
 * three date formats reconciled onto one key, once, instead of once per client.
 *
 * Ties keep the order the content declares — the sort is stable and the sources
 * are concatenated in a fixed order — so two entries of the same month always
 * come out the same way round.
 */
export function buildTimeline(portfolio: Portfolio): Timeline {
  const dated: readonly DatedEntry[] = [
    ...portfolio.experience.map((experience): DatedEntry => ({
      since: experience.start,
      entry: { kind: 'experience', experience },
    })),
    ...portfolio.background.education.map((education): DatedEntry => ({
      since: `${String(education.startYear)}${FIRST_MONTH}`,
      entry: { kind: 'education', education },
    })),
    ...portfolio.background.certifications.map((certification): DatedEntry => ({
      since: withMonth(certification.awardedOn),
      entry: { kind: 'certification', certification },
    })),
  ];

  return [...dated].sort(newestFirst).map((item) => item.entry);
}

/** A date known to the year only is read as its first month — never as its last. */
function withMonth(awardedOn: string): string {
  return awardedOn.includes(MONTH_SEPARATOR) ? awardedOn : `${awardedOn}${FIRST_MONTH}`;
}

function newestFirst(left: DatedEntry, right: DatedEntry): number {
  if (left.since === right.since) return SAME;
  return left.since < right.since ? AFTER : BEFORE;
}
