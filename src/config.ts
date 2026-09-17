import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Les valeurs de configuration, nommées et rassemblées.
 *
 * Aucun littéral de cache, de chemin ou de port ne traîne dans le code : une
 * valeur magique dispersée est une valeur qu'on ne peut plus changer sans la
 * chercher partout.
 */

/**
 * La racine du paquet, trouvée en remontant jusqu'au `package.json`.
 *
 * Un chemin relatif figé (`../..`) mentirait : le module compilé vit dans
 * `dist/src/`, un niveau plus bas que la source. Remonter jusqu'au marqueur
 * donne le même résultat depuis les deux.
 */
function findPackageRoot(from: string): string {
  let current = from;
  for (;;) {
    if (existsSync(join(current, 'package.json'))) return current;
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Racine du paquet introuvable au-dessus de ${from}`);
    }
    current = parent;
  }
}

export const PACKAGE_ROOT = findPackageRoot(dirname(fileURLToPath(import.meta.url)));

export const PATHS = {
  /** Les fichiers de contenu, source unique du portfolio. */
  content: join(PACKAGE_ROOT, 'content'),
  /** Les tokens de design, instantané du dépôt hub (voir `check:tokens`). */
  designTokens: join(PACKAGE_ROOT, 'design', 'tokens.json'),
  /** Les polices embarquées dans le PDF. */
  fonts: join(PACKAGE_ROOT, 'assets', 'fonts'),
  /** Les artefacts rendus au build : les CV PDF et leur manifeste. */
  artifacts: join(PACKAGE_ROOT, 'artifacts'),
  /** Le contrat OpenAPI figé dans le dépôt, pour être relu en revue. */
  contract: join(PACKAGE_ROOT, 'contracts', 'openapi.json'),
} as const;

const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

/**
 * Les en-têtes de cache.
 *
 * Le contenu est immuable pour la durée de vie d'un déploiement : il n'est
 * relu qu'au démarrage. Une fraîcheur courte doublée d'un long
 * `stale-while-revalidate` donne donc le bon compromis — un client garde une
 * réponse utilisable même quand l'instance est à zéro, et revalide en fond
 * avec son `ETag`.
 */
export const CACHE_CONTROL = {
  content: `public, max-age=${String(5 * MINUTE_IN_SECONDS)}, stale-while-revalidate=${String(DAY_IN_SECONDS)}`,
  cv: `public, max-age=${String(HOUR_IN_SECONDS)}, stale-while-revalidate=${String(7 * DAY_IN_SECONDS)}`,
  contract: `public, max-age=${String(5 * MINUTE_IN_SECONDS)}`,
  none: 'no-store',
} as const;

/**
 * La longueur du condensat retenu pour les `ETag` et la version de contenu.
 *
 * 128 bits de SHA-256 en base64url : la collision est hors de portée, et
 * l'en-tête reste lisible dans un journal. Un `ETag` plus court n'économise
 * rien d'utile, plus long ne protège de rien de plus.
 */
export const DIGEST_LENGTH = 22;

export const SERVER = {
  defaultPort: 8080,
  /** Cloud Run impose le port par l'environnement ; il ne se devine pas. */
  portEnvVar: 'PORT',
} as const;

export function resolvePort(env: NodeJS.ProcessEnv): number {
  const raw = env[SERVER.portEnvVar];
  if (raw === undefined || raw === '') return SERVER.defaultPort;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${SERVER.portEnvVar} invalide : ${JSON.stringify(raw)}`);
  }
  return parsed;
}

/** Le dépôt hub, source de vérité des tokens de design. */
export const DESIGN_TOKENS_SOURCE = {
  rawUrl: 'https://raw.githubusercontent.com/Boris-David/portfolio/main/design/tokens.json',
  /** Le même fichier dans le workspace local, quand les dépôts sont côte à côte. */
  siblingPath: resolve(PACKAGE_ROOT, '..', 'design', 'tokens.json'),
} as const;
