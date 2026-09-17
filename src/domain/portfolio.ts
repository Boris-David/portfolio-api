import { z } from 'zod';
import { AppInventorySchema } from './apps.js';
import {
  BackgroundSchema,
  ExperienceSchema,
  ExpertiseSchema,
  SkillGroupSchema,
} from './background.js';
import { CaseStudySchema } from './case-study.js';
import { MetricSchema, ProfileSchema, SectionSchema } from './profile.js';

/**
 * Les parties du portfolio, et le schéma de chacune.
 *
 * Une seule table : la clé est à la fois le nom du champ dans l'agrégat, le
 * segment d'URL de la ressource, et le nom du fichier de contenu. Aucune table
 * de correspondance à tenir à jour, donc aucune à laisser dériver.
 */
export const PART_SCHEMAS = {
  profile: ProfileSchema,
  metrics: z.array(MetricSchema).min(1),
  sections: z.array(SectionSchema).min(1),
  caseStudies: z.array(CaseStudySchema).min(1),
  apps: AppInventorySchema,
  expertise: z.array(ExpertiseSchema).min(1),
  experience: z.array(ExperienceSchema).min(1),
  background: BackgroundSchema,
  skills: z.array(SkillGroupSchema).min(1),
} as const;

export type PortfolioPart = keyof typeof PART_SCHEMAS;

export const PORTFOLIO_PARTS = Object.keys(PART_SCHEMAS) as readonly PortfolioPart[];

/**
 * L'agrégat : tout le contenu du portfolio, dans une seule locale résolue.
 *
 * C'est **la** définition. Les types TypeScript en sont inférés, le contrat
 * OpenAPI en est généré, le schéma des fichiers de contenu en est dérivé, et le
 * gabarit du CV le consomme. Rien n'est écrit deux fois, donc rien ne peut
 * diverger — c'est exactement ce que promet l'ADR 0002.
 */
export const PortfolioSchema = z.object(PART_SCHEMAS).meta({ id: 'Portfolio' });

export type Portfolio = z.infer<typeof PortfolioSchema>;
