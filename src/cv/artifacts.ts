import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { PATHS } from '../config.js';
import { LOCALES, LocaleSchema, type Locale } from '../domain/locale.js';

/**
 * Le manifeste des CV rendus.
 *
 * Il porte la **version de contenu** au moment du rendu. C'est la pièce qui
 * rend la promesse de l'ADR 0004 vérifiable : « le rendu est déclenché par le
 * changement de contenu ». Au démarrage, l'API compare cette version à celle
 * du contenu qu'elle vient de charger ; si elles diffèrent, le PDF ne décrit
 * plus ce que l'API sert, et il ne doit pas être servi.
 */
const ManifestSchema = z.object({
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

export type CvManifest = z.infer<typeof ManifestSchema>;

export const CV_DIRECTORY = join(PATHS.artifacts, 'cv');
export const MANIFEST_FILE = join(CV_DIRECTORY, 'manifest.json');

/** Le nom du fichier téléchargé, dérivé du nom porté par le contenu. */
export function cvFileName(fullName: string, locale: Locale): string {
  const slug = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-cv-${locale}.pdf`;
}

export interface CvArtifact {
  readonly locale: Locale;
  readonly bytes: Uint8Array;
  readonly etag: string;
  readonly fileName: string;
}

/**
 * La bibliothèque de CV, telle que le serveur la voit au démarrage.
 *
 * L'indisponibilité est un **état nommé**, pas une exception au démarrage :
 * un CV absent ou périmé ne doit pas empêcher l'API de servir le contenu, mais
 * il ne doit pas non plus être servi en silence. La route répond alors `503`
 * en disant exactement quoi faire, et `/health` le signale.
 */
export type CvLibrary =
  | { readonly status: 'ready'; readonly artifacts: Readonly<Record<Locale, CvArtifact>> }
  | { readonly status: 'unavailable'; readonly reason: string };

export function loadCvLibrary(
  expectedContentVersion: string,
  fullName: string,
  directory: string = CV_DIRECTORY,
): CvLibrary {
  const manifestFile = join(directory, 'manifest.json');
  if (!existsSync(manifestFile)) {
    return {
      status: 'unavailable',
      reason:
        `Aucun CV rendu (${manifestFile} absent). Lancer « npm run build:cv » — ` +
        `le rendu est déclenché par le changement de contenu, jamais par la requête.`,
    };
  }

  const manifest = ManifestSchema.safeParse(JSON.parse(readFileSync(manifestFile, 'utf8')));
  if (!manifest.success) {
    return {
      status: 'unavailable',
      reason: `Manifeste illisible : ${z.prettifyError(manifest.error)}`,
    };
  }

  if (manifest.data.contentVersion !== expectedContentVersion) {
    return {
      status: 'unavailable',
      reason:
        `CV périmé : rendu pour le contenu ${manifest.data.contentVersion}, ` +
        `l'API sert ${expectedContentVersion}. Relancer « npm run build:cv ».`,
    };
  }

  const artifacts: Partial<Record<Locale, CvArtifact>> = {};
  for (const entry of manifest.data.files) {
    const path = join(directory, entry.file);
    if (!existsSync(path)) {
      return { status: 'unavailable', reason: `Fichier annoncé mais absent : ${path}` };
    }
    const bytes = readFileSync(path);
    if (bytes.byteLength !== entry.bytes) {
      return {
        status: 'unavailable',
        reason: `Taille inattendue pour ${entry.file} : ${String(bytes.byteLength)} octets au lieu de ${String(entry.bytes)}.`,
      };
    }
    artifacts[entry.locale] = {
      locale: entry.locale,
      bytes,
      // L'`ETag` reprend l'empreinte du HTML source scellée au rendu, et non
      // celle des octets du PDF : Chromium les horodate, donc deux rendus d'un
      // contenu identique produiraient deux `ETag` différents et feraient
      // retélécharger le document sans raison.
      etag: `"${entry.sourceDigest}"`,
      fileName: cvFileName(fullName, entry.locale),
    };
  }

  const missing = LOCALES.filter((locale) => artifacts[locale] === undefined);
  if (missing.length > 0) {
    return {
      status: 'unavailable',
      reason: `Langues absentes du manifeste : ${missing.join(', ')}`,
    };
  }

  return { status: 'ready', artifacts: artifacts as Record<Locale, CvArtifact> };
}
