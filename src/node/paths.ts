import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Les chemins disque — **uniquement pour le build et les tests**.
 *
 * Rien de ce qui tourne sur Cloudflare Workers ne passe par ici : un Worker n'a
 * pas de système de fichiers. Tout ce qui vit sous `src/node/` est par
 * construction hors runtime, et l'ESLint du dépôt interdit d'importer
 * `node:fs`, `node:path` ou `node:url` ailleurs dans `src/`.
 */

/**
 * La racine du paquet, trouvée en remontant jusqu'au `package.json`.
 *
 * Un chemin relatif figé mentirait dès que la profondeur du module change ;
 * remonter jusqu'au marqueur donne le même résultat depuis n'importe où.
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
  /**
   * Le répertoire des **Workers Static Assets**, publié avec le Worker.
   * C'est là que le build dépose les CV rendus et leur manifeste.
   */
  assets: join(PACKAGE_ROOT, 'public'),
  /** Le contrat OpenAPI figé dans le dépôt, pour être relu en revue. */
  contract: join(PACKAGE_ROOT, 'contracts', 'openapi.json'),
} as const;

/** Le dépôt hub, source de vérité des tokens de design. */
export const DESIGN_TOKENS_SOURCE = {
  rawUrl: 'https://raw.githubusercontent.com/Boris-David/portfolio/main/design/tokens.json',
  /** Le même fichier dans le workspace local, quand les dépôts sont côte à côte. */
  siblingPath: resolve(PACKAGE_ROOT, '..', 'design', 'tokens.json'),
} as const;
