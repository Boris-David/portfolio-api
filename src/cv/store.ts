import type { Locale } from '../domain/locale.js';
import type { CvDescription } from './manifest.js';

/**
 * The résumé store, as the HTTP layer sees it.
 *
 * Two operations, deliberately: **describing** does not read the PDF's 330 KB.
 * A revalidation request — the one that leaves as a `304` — needs only the
 * `ETag`, and downloading the document to answer "you already have it" would
 * be absurd.
 */
export type CvLookup =
  | { readonly status: 'ready'; readonly description: CvDescription }
  | { readonly status: 'unavailable'; readonly reason: string };

/** A résumé's bytes. `null` when the announced asset is not in the store. */
export type CvBody = ReadableStream<Uint8Array> | ArrayBuffer | null;

export interface CvStore {
  /** The metadata sealed at render time, without reading the PDF. */
  describe(locale: Locale): Promise<CvLookup>;
  /** The bytes, only when the client does not already have them. */
  open(description: CvDescription): Promise<CvBody>;
}
