import { z } from 'zod';
import { label, prose, richText } from './text.js';

/** A month, `YYYY-MM`. */
export const YearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** An award date: the year, plus the month when it is known. */
export const AwardedOnSchema = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/);

/**
 * A topic explored in depth. No icon name is stored: that is presentation, and
 * `id` is enough for a client to pick its own.
 */
export const ExpertiseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: prose(),
    body: richText(),
  })
  .meta({ id: 'Expertise' });

export type Expertise = z.infer<typeof ExpertiseSchema>;

/**
 * A job.
 *
 * Dates are stored as `YYYY-MM`, never as "May 2023 → today": the displayed
 * string depends on the language and the platform, so it is formatted at
 * render time. Storing both would be storing two truths — and the one that
 * goes stale fastest is precisely "today".
 */
export const ExperienceSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    role: prose(),
    organisation: z.string().min(1),
    location: z.string().min(1),
    start: YearMonthSchema,
    end: YearMonthSchema.nullable(),
    roles: z.array(prose()),
    highlights: z.array(richText()).min(1),
    stack: z.array(label()).min(1),
  })
  .meta({ id: 'Experience' });

export type Experience = z.infer<typeof ExperienceSchema>;

export const EducationSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    degree: prose(),
    school: z.string().min(1),
    detail: prose().nullable(),
    startYear: z.number().int(),
    endYear: z.number().int(),
  })
  .meta({ id: 'Education' });

export type Education = z.infer<typeof EducationSchema>;

export const CertificationSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    issuer: z.string().min(1),
    awardedOn: AwardedOnSchema,
    verifyUrl: z.url().nullable(),
  })
  .meta({ id: 'Certification' });

export type Certification = z.infer<typeof CertificationSchema>;

export const OpenProjectSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    description: richText(),
    sourceUrl: z.url().nullable(),
  })
  .meta({ id: 'OpenProject' });

export type OpenProject = z.infer<typeof OpenProjectSchema>;

export const SkillGroupSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: prose(),
    items: z.array(label()).min(1),
  })
  .meta({ id: 'SkillGroup' });

export type SkillGroup = z.infer<typeof SkillGroupSchema>;

/** Education, certifications and open projects — the "Parcours" section. */
export const BackgroundSchema = z
  .object({
    education: z.array(EducationSchema).min(1),
    certifications: z.array(CertificationSchema),
    openProjects: z.array(OpenProjectSchema),
  })
  .meta({ id: 'Background' });

export type Background = z.infer<typeof BackgroundSchema>;
