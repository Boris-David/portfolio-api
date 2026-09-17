import type { CvBody, CvLookup, CvStore } from './store.js';

/**
 * Un magasin qui n'a rien à servir, et le dit.
 *
 * Il existe pour les contextes où le CV n'a aucun sens — générer le contrat
 * OpenAPI, par exemple, qui décrit la route sans avoir à la servir. Un `null`
 * ou un double silencieux laisserait croire à une disponibilité ; ici la raison
 * est portée jusqu'au client.
 */
export function unavailableCvStore(reason: string): CvStore {
  const lookup: CvLookup = { status: 'unavailable', reason };
  return {
    describe: (): Promise<CvLookup> => Promise.resolve(lookup),
    open: (): Promise<CvBody> => Promise.resolve(null),
  };
}
