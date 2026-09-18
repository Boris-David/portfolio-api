import { z } from 'zod';
import { AppInventorySchema } from './apps.js';
import { ArchitectureDossierSchema } from './architecture.js';
import {
  BackgroundSchema,
  ExperienceSchema,
  ExpertiseSchema,
  SkillGroupSchema,
} from './background.js';
import { CaseStudySchema } from './case-study.js';
import { DeepDiveSchema } from './deep-dive.js';
import { MetricSchema, ProfileSchema, SectionSchema } from './profile.js';

/**
 * The parts of the portfolio, and the schema of each.
 *
 * One table: the key is at once the field name in the aggregate, the URL
 * segment of the resource, and the name of the content file. No correspondence
 * table to keep in step, so none that can drift.
 */
export const PART_SCHEMAS = {
  profile: ProfileSchema,
  metrics: z.array(MetricSchema).min(1),
  sections: z.array(SectionSchema).min(1),
  caseStudies: z.array(CaseStudySchema).min(1),
  apps: AppInventorySchema,
  expertise: z.array(ExpertiseSchema).min(1),
  deepDives: z.array(DeepDiveSchema).min(1),
  architectures: ArchitectureDossierSchema,
  experience: z.array(ExperienceSchema).min(1),
  background: BackgroundSchema,
  skills: z.array(SkillGroupSchema).min(1),
} as const;

export type PortfolioPart = keyof typeof PART_SCHEMAS;

export const PORTFOLIO_PARTS = Object.keys(PART_SCHEMAS) as readonly PortfolioPart[];

/**
 * The aggregate: the whole portfolio content, in a single resolved locale.
 *
 * This is **the** definition. The TypeScript types are inferred from it, the
 * OpenAPI contract is generated from it, the content file schema is derived
 * from it, and the résumé template consumes it. Nothing is written twice, so
 * nothing can diverge — which is exactly what ADR 0002 promises.
 */
export const PortfolioSchema = z.object(PART_SCHEMAS).meta({ id: 'Portfolio' });

export type Portfolio = z.infer<typeof PortfolioSchema>;
