import { z } from 'zod';
import { label, prose, richText } from './text.js';

/**
 * The architecture patterns, and what each one actually buys and costs.
 *
 * A closed set on purpose: these four are the ones the author has shipped, and
 * the comparison is a table with one row per pattern. An open identifier would
 * let a fifth row appear with no cell to put it in.
 */
export const ArchitecturePatternIdSchema = z.enum(['mvc', 'mvp', 'mvvm', 'clean']);

export type ArchitecturePatternId = z.infer<typeof ArchitecturePatternIdSchema>;

/**
 * One column of the comparison.
 *
 * Every field is a cell, and every pattern fills every cell — that is what
 * makes the comparison a comparison rather than four paragraphs side by side.
 * `buys` and `costs` are deliberately a pair: a pattern described only by what
 * it buys is an advert, and nobody chooses an architecture from an advert.
 */
export const ArchitecturePatternSchema = z
  .object({
    id: ArchitecturePatternIdSchema,
    name: label(),
    separates: prose(),
    buys: richText(),
    costs: richText(),
    chooseWhen: richText(),
    breaksWhen: richText(),
  })
  .meta({
    id: 'ArchitecturePattern',
    description: 'A pattern, and what it separates, buys, costs, and where it breaks.',
  });

export type ArchitecturePattern = z.infer<typeof ArchitecturePatternSchema>;

/**
 * A counted symbol suffix in a codebase — « 325 types whose name ends in
 * ViewModel ».
 *
 * It is structured data rather than a number written inside a sentence, and
 * that is the whole point: a figure buried in prose cannot be checked, while
 * this one is pinned by a test against what was actually measured. It says
 * nothing about the business, names no module and no client — it is the shape
 * of the code, which is exactly what the reading claims.
 */
export const ArchitectureEvidenceSchema = z
  .object({
    symbol: z.string().min(1),
    count: z.number().int().positive(),
  })
  .meta({
    id: 'ArchitectureEvidence',
    description: 'How many types carry a given suffix — the measured basis of the reading.',
  });

export type ArchitectureEvidence = z.infer<typeof ArchitectureEvidenceSchema>;

/**
 * A past codebase and the pattern it actually follows.
 *
 * `pattern` refers to the comparison above instead of restating it: the
 * trade-offs of Clean Architecture are written once, and a project points at
 * them. Restating them per project would guarantee that one copy drifts.
 */
export const ProjectArchitectureSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: label(),
    context: prose(),
    pattern: ArchitecturePatternIdSchema,
    stack: z.array(label()).min(1),
    evidence: z.array(ArchitectureEvidenceSchema),
    reading: richText(),
  })
  .meta({
    id: 'ProjectArchitecture',
    description: 'A codebase, the pattern it follows, and the measurements that show it.',
  });

export type ProjectArchitecture = z.infer<typeof ProjectArchitectureSchema>;

/**
 * The architecture dossier: the patterns compared, and the codebases read.
 *
 * `verifiedOn` dates the measurements the way `apps.verifiedAt` dates the App
 * Store identifiers. A count taken from a codebase is only worth what its date
 * is worth — the codebase keeps moving after the reading.
 */
export const ArchitectureDossierSchema = z
  .object({
    verifiedOn: z.iso.date(),
    intro: richText(),
    patterns: z.array(ArchitecturePatternSchema).min(1),
    projects: z.array(ProjectArchitectureSchema).min(1),
  })
  .meta({ id: 'ArchitectureDossier' });

export type ArchitectureDossier = z.infer<typeof ArchitectureDossierSchema>;
