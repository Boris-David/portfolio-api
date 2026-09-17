import { serve } from '@hono/node-server';
import { resolvePort } from './config.js';
import { composeDependencies } from './composition.js';
import { createApp } from './http/app.js';

/**
 * Le démarrage.
 *
 * Le contenu est chargé et validé **avant** que le port ne s'ouvre : une
 * instance qui démarre est une instance dont tout le contenu est valide. Un
 * contenu cassé fait échouer le déploiement, pas les requêtes des lecteurs.
 */
const dependencies = composeDependencies();
const app = createApp(dependencies);
const port = resolvePort(process.env);

if (dependencies.cv.status === 'unavailable') {
  // Pas fatal : le contenu reste servi. Mais jamais silencieux — la route CV
  // répondra 503 et /health signalera « degraded ».
  console.warn(`[cv] indisponible — ${dependencies.cv.reason}`);
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(
    `[api] contenu ${dependencies.snapshot.version} servi sur http://localhost:${String(info.port)}`,
  );
});
