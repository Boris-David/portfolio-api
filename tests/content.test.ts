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

    expect(new Set(items.map((app) => app.slug)).size).toBe(items.length);
    expect(new Set(items.map((app) => app.appStoreId)).size).toBe(items.length);
  });

  it('pointe chaque application vers son propre identifiant', () => {
    for (const app of portfolio.fr.apps.items) {
      expect(app.appStoreUrl).toContain(`id${app.appStoreId}`);
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
