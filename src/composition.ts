import { buildSnapshot, type ContentSnapshot } from './content/snapshot.js';
import { loadCvLibrary, type CvLibrary } from './cv/artifacts.js';
import { DEFAULT_LOCALE } from './domain/locale.js';
import type { AppDependencies } from './http/app.js';

/**
 * La racine de composition : le seul endroit qui touche le disque.
 *
 * Elle existe pour que `createApp` n'ait aucune dépendance sur un
 * environnement — ni chemin, ni fichier, ni horloge. Tout ce qui est
 * lu l'est **une fois**, ici, au démarrage.
 */
export function composeDependencies(): AppDependencies {
  const snapshot: ContentSnapshot = buildSnapshot();
  const cv: CvLibrary = loadCvLibrary(
    snapshot.version,
    snapshot.portfolio[DEFAULT_LOCALE].profile.name.full,
  );
  return { snapshot, cv };
}
