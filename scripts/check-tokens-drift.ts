/**
 * Checks that the design token snapshot has not drifted from the original.
 *
 * The tokens belong to the hub repo (ADR 0001), but this repo has to clone and
 * build on its own: so it carries a copy. A copy with no guard becomes a
 * second source of truth — which is exactly what ADR 0002 says about the
 * snapshot embedded on the iOS side, and the remedy is the same: CI compares,
 * and fails when the two diverge.
 *
 * The comparison runs against the neighbouring hub repo when it is there
 * (local development, possibly offline), and against `main` on GitHub
 * otherwise (CI).
 */
import { existsSync, readFileSync } from 'node:fs';
import { DESIGN_TOKENS_SOURCE, PATHS } from '../src/node/paths.js';

const local = readFileSync(PATHS.designTokens, 'utf8');

const { reference, origin } = await readReference();

if (normalise(local) === normalise(reference)) {
  console.log(`[tokens] snapshot matches ${origin}`);
} else {
  console.error(
    `[tokens] ${PATHS.designTokens} has drifted from ${origin}.\n` +
      `         The tokens belong to the hub: copy the original over, ` +
      `do not edit the snapshot.`,
  );
  process.exit(1);
}

async function readReference(): Promise<{ reference: string; origin: string }> {
  if (existsSync(DESIGN_TOKENS_SOURCE.siblingPath)) {
    return {
      reference: readFileSync(DESIGN_TOKENS_SOURCE.siblingPath, 'utf8'),
      origin: DESIGN_TOKENS_SOURCE.siblingPath,
    };
  }
  const response = await fetch(DESIGN_TOKENS_SOURCE.rawUrl);
  if (!response.ok) {
    throw new Error(
      `Hub tokens unreachable (${String(response.status)}): ${DESIGN_TOKENS_SOURCE.rawUrl}`,
    );
  }
  return { reference: await response.text(), origin: DESIGN_TOKENS_SOURCE.rawUrl };
}

/** Compares content, not formatting: reformatted JSON has not drifted. */
function normalise(raw: string): string {
  return JSON.stringify(JSON.parse(raw));
}
