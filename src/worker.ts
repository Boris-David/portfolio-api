import type { Context } from 'hono';
import { buildSnapshot } from './content/snapshot.js';
import { createAssetsCvStore, type AssetFetcher } from './cv/assets-store.js';
import { createApp } from './http/app.js';

/**
 * The Cloudflare Workers entry point.
 *
 * Content is validated **at isolate startup**, before the first request: broken
 * content fails the deployment, not a reader's request. It is bundled into the
 * script, so there is no disk read and no network call to make — and V8
 * isolates have no cold start to amortise.
 *
 * The résumés cannot live in the script: ~330 KB each against a 1 MB
 * compressed ceiling. They live in the **Workers Static Assets**, published
 * alongside the Worker, and the résumé route relays them.
 */
interface WorkerBindings {
  /** The static asset store, declared in `wrangler.jsonc`. */
  readonly ASSETS: AssetFetcher;
}

const snapshot = buildSnapshot();

/**
 * The assets binding, demanded explicitly.
 *
 * Without it the résumé route would fail on an unreadable `undefined` in the
 * middle of a request. A named error says straight away what is missing and
 * where to declare it.
 */
function assetsOf(context: Context): AssetFetcher {
  const bindings = context.env as Partial<WorkerBindings>;
  const assets = bindings.ASSETS;
  if (assets === undefined) {
    throw new Error('The "ASSETS" binding is missing: declare `assets.binding` in wrangler.jsonc.');
  }
  return assets;
}

const app = createApp({
  snapshot,
  cv: (context) =>
    createAssetsCvStore(assetsOf(context), new URL(context.req.url).origin, snapshot.version),
});

export default { fetch: app.fetch };
