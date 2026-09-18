import { z } from 'zod';
import { CV_ASSET_PREFIX } from '../config.js';
import { LOCALES, LocaleSchema, type Locale } from '../domain/locale.js';

/**
 * The manifest of the rendered résumés.
 *
 * It carries the **content version** as of render time. That is the piece that
 * makes ADR 0004's promise checkable: "rendering is triggered by a content
 * change". The API compares that version against the content it bundles; if
 * they differ, the PDF no longer describes what the API serves, and it must
 * not be served.
 *
 * It also carries the digest of each résumé's **source HTML**, which is used
 * as the `ETag` (see `CvDescription.etag`).
 */
export const CvManifestSchema = z.object({
  contentVersion: z.string().min(1),
  renderedAt: z.iso.datetime(),
  files: z
    .array(
      z.object({
        locale: LocaleSchema,
        file: z.string().min(1),
        bytes: z.number().int().positive(),
        sourceDigest: z.string().min(1),
      }),
    )
    .length(LOCALES.length),
});

export type CvManifest = z.infer<typeof CvManifestSchema>;

/**
 * The résumé file name prefix.
 *
 * It is not derived from the full name: "Amissan Boris-David Amoussou-Guenou"
 * would give an endless file name in a share sheet. This is a short form, and
 * it was chosen.
 */
const CV_FILE_PREFIX = 'amissan.ag-cv';

/**
 * The downloaded file's name, for one language.
 *
 * This name matters more than it looks: on iOS, Safari ignores
 * `Content-Disposition` for the share sheet and picks up the **last segment of
 * the URL**. That is why the résumé route carries exactly this name, and not
 * just the language — a path like `/v1/cv/fr.pdf` showed up as "fr" when
 * shared.
 */
export function cvFileName(locale: Locale): string {
  return `${CV_FILE_PREFIX}-${locale}.pdf`;
}

/** A résumé's path in the static asset store. */
export function cvAssetPath(file: string): string {
  return `${CV_ASSET_PREFIX}/${file}`;
}

export interface CvDescription {
  readonly locale: Locale;
  /** Where to read the bytes in the asset store. */
  readonly assetPath: string;
  /** The name offered on download. */
  readonly fileName: string;
  /**
   * The `ETag`, taken from the source HTML digest sealed at render time — and
   * not from the PDF's bytes: Chromium timestamps them, so two renders of
   * identical content would produce two different `ETag`s and make the
   * document be re-downloaded for nothing.
   */
  readonly etag: string;
}

/**
 * The state of the résumés, as the API sees it.
 *
 * Unavailability is a **named state**, not an exception: a missing or stale
 * résumé must not stop the API from serving content, but it must not be served
 * in silence either. The route then answers `503` saying exactly what to do,
 * and `/health` reports it.
 */
export type CvCatalogue =
  | { readonly status: 'ready'; readonly entries: Readonly<Record<Locale, CvDescription>> }
  | { readonly status: 'unavailable'; readonly reason: string };

/**
 * Reads a manifest and derives the catalogue from it, or the exact reason it
 * is unavailable. A pure function: no store access, no network.
 */
export function readCvCatalogue(document: unknown, expectedContentVersion: string): CvCatalogue {
  const manifest = CvManifestSchema.safeParse(document);
  if (!manifest.success) {
    return {
      status: 'unavailable',
      reason: `Manifeste de CV illisible : ${z.prettifyError(manifest.error)}`,
    };
  }

  if (manifest.data.contentVersion !== expectedContentVersion) {
    return {
      status: 'unavailable',
      reason:
        `CV périmé : rendu pour le contenu ${manifest.data.contentVersion}, ` +
        `l'API sert ${expectedContentVersion}. Relancer « npm run build:cv » et redéployer.`,
    };
  }

  const entries: Partial<Record<Locale, CvDescription>> = {};
  for (const file of manifest.data.files) {
    entries[file.locale] = {
      locale: file.locale,
      assetPath: cvAssetPath(file.file),
      fileName: cvFileName(file.locale),
      etag: `"${file.sourceDigest}"`,
    };
  }

  const missing = LOCALES.filter((locale) => entries[locale] === undefined);
  if (missing.length > 0) {
    return {
      status: 'unavailable',
      reason: `Langues absentes du manifeste : ${missing.join(', ')}`,
    };
  }

  return { status: 'ready', entries: entries as Record<Locale, CvDescription> };
}
