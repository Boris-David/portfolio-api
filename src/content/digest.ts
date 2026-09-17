import { createHash } from 'node:crypto';
import { DIGEST_LENGTH } from '../config.js';

/**
 * Le condensat qui sert à la fois de version de contenu et d'`ETag`.
 *
 * Il est calculé sur les **octets servis**, pas sur une date de build : deux
 * déploiements d'un contenu inchangé produisent le même `ETag`, donc un client
 * qui revalide reçoit `304` au lieu de retélécharger. Une version horodatée
 * casserait exactement ça.
 */
export function digest(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('base64url').slice(0, DIGEST_LENGTH);
}

/** Un `ETag` fort, tel qu'il part sur le réseau — guillemets compris. */
export function strongETag(input: string | Uint8Array): string {
  return `"${digest(input)}"`;
}

/**
 * Vrai si l'en-tête `If-None-Match` de la requête couvre cet `ETag`.
 *
 * Gère la liste séparée par des virgules, le joker `*` et le préfixe faible
 * `W/` : un client qui revalide correctement doit obtenir son `304`, quelle
 * que soit la forme qu'il emploie.
 */
export function matchesETag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (ifNoneMatch === undefined) return false;
  const candidates = ifNoneMatch.split(',').map((value) => value.trim());
  if (candidates.includes('*')) return true;
  return candidates.some((candidate) => stripWeakPrefix(candidate) === stripWeakPrefix(etag));
}

function stripWeakPrefix(etag: string): string {
  return etag.startsWith('W/') ? etag.slice('W/'.length) : etag;
}
