import type { Locale } from '../domain/locale.js';
import type { CvDescription } from './manifest.js';

/**
 * Le magasin de CV, vu par la couche HTTP.
 *
 * Deux opérations, et c'est délibéré : **décrire** ne lit pas les 330 Ko du
 * PDF. Une requête de revalidation — celle qui repart en `304` — n'a besoin
 * que de l'`ETag`, et il serait absurde de télécharger le document pour
 * répondre « vous l'avez déjà ».
 */
export type CvLookup =
  | { readonly status: 'ready'; readonly description: CvDescription }
  | { readonly status: 'unavailable'; readonly reason: string };

/** Les octets d'un CV. `null` quand l'asset annoncé n'est pas dans le magasin. */
export type CvBody = ReadableStream<Uint8Array> | ArrayBuffer | null;

export interface CvStore {
  /** Les métadonnées scellées au rendu, sans lire le PDF. */
  describe(locale: Locale): Promise<CvLookup>;
  /** Les octets, seulement quand le client ne les a pas déjà. */
  open(description: CvDescription): Promise<CvBody>;
}
