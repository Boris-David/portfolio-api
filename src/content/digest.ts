import { createHash } from 'node:crypto';
import { DIGEST_LENGTH } from '../config.js';

/**
 * The digest that serves as both content version and `ETag`.
 *
 * It is computed over the **bytes served**, not over a build date: two
 * deployments of unchanged content produce the same `ETag`, so a client that
 * revalidates gets a `304` instead of re-downloading. A timestamped version
 * would break exactly that.
 */
export function digest(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('base64url').slice(0, DIGEST_LENGTH);
}

/** A strong `ETag`, exactly as it goes on the wire — quotes included. */
export function strongETag(input: string | Uint8Array): string {
  return `"${digest(input)}"`;
}

/**
 * True when the request's `If-None-Match` header covers this `ETag`.
 *
 * Handles the comma-separated list, the `*` wildcard and the weak `W/` prefix:
 * a client that revalidates correctly must get its `304`, whichever form it
 * uses.
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
