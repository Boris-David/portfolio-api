import { chromium, type Browser } from 'playwright';
import { assertCharactersAreCovered } from './fonts.js';

/**
 * The résumé rendering port.
 *
 * The template, the model and the build command know only this interface: the
 * engine is a replaceable detail, and genuinely so — the day another engine
 * renders better, nothing else moves.
 */
export interface CvRenderer {
  render(html: string): Promise<Uint8Array>;
  close(): Promise<void>;
}

const PDF_OPTIONS = {
  printBackground: true,
  /**
   * Page size and margins come from the template's `@page` rule, not from
   * options passed here: layout belongs to the template, which is the one
   * place to read to know what the document looks like.
   */
  preferCSSPageSize: true,
} as const;

/**
 * Rendering through headless Chromium.
 *
 * **Why a browser.** The résumé and the website have to drink from the same
 * tokens (ADR 0004). A third-party PDF engine would force the layout to be
 * rewritten in another box model: two engines, therefore two renderings that
 * slowly drift apart. Chromium lays the résumé out with **the engine that lays
 * the website out** — the form cannot drift because there is only one
 * computation.
 *
 * **The weight and the cold start.** Neither is paid, because Chromium is
 * never where the API runs. Playwright is a dev dependency, and rendering
 * lives in CI, which then publishes the Worker and its assets. A Worker could
 * not launch a browser anyway: the ADR's constraint — "rendering is triggered
 * by a content change, never by a request" — is therefore held by the
 * platform, not by discipline. And a V8 isolate has nothing to boot on wake.
 */
export async function createChromiumRenderer(): Promise<CvRenderer> {
  const browser: Browser = await chromium.launch();
  return {
    async render(html: string): Promise<Uint8Array> {
      assertCharactersAreCovered(stripTags(html));
      const page = await browser.newPage();
      try {
        // `setContent` rather than a file: the document is self-contained —
        // fonts included — so it has no base URL and no disk access to
        // resolve, and the rendering is identical everywhere.
        await page.setContent(html, { waitUntil: 'load' });
        await page.emulateMedia({ media: 'print' });
        return await page.pdf(PDF_OPTIONS);
      } finally {
        await page.close();
      }
    },
    async close(): Promise<void> {
      await browser.close();
    },
  };
}

/**
 * The text the document will display, stripped of markup and CSS.
 *
 * The font coverage guard must only see what actually gets drawn: a font's
 * base64 or a CSS selector would add characters that never reach the screen.
 */
function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
}
