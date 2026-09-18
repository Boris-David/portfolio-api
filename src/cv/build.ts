import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { digest } from '../content/digest.js';
import { LOCALES, type Locale } from '../domain/locale.js';
import type { Portfolio } from '../domain/portfolio.js';
import { CV_ASSET_PREFIX } from '../config.js';
import { PATHS } from '../node/paths.js';
import { cvFileName, type CvManifest } from './manifest.js';
import { buildCvDocument } from './model.js';
import type { CvRenderer } from './renderer.js';
import { renderCvHtml } from './template.js';
import { loadDesignTokens, type DesignTokens } from './tokens.js';

/**
 * The résumé factory: content + tokens → HTML → PDF.
 *
 * It is triggered by the **build**, never by a request (ADR 0004) — Chromium
 * does not run on a Worker anyway. The manifest it writes seals the content
 * version that was rendered: that is what lets the API refuse to serve a PDF
 * that no longer matches.
 *
 * The files land in the **Workers Static Assets** directory, published
 * alongside the Worker: the PDFs weigh ~330 KB and the script is capped at
 * 1 MB compressed, so they cannot be bundled into it.
 */

/** The résumé directory inside the asset store. */
export const CV_OUTPUT_DIRECTORY = join(PATHS.assets, CV_ASSET_PREFIX.replace(/^\//, ''));

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
  /**
   * The digest of the **source HTML**, not of the PDF's bytes.
   *
   * Chromium writes a creation date into the PDF: two renders of identical
   * content therefore produce different bytes, and a digest computed over them
   * would change on every build. A client that revalidates would re-download
   * 330 KB for nothing. The HTML, by contrast, depends only on the content and
   * the tokens — it changes exactly when the document changes, and never
   * otherwise.
   */
  readonly sourceDigest: string;
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
      fileName: cvFileName(locale),
      bytes: await renderer.render(html),
      sourceDigest: digest(html),
    });
  }
  return rendered;
}

export function writeCvArtifacts(
  rendered: readonly RenderedCv[],
  contentVersion: string,
  directory: string = CV_OUTPUT_DIRECTORY,
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
      sourceDigest: cv.sourceDigest,
    })),
  };
  writeFileSync(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
