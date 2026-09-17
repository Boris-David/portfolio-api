import type { Context } from 'hono';
import { buildSnapshot } from './content/snapshot.js';
import { createAssetsCvStore, type AssetFetcher } from './cv/assets-store.js';
import { DEFAULT_LOCALE } from './domain/locale.js';
import { createApp } from './http/app.js';

/**
 * L'entrée Cloudflare Workers.
 *
 * Le contenu est validé **au démarrage de l'isolat**, avant la première
 * requête : un contenu cassé fait échouer le déploiement, pas les requêtes des
 * lecteurs. Il est embarqué dans le script, donc il n'y a ni lecture disque ni
 * appel réseau à faire — et les isolats V8 n'ont pas de démarrage à froid à
 * amortir.
 *
 * Les CV, eux, ne peuvent pas être dans le script : ~330 Ko chacun contre 1 Mo
 * compressé de plafond. Ils vivent dans les **Workers Static Assets**, publiés
 * avec le Worker, et sont relayés par la route CV.
 */
interface WorkerBindings {
  /** Le magasin d'assets statiques, déclaré dans `wrangler.jsonc`. */
  readonly ASSETS: AssetFetcher;
}

const snapshot = buildSnapshot();
const fullName = snapshot.portfolio[DEFAULT_LOCALE].profile.name.full;

/**
 * Le binding d'assets, exigé explicitement.
 *
 * Sans lui, la route CV échouerait par un `undefined` illisible en pleine
 * requête. Une erreur nommée dit tout de suite ce qui manque et où le déclarer.
 */
function assetsOf(context: Context): AssetFetcher {
  const bindings = context.env as Partial<WorkerBindings>;
  const assets = bindings.ASSETS;
  if (assets === undefined) {
    throw new Error(
      'Le binding « ASSETS » est absent : déclarer `assets.binding` dans wrangler.jsonc.',
    );
  }
  return assets;
}

const app = createApp({
  snapshot,
  cv: (context) =>
    createAssetsCvStore(
      assetsOf(context),
      new URL(context.req.url).origin,
      snapshot.version,
      fullName,
    ),
});

export default { fetch: app.fetch };
