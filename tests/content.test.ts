import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/loader.js';
import { countByRole } from '../src/domain/apps.js';
import { LOCALES } from '../src/domain/locale.js';
import { PortfolioSchema } from '../src/domain/portfolio.js';
import { plainText } from '../src/domain/markup.js';

const { portfolio, version } = loadContent();

describe('le contenu publié', () => {
  it('satisfait le schéma de domaine dans les deux langues', () => {
    for (const locale of LOCALES) {
      expect(PortfolioSchema.safeParse(portfolio[locale]).success).toBe(true);
    }
  });

  it('porte une version stable, qui ne dépend que des fichiers', () => {
    expect(version).toBe(loadContent().version);
  });

  it('a exactement la même structure dans les deux langues', () => {
    // The bilingual shape forbids an entry from existing in one language and
    // not the other; this test checks the promise holds on the real content.
    expect(shapeOf(portfolio.fr)).toEqual(shapeOf(portfolio.en));
  });

  it('ne laisse aucune traduction identique là où une phrase était attendue', () => {
    // Pasting the French into the English field would pass the schema. It
    // does not pass here: headlines and titles have to differ.
    expect(portfolio.fr.profile.headline).not.toBe(portfolio.en.profile.headline);
    for (const [index, summary] of portfolio.fr.profile.summary.entries()) {
      expect(plainText(summary)).not.toBe(plainText(portfolio.en.profile.summary[index] ?? []));
    }
  });
});

describe('les références internes', () => {
  it('pointent vers une étude de cas qui existe — sinon le client suit un lien mort', () => {
    const slugs = new Set(portfolio.fr.caseStudies.map((study) => study.slug));

    expect(slugs.has(portfolio.fr.profile.showcase.caseStudy)).toBe(true);
  });
});

describe('le compte des réseaux', () => {
  const inventoried = String(countByRole(portfolio.fr.apps, 'ticketing'));

  it("n'est cité qu'à un seul endroit : là où la liste le démontre", () => {
    // A number written into a sentence is a second source of truth; it is
    // only acceptable when guarded. And repeated everywhere it weakens — it
    // is worth the list that backs it, not its frequency.
    const appsSection = portfolio.fr.sections.find((section) => section.id === 'apps');
    expect(appsSection?.title).toContain(inventoried);

    const elsewhere = [
      ...portfolio.fr.caseStudies.map((study) => study.title),
      ...portfolio.fr.metrics.map((metric) => metric.value),
    ];
    for (const text of elsewhere) {
      expect(text, text).not.toContain(inventoried);
    }
  });
});

describe("l'inventaire des applications", () => {
  it("n'a ni slug ni identifiant App Store en double", () => {
    const { items } = portfolio.fr.apps;
    // Les identifiants absents ne se comparent pas entre eux : deux `null`
    // s'effondreraient en un seul et rendraient ce test complaisant.
    const identifiers = items.map((app) => app.appStoreId).filter((id) => id !== null);

    expect(new Set(items.map((app) => app.slug)).size).toBe(items.length);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('pointe chaque application vers son propre identifiant', () => {
    for (const app of portfolio.fr.apps.items) {
      if (app.appStoreId === null) continue;

      expect(app.appStoreUrl, app.slug).toContain(`id${app.appStoreId}`);
    }
  });

  it("n'a jamais un identifiant sans son lien, ni l'inverse", () => {
    for (const app of portfolio.fr.apps.items) {
      expect(
        app.appStoreId === null,
        `${app.slug} : un identifiant App Store et son lien vont ensemble ou pas du tout`,
      ).toBe(app.appStoreUrl === null);
    }
  });

  it("donne de quoi présenter chaque app dont il est l'auteur", () => {
    // Vu à l'écran avant d'être écrit ici : l'onglet « Mes apps » tire son
    // sous-titre de l'étude de cas, et l'app sans étude n'affichait que son
    // nom au-dessus d'un bouton. Une carte muette.
    const studied = new Set(portfolio.fr.caseStudies.map((study) => study.slug));

    for (const app of portfolio.fr.apps.items.filter((item) => item.role === 'end-to-end')) {
      expect(
        studied.has(app.slug) || app.summary !== null,
        `${app.slug} n'a ni étude de cas ni résumé : sa carte n'aurait rien à dire`,
      ).toBe(true);
    }
  });

  it('donne au moins un lien à chaque application', () => {
    for (const app of portfolio.fr.apps.items) {
      expect(
        app.appStoreUrl !== null || app.sourceUrl !== null,
        `${app.slug} n'est atteignable par aucun lien — une carte sans destination`,
      ).toBe(true);
    }
  });
});

describe('la personnalité', () => {
  it("se raconte par des faits, pas par une liste d'adjectifs", () => {
    // Règle éditoriale racine : « les faits portent la personnalité mieux que
    // les adjectifs ». « Délégué de classe, président du comité étudiant,
    // capitaine d'équipe » dit leader sans le mot, et se vérifie — ce que
    // « leader » ne fait jamais.
    for (const locale of LOCALES) {
      const written = portfolio[locale].profile.personality.summary.map(plainText).join(' ');

      for (const adjective of [/\bleader\b/i, /\bjovial/i, /\bdéterminé/i, /\baltruiste/i]) {
        expect(written, `${locale} : ${adjective.source}`).not.toMatch(adjective);
      }
    }
  });

  it("nomme au moins un centre d'intérêt, dans les deux langues", () => {
    for (const locale of LOCALES) {
      expect(portfolio[locale].profile.personality.interests.length).toBeGreaterThan(0);
    }
  });
});

describe('les liens publiés', () => {
  it('sont tous en HTTPS — un lien en clair sur un portfolio public est une faute', () => {
    for (const url of collectUrls(portfolio.fr)) {
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});

/** The shape of a value: its keys and its lengths, without the text. */
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value === null || typeof value !== 'object') return typeof value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, shapeOf(entry)]),
  );
}

function collectUrls(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('http')) found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectUrls(entry, found);
    return found;
  }
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) collectUrls(entry, found);
  }
  return found;
}
