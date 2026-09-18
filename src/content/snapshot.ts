import { envelope } from '../domain/envelope.js';
import { LOCALES, type Locale } from '../domain/locale.js';
import type { Portfolio } from '../domain/portfolio.js';
import { RESOURCE_VIEWS, RESOURCES, type ResourceId } from '../domain/resources.js';
import { strongETag } from './digest.js';
import { kebabCase, loadContent, type LoadedContent } from './loader.js';

/** Le segment d'URL d'une ressource. */
export function resourcePath(resource: ResourceId): string {
  return kebabCase(resource);
}

/**
 * Une représentation prête à partir : le corps sérialisé et son `ETag`.
 *
 * Elle est calculée **au démarrage**, pas à la requête. Le contenu est
 * immuable pour la vie du processus : re-sérialiser et re-condenser à chaque
 * appel serait un travail refait à l'identique, et surtout un `ETag` qu'on ne
 * pourrait plus comparer avant d'avoir produit le corps — donc un `304` qui
 * coûterait le prix d'un `200`.
 */
export interface Representation {
  readonly body: string;
  readonly etag: string;
}

export interface ContentSnapshot {
  readonly version: string;
  readonly portfolio: Readonly<Record<Locale, Portfolio>>;
  representation(resource: ResourceId, locale: Locale): Representation;
}

/** Charge le contenu et pré-calcule toutes les représentations servies. */
export function buildSnapshot(loaded: LoadedContent = loadContent()): ContentSnapshot {
  const representations = new Map<string, Representation>();

  for (const locale of LOCALES) {
    const portfolio = loaded.portfolio[locale];
    for (const resource of RESOURCES) {
      // Every resource is a view over the same loaded aggregate — including the
      // derived ones. Nothing here holds a second copy of the content.
      const data: unknown = RESOURCE_VIEWS[resource].select(portfolio);
      const body = JSON.stringify(envelope(locale, loaded.version, data));
      representations.set(keyOf(resource, locale), { body, etag: strongETag(body) });
    }
  }

  return {
    version: loaded.version,
    portfolio: loaded.portfolio,
    representation(resource, locale) {
      const found = representations.get(keyOf(resource, locale));
      /* v8 ignore next 3 -- les clés viennent des mêmes listes que le remplissage. */
      if (found === undefined) {
        throw new Error(`Représentation absente : ${resource} / ${locale}`);
      }
      return found;
    },
  };
}

function keyOf(resource: ResourceId, locale: Locale): string {
  return `${resource}:${locale}`;
}
