import type { Locale } from '../domain/locale.js';

/**
 * Les intitulés du **document** CV.
 *
 * Ils ne sont pas dans le contenu servi par l'API, et c'est délibéré : « Profil »
 * ou « Expérience » sont la charpente d'un CV, pas des faits du portfolio. Les
 * mettre dans le contenu ferait de l'API un service de traduction d'interface —
 * chaque client a la sienne, et le CV est un client comme un autre.
 *
 * Ceux qui existent déjà dans le contenu (les intitulés de sections, les titres
 * de groupes de compétences) ne sont **pas** redéclarés ici : ils sont lus.
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
