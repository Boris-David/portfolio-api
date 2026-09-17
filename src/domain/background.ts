import { z } from 'zod';
import { label, prose, richText } from './text.js';

/** Un mois, `AAAA-MM`. */
export const YearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Une date d'obtention : l'année, et le mois quand il est connu. */
export const AwardedOnSchema = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/);

/**
 * Un sujet creusé en profondeur. Aucun nom d'icône n'est stocké : c'est de la
 * présentation, et `id` suffit au client pour choisir la sienne.
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
 * Une expérience professionnelle.
 *
 * Les dates sont stockées en `AAAA-MM`, jamais en « mai 2023 → aujourd'hui » :
 * la chaîne affichée dépend de la langue et de la plateforme, donc elle se
 * formate au rendu. Stocker les deux, ce serait stocker deux vérités — et
 * celle qui se périme le plus vite est justement « aujourd'hui ».
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

/** Formation, certifications et projets ouverts — la section « Parcours ». */
export const BackgroundSchema = z
  .object({
    education: z.array(EducationSchema).min(1),
    certifications: z.array(CertificationSchema),
    openProjects: z.array(OpenProjectSchema),
  })
  .meta({ id: 'Background' });

export type Background = z.infer<typeof BackgroundSchema>;
