/**
 * Rend les CV PDF — une version par langue — et scelle le manifeste.
 *
 * Déclenché par le build, donc par le changement de contenu : c'est la
 * condition posée par l'ADR 0004. La requête de lecture, elle, ne fait que
 * relayer les octets.
 */
import { loadContent } from '../src/content/loader.js';
import { CV_OUTPUT_DIRECTORY, renderAllCvs, writeCvArtifacts } from '../src/cv/build.js';
import { createChromiumRenderer } from '../src/cv/renderer.js';

const { version, portfolio } = loadContent();
const renderer = await createChromiumRenderer();

try {
  const rendered = await renderAllCvs(portfolio, renderer);
  const manifest = writeCvArtifacts(rendered, version);
  console.log(`[cv] contenu ${version} → ${CV_OUTPUT_DIRECTORY}`);
  for (const file of manifest.files) {
    console.log(`[cv]   ${file.locale} · ${file.file} · ${String(file.bytes)} octets`);
  }
} finally {
  await renderer.close();
}
