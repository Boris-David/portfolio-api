/**
 * Renders the résumé PDFs — one per language — and seals the manifest.
 *
 * Triggered by the build, and therefore by a content change: that is the
 * condition ADR 0004 sets. The read request only relays the bytes.
 */
import { loadContent } from '../src/content/loader.js';
import { CV_OUTPUT_DIRECTORY, renderAllCvs, writeCvArtifacts } from '../src/cv/build.js';
import { createChromiumRenderer } from '../src/cv/renderer.js';

const { version, portfolio } = loadContent();
const renderer = await createChromiumRenderer();

try {
  const rendered = await renderAllCvs(portfolio, renderer);
  const manifest = writeCvArtifacts(rendered, version);
  console.log(`[cv] content ${version} → ${CV_OUTPUT_DIRECTORY}`);
  for (const file of manifest.files) {
    console.log(`[cv]   ${file.locale} · ${file.file} · ${String(file.bytes)} bytes`);
  }
} finally {
  await renderer.close();
}
