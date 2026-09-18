import type { Context } from 'hono';
import { z } from 'zod';

/**
 * Errors, in RFC 9457 format (`application/problem+json`).
 *
 * A home-grown error format would force every client to learn ours; this one
 * is standard, typed, and documented in the OpenAPI contract like any other
 * response. `type` is a stable URI: that is what a client tests against, never
 * the text of `title`, which may be reworded.
 */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

const PROBLEM_BASE = 'https://github.com/Boris-David/portfolio-api/blob/main/docs/problems.md';

export const ProblemSchema = z
  .object({
    type: z.url(),
    title: z.string().min(1),
    status: z.number().int(),
    detail: z.string().min(1),
  })
  .meta({
    id: 'Problem',
    description: 'Erreur au format RFC 9457.',
  });

export type Problem = z.infer<typeof ProblemSchema>;

export const PROBLEMS = {
  unsupportedLocale: {
    type: `${PROBLEM_BASE}#unsupported-locale`,
    title: 'Langue non prise en charge',
    status: 400,
  },
  notFound: {
    type: `${PROBLEM_BASE}#not-found`,
    title: 'Ressource inconnue',
    status: 404,
  },
  cvUnavailable: {
    type: `${PROBLEM_BASE}#cv-unavailable`,
    title: 'CV indisponible',
    status: 503,
  },
  internal: {
    type: `${PROBLEM_BASE}#internal`,
    title: 'Erreur interne',
    status: 500,
  },
} as const satisfies Record<string, Omit<Problem, 'detail'>>;

export type ProblemKind = keyof typeof PROBLEMS;

export function problemResponse(c: Context, kind: ProblemKind, detail: string): Response {
  const problem: Problem = { ...PROBLEMS[kind], detail };
  return c.newResponse(JSON.stringify(problem), PROBLEMS[kind].status, {
    'Content-Type': PROBLEM_CONTENT_TYPE,
    'Cache-Control': 'no-store',
  });
}
