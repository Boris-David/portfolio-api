import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/loader.js';
import { cvFileName, loadCvLibrary } from '../src/cv/artifacts.js';
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
    expect(document.expertise.heading).toBe('Profondeur technique');
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
    // Aucune couleur hexadécimale écrite à la main dans les règles : la seule
    // qui reste est le blanc du papier, qui est le support et non un token.
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
    // Sans cette garde, le PDF afficherait un carré vide — et un CV avec un
    // carré vide est un CV grillé.
    expect(() => {
      assertCharactersAreCovered('un emoji 🚀 dans le CV');
    }).toThrow(/carré vide/);
  });
});

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

    const library = loadCvLibrary(version, portfolio.fr.profile.name.full, directory);
    expect(library.status).toBe('ready');
  });

  it("reste lisible par une machine — un CV que l'ATS ne lit pas est un CV perdu", async () => {
    // Les polices sont embarquées en sous-ensembles : sans table `ToUnicode`,
    // les glyphes ne se remontent plus en caractères et l'extraction de texte
    // rend du charabia. Le rendu doit donc toujours en produire une.
    const [cv] = await renderAllCvs(portfolio, renderer, tokens);
    const raw = new TextDecoder('latin1').decode(cv?.bytes ?? new Uint8Array());

    expect(raw).toContain('/ToUnicode');
  });

  it('refuse de servir un CV rendu pour un autre contenu', () => {
    const library = loadCvLibrary('une-autre-version', 'Nom Complet', directory);

    expect(library.status).toBe('unavailable');
    expect(library.status === 'unavailable' && library.reason).toContain('périmé');
  });

  it("signale l'absence de rendu en disant quoi lancer", () => {
    const empty = mkdtempSync(join(tmpdir(), 'portfolio-cv-vide-'));
    const library = loadCvLibrary(version, 'Nom Complet', empty);

    expect(library.status).toBe('unavailable');
    expect(library.status === 'unavailable' && library.reason).toContain('build:cv');
  });

  it('refuse un manifeste qui annonce un fichier absent', () => {
    const broken = mkdtempSync(join(tmpdir(), 'portfolio-cv-casse-'));
    writeFileSync(
      join(broken, 'manifest.json'),
      JSON.stringify({
        contentVersion: version,
        renderedAt: new Date().toISOString(),
        files: [
          { locale: 'fr', file: 'absent-fr.pdf', bytes: 10 },
          { locale: 'en', file: 'absent-en.pdf', bytes: 10 },
        ],
      }),
    );

    const library = loadCvLibrary(version, 'Nom Complet', broken);

    expect(library.status).toBe('unavailable');
    expect(library.status === 'unavailable' && library.reason).toContain('absent');
  });

  it('nomme le fichier depuis le nom porté par le contenu', () => {
    expect(cvFileName('Amissan Boris-David Amoussou-Guenou', 'fr')).toBe(
      'amissan-boris-david-amoussou-guenou-cv-fr.pdf',
    );
  });
});
