import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, type Locale } from '../domain/locale.js';
import type { Portfolio } from '../domain/portfolio.js';
import { CV_DIRECTORY, cvFileName, type CvManifest } from './artifacts.js';
import { buildCvDocument } from './model.js';
import type { CvRenderer } from './renderer.js';
import { renderCvHtml } from './template.js';
import { loadDesignTokens, type DesignTokens } from './tokens.js';

/**
 * La fabrique des CV : contenu + tokens → HTML → PDF.
 *
 * Elle est déclenchée par le **build**, jamais par une requête (ADR 0004).
 * Le manifeste qu'elle écrit scelle la version de contenu rendue : c'est ce
 * qui permet au serveur de refuser de servir un PDF qui ne correspond plus.
 */
export function buildCvHtml(
  portfolio: Portfolio,
  locale: Locale,
  tokens: DesignTokens = loadDesignTokens(),
): string {
  return renderCvHtml(buildCvDocument(portfolio, locale), tokens);
}

export interface RenderedCv {
  readonly locale: Locale;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export async function renderAllCvs(
  portfolio: Readonly<Record<Locale, Portfolio>>,
  renderer: CvRenderer,
  tokens: DesignTokens = loadDesignTokens(),
): Promise<readonly RenderedCv[]> {
  const rendered: RenderedCv[] = [];
  for (const locale of LOCALES) {
    const content = portfolio[locale];
    const html = buildCvHtml(content, locale, tokens);
    rendered.push({
      locale,
      fileName: cvFileName(content.profile.name.full, locale),
      bytes: await renderer.render(html),
    });
  }
  return rendered;
}

export function writeCvArtifacts(
  rendered: readonly RenderedCv[],
  contentVersion: string,
  directory: string = CV_DIRECTORY,
): CvManifest {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });

  for (const cv of rendered) {
    writeFileSync(join(directory, cv.fileName), cv.bytes);
  }

  const manifest: CvManifest = {
    contentVersion,
    renderedAt: new Date().toISOString(),
    files: rendered.map((cv) => ({
      locale: cv.locale,
      file: cv.fileName,
      bytes: cv.bytes.byteLength,
    })),
  };
  writeFileSync(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
