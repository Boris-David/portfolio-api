import { CV_MANIFEST_ASSET } from '../config.js';
import type { Locale } from '../domain/locale.js';
import { readCvCatalogue, type CvCatalogue, type CvDescription } from './manifest.js';
import type { CvBody, CvLookup, CvStore } from './store.js';

/**
 * Le magasin d'assets statiques, vu comme une dépendance.
 *
 * Interface minimale plutôt que le type `Fetcher` de Cloudflare : elle décrit
 * exactement ce dont on se sert, et un test peut la satisfaire avec un objet
 * littéral — sans monter de Worker.
 */
export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

const NOT_FOUND = 404;

/**
 * Le magasin de CV adossé aux **Workers Static Assets**.
 *
 * Les PDF ne peuvent pas vivre dans le script — le plan gratuit le plafonne à
 * 1 Mo compressé, et chaque CV pèse ~330 Ko. Ils sont donc publiés à côté du
 * Worker, qui les relaie.
 *
 * Le manifeste est lu **une fois par isolat** : les assets sont immuables pour
 * la durée d'un déploiement, donc le relire à chaque requête referait le même
 * travail pour le même résultat. Un catalogue indisponible est mémorisé lui
 * aussi — il le restera jusqu'au prochain déploiement, par construction.
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
