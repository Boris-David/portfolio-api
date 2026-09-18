import type { CvBody, CvLookup, CvStore } from './store.js';

/**
 * A store with nothing to serve, which says so.
 *
 * It exists for the contexts where a résumé makes no sense — generating the
 * OpenAPI contract, for instance, which describes the route without having to
 * serve it. A `null` or a silent double would suggest availability; here the
 * reason is carried all the way to the client.
 */
export function unavailableCvStore(reason: string): CvStore {
  const lookup: CvLookup = { status: 'unavailable', reason };
  return {
    describe: (): Promise<CvLookup> => Promise.resolve(lookup),
    open: (): Promise<CvBody> => Promise.resolve(null),
  };
}
