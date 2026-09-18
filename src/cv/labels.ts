import type { Locale } from '../domain/locale.js';

/**
 * The headings of the résumé **document**.
 *
 * They are not in the content the API serves, and that is deliberate:
 * "Profil" and "Expérience" are the skeleton of a résumé, not facts about the
 * portfolio. Putting them in the content would turn the API into a UI
 * translation service — every client has its own UI, and the résumé is a
 * client like any other.
 *
 * The ones that already exist in the content (section headings, skill group
 * titles) are **not** redeclared here: they are read from it.
 */
export interface CvLabels {
  readonly documentKind: string;
  readonly profile: string;
  readonly experience: string;
  readonly project: string;
  readonly skills: string;
  readonly education: string;
  readonly certifications: string;
  readonly stack: string;
  readonly verify: string;
  readonly page: string;
}

export const CV_LABELS: Readonly<Record<Locale, CvLabels>> = {
  fr: {
    documentKind: 'CV',
    profile: 'Profil',
    experience: 'Expérience',
    project: 'Projet personnel',
    skills: 'Compétences',
    education: 'Formation',
    certifications: 'Certifications',
    stack: 'Stack',
    verify: 'Vérifier',
    page: 'Page',
  },
  en: {
    documentKind: 'Résumé',
    profile: 'Profile',
    experience: 'Experience',
    project: 'Personal project',
    skills: 'Skills',
    education: 'Education',
    certifications: 'Certifications',
    stack: 'Stack',
    verify: 'Verify',
    page: 'Page',
  },
};
