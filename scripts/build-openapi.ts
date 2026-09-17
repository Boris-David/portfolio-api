/**
 * Écrit le contrat OpenAPI dérivé dans `contracts/openapi.json`.
 *
 * Le contrat vit aussi au runtime (`/v1/openapi.json`) ; le figer dans le
 * dépôt sert la **revue** : un changement de schéma apparaît alors dans le
 * diff d'une PR, au lieu de se découvrir en production. `--check` échoue si le
 * fichier n'a pas été régénéré — c'est ce que la CI exécute.
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
  cv: () => unavailableCvStore('non requis pour générer le contrat'),
});

const document = `${JSON.stringify(app.getOpenAPI31Document(openApiDocument), null, 2)}\n`;

if (process.argv.includes('--check')) {
  const existing = readFileSync(PATHS.contract, 'utf8');
  if (existing !== document) {
    console.error(
      `[openapi] ${PATHS.contract} ne correspond plus aux schémas Zod. ` +
        `Lancer « npm run build:openapi » et committer le résultat.`,
    );
    process.exit(1);
  }
  console.log('[openapi] contrat à jour');
} else {
  mkdirSync(dirname(PATHS.contract), { recursive: true });
  writeFileSync(PATHS.contract, document);
  console.log(`[openapi] écrit dans ${PATHS.contract}`);
}
