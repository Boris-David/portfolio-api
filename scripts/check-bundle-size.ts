/**
 * Vérifie que le script du Worker tient sous le plafond du plan gratuit.
 *
 * Le contenu est **embarqué dans le script** : il grossit donc à chaque
 * application ajoutée, à chaque étude de cas. Le plafond n'est pas une
 * abstraction lointaine, c'est une limite qu'un ajout de contenu peut franchir
 * — et le jour où il la franchit, le déploiement échoue sans prévenir.
 *
 * Cette garde le dit avant, avec la marge restante.
 */
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { PACKAGE_ROOT } from '../src/node/paths.js';

const BUNDLE = join(PACKAGE_ROOT, 'dist', 'worker.js');

/** Le plafond du plan gratuit, sur le script **compressé**. */
const LIMIT_BYTES = 1024 * 1024;

const KIB = 1024;
const PERCENT = 100;

if (!existsSync(BUNDLE)) {
  console.error(
    `[bundle] ${BUNDLE} est absent. Lancer « npm run build » — c'est lui qui produit le script.`,
  );
  process.exit(1);
}

const compressed = gzipSync(readFileSync(BUNDLE)).byteLength;
const used = (compressed / LIMIT_BYTES) * PERCENT;

const summary =
  `${(compressed / KIB).toFixed(1)} Kio compressés sur ${String(LIMIT_BYTES / KIB)} Kio ` +
  `(${used.toFixed(1)} %)`;

if (compressed > LIMIT_BYTES) {
  console.error(
    `[bundle] script trop gros : ${summary}.\n` +
      `         Le contenu est embarqué dans le script ; ce qui ne peut pas y tenir ` +
      `va dans les Workers Static Assets, comme les CV.`,
  );
  process.exit(1);
}

console.log(`[bundle] ${summary}`);
