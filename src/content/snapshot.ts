import { envelope } from '../domain/envelope.js';
import { LOCALES, type Locale } from '../domain/locale.js';
import type { Portfolio } from '../domain/portfolio.js';
import { RESOURCE_VIEWS, RESOURCES, type ResourceId } from '../domain/resources.js';
import { strongETag } from './digest.js';
import { kebabCase, loadContent, type LoadedContent } from './loader.js';

/** A resource's URL segment. */
export function resourcePath(resource: ResourceId): string {
  return kebabCase(resource);
}

/**
 * A representation ready to go out: the serialised body and its `ETag`.
 *
 * It is computed **at startup**, not per request. The content is immutable for
 * the lifetime of the process: re-serialising and re-hashing on every call
 * would be identical work redone, and above all an `ETag` that could no longer
 * be compared before producing the body — so a `304` that costs the price of a
 * `200`.
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

/** Loads the content and precomputes every representation served. */
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
      /* v8 ignore next 3 -- the keys come from the same lists that filled the map. */
      if (found === undefined) {
        throw new Error(`Missing representation: ${resource} / ${locale}`);
      }
      return found;
    },
  };
}

function keyOf(resource: ResourceId, locale: Locale): string {
  return `${resource}:${locale}`;
}
