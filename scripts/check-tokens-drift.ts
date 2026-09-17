/**
 * Vérifie que l'instantané des tokens de design n'a pas dérivé de l'original.
 *
 * Les tokens appartiennent au dépôt hub (ADR 0001), mais ce dépôt doit se
 * cloner et se construire seul : il en porte donc une copie. Une copie sans
 * garde devient une seconde source de vérité — c'est exactement ce que l'ADR
 * 0002 dit de l'instantané embarqué côté iOS, et le remède est le même : la CI
 * compare, et échoue si ça diverge.
 *
 * La comparaison se fait contre le dépôt hub voisin quand il est présent
 * (développement local, éventuellement hors ligne), sinon contre `main` sur
 * GitHub (CI).
 */
import { existsSync, readFileSync } from 'node:fs';
import { DESIGN_TOKENS_SOURCE, PATHS } from '../src/node/paths.js';

const local = readFileSync(PATHS.designTokens, 'utf8');

const { reference, origin } = await readReference();

if (normalise(local) === normalise(reference)) {
  console.log(`[tokens] instantané conforme à ${origin}`);
} else {
  console.error(
    `[tokens] ${PATHS.designTokens} a dérivé de ${origin}.\n` +
      `         Les tokens appartiennent au hub : recopier l'original, ` +
      `ne pas modifier l'instantané.`,
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
      `Tokens du hub inaccessibles (${String(response.status)}) : ${DESIGN_TOKENS_SOURCE.rawUrl}`,
    );
  }
  return { reference: await response.text(), origin: DESIGN_TOKENS_SOURCE.rawUrl };
}

/** Compare le contenu, pas la mise en forme : un JSON reformaté n'a pas dérivé. */
function normalise(raw: string): string {
  return JSON.stringify(JSON.parse(raw));
}
