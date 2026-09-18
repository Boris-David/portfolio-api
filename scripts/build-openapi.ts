/**
 * Writes the derived OpenAPI contract to `contracts/openapi.json`.
 *
 * The contract also lives at runtime (`/v1/openapi.json`); freezing it in the
 * repo serves **review**: a schema change then shows up in a PR's diff instead
 * of being discovered in production. `--check` fails when the file has not
 * been regenerated — that is what CI runs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from '../src/node/paths.js';
import { buildSnapshot } from '../src/content/snapshot.js';
import { unavailableCvStore } from '../src/cv/unavailable-store.js';
import { createApp } from '../src/http/app.js';
import { openApiDocument } from '../src/http/openapi.js';

const app = createApp({
  snapshot: buildSnapshot(),
  cv: () => unavailableCvStore('not needed to generate the contract'),
});

const document = `${JSON.stringify(app.getOpenAPI31Document(openApiDocument), null, 2)}\n`;

if (process.argv.includes('--check')) {
  const existing = readFileSync(PATHS.contract, 'utf8');
  if (existing !== document) {
    console.error(
      `[openapi] ${PATHS.contract} no longer matches the Zod schemas. ` +
        `Run "npm run build:openapi" and commit the result.`,
    );
    process.exit(1);
  }
  console.log('[openapi] contract up to date');
} else {
  mkdirSync(dirname(PATHS.contract), { recursive: true });
  writeFileSync(PATHS.contract, document);
  console.log(`[openapi] written to ${PATHS.contract}`);
}
