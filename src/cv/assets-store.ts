import { CV_MANIFEST_ASSET } from '../config.js';
import type { Locale } from '../domain/locale.js';
import { readCvCatalogue, type CvCatalogue, type CvDescription } from './manifest.js';
import type { CvBody, CvLookup, CvStore } from './store.js';

/**
 * The static asset store, seen as a dependency.
 *
 * A minimal interface rather than Cloudflare's `Fetcher` type: it describes
 * exactly what we use, and a test can satisfy it with an object literal — with
 * no Worker to spin up.
 */
export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

const NOT_FOUND = 404;

/**
 * The résumé store backed by the **Workers Static Assets**.
 *
 * The PDFs cannot live in the script — the free plan caps it at 1 MB
 * compressed, and each résumé weighs ~330 KB. So they are published alongside
 * the Worker, which relays them.
 *
 * The manifest is read **once per isolate**: assets are immutable for the
 * lifetime of a deployment, so re-reading it on every request would redo the
 * same work for the same result. An unavailable catalogue is memoised too — it
 * will stay unavailable until the next deployment, by construction.
 */
export function createAssetsCvStore(
  assets: AssetFetcher,
  origin: string,
  expectedContentVersion: string,
): CvStore {
  let catalogue: Promise<CvCatalogue> | null = null;

  const load = async (): Promise<CvCatalogue> => {
    const response = await assets.fetch(new Request(new URL(CV_MANIFEST_ASSET, origin)));
    if (response.status === NOT_FOUND) {
      return {
        status: 'unavailable',
        reason:
          `Aucun CV publié : ${CV_MANIFEST_ASSET} est absent du magasin d'assets. ` +
          `Lancer « npm run build:cv » avant de déployer — le rendu est déclenché ` +
          `par le changement de contenu, jamais par la requête.`,
      };
    }
    if (!response.ok) {
      return {
        status: 'unavailable',
        reason: `Le magasin d'assets a répondu ${String(response.status)} pour ${CV_MANIFEST_ASSET}.`,
      };
    }
    return readCvCatalogue(await response.json(), expectedContentVersion);
  };

  return {
    async describe(locale: Locale): Promise<CvLookup> {
      catalogue ??= load();
      const resolved = await catalogue;
      if (resolved.status === 'unavailable') {
        return { status: 'unavailable', reason: resolved.reason };
      }
      return { status: 'ready', description: resolved.entries[locale] };
    },

    async open(description: CvDescription): Promise<CvBody> {
      const response = await assets.fetch(new Request(new URL(description.assetPath, origin)));
      return response.ok ? response.body : null;
    },
  };
}
