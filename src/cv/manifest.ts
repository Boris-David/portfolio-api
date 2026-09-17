import { z } from 'zod';
import { CV_ASSET_PREFIX } from '../config.js';
import { LOCALES, LocaleSchema, type Locale } from '../domain/locale.js';

/**
 * Le manifeste des CV rendus.
 *
 * Il porte la **version de contenu** au moment du rendu. C'est la pièce qui
 * rend la promesse de l'ADR 0004 vérifiable : « le rendu est déclenché par le
 * changement de contenu ». L'API compare cette version à celle du contenu
 * qu'elle embarque ; si elles diffèrent, le PDF ne décrit plus ce que l'API
 * sert, et il ne doit pas être servi.
 *
 * Il porte aussi l'empreinte du **HTML source** de chaque CV, qui sert d'`ETag`
 * (voir `CvDescription.etag`).
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
 * Le préfixe du nom de fichier du CV.
 *
 * Il ne se dérive pas du nom complet : « Amissan Boris-David Amoussou-Guenou »
 * donnerait un fichier interminable dans une feuille de partage. C'est une
 * forme courte, choisie.
 */
const CV_FILE_PREFIX = 'amissan.ag-cv';

/**
 * Le nom du fichier téléchargé, pour une langue.
 *
 * Ce nom compte plus qu'il n'en a l'air : sur iOS, Safari ignore
 * `Content-Disposition` pour la feuille de partage et reprend le **dernier
 * segment de l'URL**. C'est pourquoi la route du CV porte exactement ce
 * nom-là, et pas la langue seule — un chemin en `/v1/cv/fr.pdf` faisait
 * apparaître « fr » au partage.
 */
export function cvFileName(locale: Locale): string {
  return `${CV_FILE_PREFIX}-${locale}.pdf`;
}

/** Le chemin d'un CV dans le magasin d'assets statiques. */
export function cvAssetPath(file: string): string {
  return `${CV_ASSET_PREFIX}/${file}`;
}

export interface CvDescription {
  readonly locale: Locale;
  /** Où lire les octets dans le magasin d'assets. */
  readonly assetPath: string;
  /** Le nom proposé au téléchargement. */
  readonly fileName: string;
  /**
   * L'`ETag`, repris de l'empreinte du HTML source scellée au rendu — et non
   * des octets du PDF : Chromium les horodate, donc deux rendus d'un contenu
   * identique produiraient deux `ETag` différents et feraient retélécharger le
   * document sans raison.
   */
  readonly etag: string;
}

/**
 * L'état des CV, tel que l'API le voit.
 *
 * L'indisponibilité est un **état nommé**, pas une exception : un CV absent ou
 * périmé ne doit pas empêcher l'API de servir le contenu, mais il ne doit pas
 * non plus être servi en silence. La route répond alors `503` en disant
 * exactement quoi faire, et `/health` le signale.
 */
export type CvCatalogue =
  | { readonly status: 'ready'; readonly entries: Readonly<Record<Locale, CvDescription>> }
  | { readonly status: 'unavailable'; readonly reason: string };

/**
 * Lit un manifeste et en déduit le catalogue, ou la raison exacte de son
 * indisponibilité. Fonction pure : aucun accès au magasin, aucun réseau.
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
