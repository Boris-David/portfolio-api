import apps from '../../content/apps.json' with { type: 'json' };
import architectures from '../../content/architectures.json' with { type: 'json' };
import background from '../../content/background.json' with { type: 'json' };
import caseStudies from '../../content/case-studies.json' with { type: 'json' };
import deepDives from '../../content/deep-dives.json' with { type: 'json' };
import experience from '../../content/experience.json' with { type: 'json' };
import expertise from '../../content/expertise.json' with { type: 'json' };
import metrics from '../../content/metrics.json' with { type: 'json' };
import profile from '../../content/profile.json' with { type: 'json' };
import sections from '../../content/sections.json' with { type: 'json' };
import skills from '../../content/skills.json' with { type: 'json' };
import type { PortfolioPart } from '../domain/portfolio.js';

/**
 * The content documents, **bundled at compile time**.
 *
 * A Worker has no file system: the content cannot be read at startup, it has
 * to be part of the script. These imports are therefore resolved by the
 * bundler, and the same module serves the Worker, the build scripts and the
 * tests — one single way to obtain the content, so no possible divergence
 * between what the résumé is rendered from and what the API serves.
 *
 * It is also what makes the **content version** identical on both sides: it is
 * computed over these already-parsed values, not over a file's bytes, so a
 * mere reformat does not move it.
 */
export type ContentDocuments = Readonly<Record<PortfolioPart, unknown>>;

export const CONTENT_DOCUMENTS: ContentDocuments = {
  profile,
  metrics,
  sections,
  caseStudies,
  apps,
  expertise,
  deepDives,
  architectures,
  experience,
  background,
  skills,
};
