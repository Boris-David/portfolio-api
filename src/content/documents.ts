import apps from '../../content/apps.json' with { type: 'json' };
import background from '../../content/background.json' with { type: 'json' };
import caseStudies from '../../content/case-studies.json' with { type: 'json' };
import experience from '../../content/experience.json' with { type: 'json' };
import expertise from '../../content/expertise.json' with { type: 'json' };
import metrics from '../../content/metrics.json' with { type: 'json' };
import profile from '../../content/profile.json' with { type: 'json' };
import sections from '../../content/sections.json' with { type: 'json' };
import skills from '../../content/skills.json' with { type: 'json' };
import type { PortfolioPart } from '../domain/portfolio.js';

/**
 * Les documents de contenu, **embarqués à la compilation**.
 *
 * Un Worker n'a pas de système de fichiers : le contenu ne peut pas se lire au
 * démarrage, il doit faire partie du script. Ces importations sont donc
 * résolues par le bundler, et le même module sert au Worker, aux scripts de
 * build et aux tests — une seule façon d'obtenir le contenu, donc aucune
 * divergence possible entre ce que le CV est rendu depuis et ce que l'API sert.
 *
 * C'est aussi ce qui rend la **version de contenu** identique des deux côtés :
 * elle se calcule sur ces valeurs déjà analysées, pas sur les octets d'un
 * fichier, donc un simple reformatage ne la fait pas bouger.
 */
export type ContentDocuments = Readonly<Record<PortfolioPart, unknown>>;

export const CONTENT_DOCUMENTS: ContentDocuments = {
  profile,
  metrics,
  sections,
  caseStudies,
  apps,
  expertise,
  experience,
  background,
  skills,
};
