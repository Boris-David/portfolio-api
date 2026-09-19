import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/loader.js';
import { CV_ASSET_PREFIX } from '../src/config.js';
import { createAssetsCvStore, type AssetFetcher } from '../src/cv/assets-store.js';
import { cvFileName, readCvCatalogue } from '../src/cv/manifest.js';
import { buildCvHtml, renderAllCvs, writeCvArtifacts } from '../src/cv/build.js';
import { assertCharactersAreCovered } from '../src/cv/fonts.js';
import { buildCvDocument } from '../src/cv/model.js';
import { createChromiumRenderer, type CvRenderer } from '../src/cv/renderer.js';
import { escapeHtml, richToHtml } from '../src/cv/template.js';
import { loadDesignTokens } from '../src/cv/tokens.js';
import { plainText } from '../src/domain/markup.js';

const { portfolio, version } = loadContent();
const tokens = loadDesignTokens();

describe('le modèle du CV', () => {
  const document = buildCvDocument(portfolio.fr, 'fr');

  it('porte la forme longue du nom, réservée au CV et au pied de page', () => {
    expect(document.identity.fullName).toBe('Amissan Boris-David Amoussou-Guenou');
    expect(document.identity.fullName).not.toBe(portfolio.fr.profile.name.display);
  });

  it('reprend toutes les expériences et tous les groupes de compétences', () => {
    expect(document.experience).toHaveLength(portfolio.fr.experience.length);
    expect(document.skills).toHaveLength(portfolio.fr.skills.length);
  });

  it('formate les périodes dans la langue du document', () => {
    expect(buildCvDocument(portfolio.fr, 'fr').experience[0]?.period).toContain("aujourd'hui");
    expect(buildCvDocument(portfolio.en, 'en').experience[0]?.period).toContain('today');
  });

  it("compte les réseaux depuis l'inventaire, jamais depuis une valeur écrite", () => {
    expect(document.production.networkCount).toBe(document.production.networks.length);
    expect(document.production.networks).toContain('TCL');
  });

  it('lit ses intitulés de section dans le contenu', () => {
    expect(document.expertise.heading).toBe('Expertise');
    expect(document.production.heading).toBe('En production');
  });
});

describe('le gabarit', () => {
  it("embarque les polices, pour ne dépendre d'aucun réseau au rendu", () => {
    const html = buildCvHtml(portfolio.fr, 'fr', tokens);

    expect(html).toContain('@font-face');
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).not.toContain('fonts.googleapis.com');
  });

  it('prend toutes ses valeurs de forme dans les tokens', () => {
    const html = buildCvHtml(portfolio.fr, 'fr', tokens);

    expect(html).toContain(`--color-accent: ${tokens.color.accent?.light ?? ''};`);
    expect(html).toContain(`--type-body: ${String(tokens.type.body ?? 0)}px;`);
    // No hand-written hex colour in the rules: the only one left is the white
    // of the paper, which is the medium and not a token.
    const rules = html.slice(html.indexOf('@page'), html.indexOf('</style>'));
    expect(rules.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual(['#fff']);
  });

  it('rend le texte enrichi en balises, jamais en HTML stocké', () => {
    expect(richToHtml([{ text: 'fait', style: 'strong' }])).toBe('<strong>fait</strong>');
    expect(richToHtml([{ text: 'async/await', style: 'code' }])).toBe('<code>async/await</code>');
  });

  it('échappe le contenu injecté', () => {
    expect(escapeHtml('<script>&"\'')).toBe('&lt;script&gt;&amp;&quot;&#39;');
  });

  it('produit un document différent par langue', () => {
    expect(buildCvHtml(portfolio.fr, 'fr', tokens)).not.toBe(
      buildCvHtml(portfolio.en, 'en', tokens),
    );
    expect(buildCvHtml(portfolio.en, 'en', tokens)).toContain('Senior iOS Engineer');
  });
});

describe('la couverture des polices', () => {
  it('accepte tout le texte réellement affiché par le CV', () => {
    for (const locale of ['fr', 'en'] as const) {
      const document = buildCvDocument(portfolio[locale], locale);
      const text = [
        document.identity.fullName,
        document.identity.headline,
        ...document.summary.map(plainText),
        ...document.experience.flatMap((job) => [
          job.role,
          job.period,
          ...job.stack,
          ...job.highlights.map(plainText),
        ]),
        ...document.production.networks,
      ].join(' ');

      expect(() => {
        assertCharactersAreCovered(text);
      }).not.toThrow();
    }
  });

  it("refuse un caractère qu'aucune police embarquée ne dessine", () => {
    // Without this guard the PDF would show an empty box — and a résumé with
    // an empty box in it is a résumé thrown away.
    expect(() => {
      assertCharactersAreCovered('a 🚀 emoji in the résumé');
    }).toThrow(/empty box/);
  });
});

/**
 * The asset store, simulated from a directory.
 *
 * This is exactly what Cloudflare's `ASSETS` binding does: it serves one file
 * per path, or a 404. The test therefore exercises the real production path —
 * manifest read from the store, PDF relayed from the store — with no Worker to
 * spin up.
 */
function assetsFromDirectory(directory: string): AssetFetcher {
  return {
    fetch(request: Request): Promise<Response> {
      const asset = new URL(request.url).pathname.slice(`${CV_ASSET_PREFIX}/`.length);
      const path = join(directory, asset);
      if (!existsSync(path)) return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.resolve(new Response(new Uint8Array(readFileSync(path))));
    },
  };
}

const ASSET_ORIGIN = 'https://api.amissan.dev';

