/**
 * Les valeurs de configuration du **runtime**, nommées et rassemblées.
 *
 * Ce module doit rester exécutable sur Cloudflare Workers : il n'importe donc
 * rien de `node:fs`, `node:path` ni `node:url`. Les chemins disque, qui ne
 * servent qu'au build et aux tests, vivent dans `src/node/paths.ts` — et
 * l'ESLint du dépôt refuse qu'ils remontent ici.
 *
 * Aucun littéral de cache ne traîne ailleurs : une valeur magique dispersée
 * est une valeur qu'on ne peut plus changer sans la chercher partout.
 */

const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

/**
 * Les en-têtes de cache.
 *
 * Le contenu est figé pour la durée d'un déploiement : il est embarqué dans le
 * script, donc il ne peut pas changer sous les pieds d'un isolat. Une fraîcheur
 * courte doublée d'un long `stale-while-revalidate` donne le bon compromis —
 * un client garde une réponse utilisable et revalide en fond avec son `ETag`.
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

/**
 * Le préfixe des CV dans le magasin d'assets statiques.
 *
 * Les PDF ne peuvent pas vivre dans le script — le plan gratuit le limite à
 * 1 Mo compressé et chaque CV pèse ~330 Ko. Ils sont donc déposés dans les
 * **Workers Static Assets**, et le Worker les relaie depuis ce préfixe.
 */
export const CV_ASSET_PREFIX = '/cv';

export const CV_MANIFEST_ASSET = `${CV_ASSET_PREFIX}/manifest.json`;
