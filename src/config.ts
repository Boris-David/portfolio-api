/**
 * The **runtime** configuration values, named and gathered in one place.
 *
 * This module has to stay runnable on Cloudflare Workers, so it imports
 * nothing from `node:fs`, `node:path` or `node:url`. Disk paths, which only
 * the build and the tests need, live in `src/node/paths.ts` — and the repo's
 * ESLint config refuses to let them climb back in here.
 *
 * No cache literal is left lying around anywhere else: a magic value scattered
 * across files is a value you can no longer change without hunting it down
 * everywhere.
 */

const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

/**
 * The cache headers.
 *
 * Content is frozen for the lifetime of a deployment: it is bundled into the
 * script, so it cannot change under an isolate's feet. A short freshness
 * window paired with a long `stale-while-revalidate` strikes the right
 * balance — a client keeps a usable response and revalidates in the background
 * with its `ETag`.
 */
export const CACHE_CONTROL = {
  content: `public, max-age=${String(5 * MINUTE_IN_SECONDS)}, stale-while-revalidate=${String(DAY_IN_SECONDS)}`,
  cv: `public, max-age=${String(HOUR_IN_SECONDS)}, stale-while-revalidate=${String(7 * DAY_IN_SECONDS)}`,
  contract: `public, max-age=${String(5 * MINUTE_IN_SECONDS)}`,
  none: 'no-store',
} as const;

/**
 * How much of the digest is kept for `ETag`s and the content version.
 *
 * 128 bits of SHA-256 in base64url: a collision is out of reach, and the
 * header stays readable in a log. A shorter `ETag` saves nothing worth having,
 * a longer one protects against nothing more.
 */
export const DIGEST_LENGTH = 22;

/**
 * The prefix under which résumés live in the static asset store.
 *
 * The PDFs cannot live in the script — the free plan caps it at 1 MB
 * compressed and each résumé weighs ~330 KB. They go into the **Workers Static
 * Assets** instead, and the Worker relays them from this prefix.
 */
export const CV_ASSET_PREFIX = '/cv';

export const CV_MANIFEST_ASSET = `${CV_ASSET_PREFIX}/manifest.json`;