describe('les artefacts rendus', () => {
  let directory: string;
  let renderer: CvRenderer;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'portfolio-cv-'));
    renderer = await createChromiumRenderer();
  });

  afterAll(async () => {
    await renderer.close();
  });

  it('rend un PDF valide par langue, et les scelle avec la version de contenu', async () => {
    const rendered = await renderAllCvs(portfolio, renderer, tokens);
    const manifest = writeCvArtifacts(rendered, version, directory);

    expect(rendered).toHaveLength(2);
    for (const cv of rendered) {
      const header = new TextDecoder().decode(cv.bytes.slice(0, 5));
      expect(header, cv.locale).toBe('%PDF-');
      expect(cv.bytes.byteLength).toBeGreaterThan(50_000);
    }
    expect(manifest.contentVersion).toBe(version);
  });

  it("reste lisible par une machine — un CV que l'ATS ne lit pas est un CV perdu", async () => {
    // The fonts are embedded as subsets: without a `ToUnicode` table the
    // glyphs no longer map back to characters and text extraction returns
    // gibberish. So the rendering must always produce one.
    const [cv] = await renderAllCvs(portfolio, renderer, tokens);
    const raw = new TextDecoder('latin1').decode(cv?.bytes ?? new Uint8Array());

    expect(raw).toContain('/ToUnicode');
  });

  it("se relaie depuis le magasin d'assets, octets et nom de fichier compris", async () => {
    const store = createAssetsCvStore(assetsFromDirectory(directory), ASSET_ORIGIN, version);

    const lookup = await store.describe('fr');
    expect(lookup.status).toBe('ready');
    if (lookup.status !== 'ready') return;

    expect(lookup.description.fileName).toBe('amissan.ag-cv-fr.pdf');
    const body = await store.open(lookup.description);
    expect(body).not.toBeNull();
  });

  it('refuse de servir un CV rendu pour un autre contenu', async () => {
    const store = createAssetsCvStore(
      assetsFromDirectory(directory),
      ASSET_ORIGIN,
      'some-other-version',
    );

    const lookup = await store.describe('fr');

    expect(lookup.status).toBe('unavailable');
    expect(lookup.status === 'unavailable' && lookup.reason).toContain('périmé');
  });

  it("signale l'absence de rendu en disant quoi lancer", async () => {
    const empty = mkdtempSync(join(tmpdir(), 'portfolio-cv-vide-'));
    const store = createAssetsCvStore(assetsFromDirectory(empty), ASSET_ORIGIN, version);

    const lookup = await store.describe('fr');

    expect(lookup.status).toBe('unavailable');
    expect(lookup.status === 'unavailable' && lookup.reason).toContain('build:cv');
  });

  it('rend « aucun octet » quand le manifeste annonce un fichier absent', async () => {
    const broken = mkdtempSync(join(tmpdir(), 'portfolio-cv-casse-'));
    writeFileSync(
      join(broken, 'manifest.json'),
      JSON.stringify({
        contentVersion: version,
        renderedAt: new Date().toISOString(),
        files: [
          { locale: 'fr', file: 'absent-fr.pdf', bytes: 10, sourceDigest: 'FR' },
          { locale: 'en', file: 'absent-en.pdf', bytes: 10, sourceDigest: 'EN' },
        ],
      }),
    );
    const store = createAssetsCvStore(assetsFromDirectory(broken), ASSET_ORIGIN, version);

    const lookup = await store.describe('fr');
    expect(lookup.status).toBe('ready');
    if (lookup.status !== 'ready') return;

    // The manifest lies: the HTTP route will turn this into an explicit 503.
    expect(await store.open(lookup.description)).toBeNull();
  });

  it('refuse un manifeste que le schéma ne reconnaît pas', () => {
    const catalogue = readCvCatalogue({ contentVersion: 'v1' }, 'v1');

    expect(catalogue.status).toBe('unavailable');
    expect(catalogue.status === 'unavailable' && catalogue.reason).toContain('illisible');
  });

  it('porte le nom attendu au partage, par langue', () => {
    // On iOS, Safari ignores Content-Disposition for the share sheet and picks
    // up the last segment of the URL: the file name IS the route.
    expect(cvFileName('fr')).toBe('amissan.ag-cv-fr.pdf');
    expect(cvFileName('en')).toBe('amissan.ag-cv-en.pdf');
  });
});

describe("l'ETag du CV", () => {
  it('se calcule sur le HTML source, jamais sur les octets du PDF', () => {
    // Two "renders" of the SAME document: same source HTML, different bytes —
    // which is precisely what Chromium produces, since it timestamps its PDFs.
    const manifest = (bytes: number) => ({
      contentVersion: 'v1',
      renderedAt: new Date().toISOString(),
      files: [
        { locale: 'fr', file: 'x-cv-fr.pdf', bytes, sourceDigest: 'SOURCE-FR' },
        { locale: 'en', file: 'x-cv-en.pdf', bytes, sourceDigest: 'SOURCE-EN' },
      ],
    });

    const first = readCvCatalogue(manifest(101), 'v1');
    const second = readCvCatalogue(manifest(202), 'v1');

    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    if (first.status !== 'ready' || second.status !== 'ready') return;

    // The byte count changed, the ETag did not: a client that revalidates gets
    // its 304 instead of re-downloading 330 KB for nothing.
    expect(second.entries.fr.etag).toBe(first.entries.fr.etag);
    expect(first.entries.fr.etag).toBe('"SOURCE-FR"');
    // And two languages never share the same ETag.
    expect(first.entries.en.etag).not.toBe(first.entries.fr.etag);
  });
});
