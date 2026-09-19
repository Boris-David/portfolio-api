import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/loader.js';
import { buildSnapshot, resourcePath } from '../src/content/snapshot.js';
import { unavailableCvStore } from '../src/cv/unavailable-store.js';
import { LOCALES } from '../src/domain/locale.js';
import { buildTimeline, type TimelineEntry } from '../src/domain/timeline.js';
import { createApp } from '../src/http/app.js';

const { portfolio } = loadContent();
const snapshot = buildSnapshot();
const app = createApp({ snapshot, cv: () => unavailableCvStore('not needed here') });

/** The three resources the iOS app reads and the website has no room for. */
const DETAILED_RESOURCES = ['deepDives', 'architectures', 'timeline'] as const;

describe('les plongées en version longue', () => {
  it("renvoient chacune à un sujet d'expertise qui existe", () => {
    // A deep dive carries no title of its own: it borrows the one of the
    // expertise entry it points at. A dead reference leaves it nameless.
    const topics = new Set(portfolio.fr.expertise.map((topic) => topic.id));

    for (const dive of portfolio.fr.deepDives) {
      expect(topics.has(dive.expertise), dive.expertise).toBe(true);
    }
  });

  it('couvrent chaque sujet exactement une fois', () => {
    // An expertise card with no deep dive behind it is a dead end in the app,
    // and two dives on one topic would make the app choose in the client.
    const covered = portfolio.fr.deepDives.map((dive) => dive.expertise);
    const topics = portfolio.fr.expertise.map((topic) => topic.id);

    expect([...covered].sort()).toEqual([...topics].sort());
  });

  it("pointent vers un chapitre d'étude de cas qui existe", () => {
    const chapters = new Map(
      portfolio.fr.caseStudies.map((study) => [
        study.slug,
        new Set(study.chapters.map((chapter) => chapter.slug)),
      ]),
    );

    for (const dive of portfolio.fr.deepDives) {
      const { evidence } = dive;
      if (evidence === null) continue;
      const known = chapters.get(evidence.caseStudy);
      expect(known?.has(evidence.chapter), `${evidence.caseStudy}/${evidence.chapter}`).toBe(true);
    }
  });
});

/**
 * What was actually measured, and when.
 *
 * A count is pinned here so that re-measuring means changing this table on
 * purpose — a figure guarded by nothing is the one that gets rounded up the day
 * someone retells it.
 *
 * Only the portfolio's own repository carries counts. The employer platforms
 * carried some until 2026-09-20 and no longer do: a count of types states the
 * scale of a private product, it is not the author's to publish, and no reader
 * could check it. `evidence` is therefore tied to `sourceUrl` below, so the
 * figures cannot come back without a public repository coming with them.
 *
 * Re-measure with, from the root of `portfolio-ios`:
 *
 *     grep -rEoh "(struct|final class|actor|enum) [A-Za-z]+Screen\b" \
 *       --include="*.swift" Packages App | wc -l
 */
const MEASURED_ON = '2026-09-20';

const MEASURED: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'first-generation-platform': {},
  'current-generation-platform': {},
  kcalories: {},
  'portfolio-app': { Screen: 15, Store: 6, Repository: 3 },
};

describe("le dossier d'architecture", () => {
  const { architectures } = portfolio.fr;

  it('publie les comptes réellement relevés, et la date du relevé', () => {
    expect(architectures.verifiedOn).toBe(MEASURED_ON);

    for (const project of architectures.projects) {
      const counted = Object.fromEntries(
        project.evidence.map((entry) => [entry.symbol, entry.count]),
      );
      expect(counted, project.id).toEqual(MEASURED[project.id]);
    }
  });

  it('ne publie de comptes que pour un dépôt que le lecteur peut ouvrir', () => {
    for (const project of architectures.projects) {
      if (project.evidence.length === 0) continue;

      expect(
        project.sourceUrl,
        `${project.id} publie des comptes sans dépôt public : un chiffre relevé dans une base privée dit son échelle et ne se vérifie pas`,
      ).not.toBeNull();
    }
  });

  it("compare les quatre motifs, chacun avec ce qu'il achète et ce qu'il coûte", () => {
    const compared = architectures.patterns.map((pattern) => pattern.id);

    expect([...compared].sort()).toEqual(['clean', 'mvc', 'mvp', 'mvvm']);
  });

  it('décrit le motif que chaque base de code revendique', () => {
    // A project pointing at a pattern absent from the comparison would send the
    // reader to a column that does not exist.
    const compared = new Set(architectures.patterns.map((pattern) => pattern.id));

    for (const project of architectures.projects) {
      expect(compared.has(project.pattern), project.id).toBe(true);
    }
  });

  it("ne nomme ni employeur, ni client, ni réseau — on décrit un motif, jamais le code d'un tiers", () => {
    // The red line of the spec, turned into a guard: this resource is the one
    // where naming whose codebase it is would be easiest, and worst.
    const named = ['Instant System', 'Inetum', 'STIILT', 'Orange', 'TCL', 'Oùra', 'Toscane'];
    const published = allText(architectures).join(' ');

    for (const name of named) {
      expect(published, name).not.toContain(name);
    }
  });
});

describe('la frise du parcours', () => {
  const timeline = buildTimeline(portfolio.fr);

  it("se recalcule depuis le contenu — elle n'est stockée nulle part", () => {
    // The whole point of the resource: a view, not a second copy. If it ever
    // stopped matching what the content produces, it would have become a store.
    for (const locale of LOCALES) {
      const served = JSON.parse(snapshot.representation('timeline', locale).body) as {
        data: unknown;
      };

      expect(served.data, locale).toEqual(buildTimeline(portfolio[locale]));
    }
  });

  it('reprend chaque expérience, chaque formation et chaque certification, sans rien ajouter', () => {
    const { experience, background } = portfolio.fr;

    expect(pick(timeline, 'experience')).toEqual(experience);
    expect(pick(timeline, 'education')).toEqual(background.education);
    expect(pick(timeline, 'certification')).toEqual(background.certifications);
    expect(timeline).toHaveLength(
      experience.length + background.education.length + background.certifications.length,
    );
  });

  it("va du plus récent au plus ancien, quel que soit le format de date porté par l'entrée", () => {
    // Jobs carry YYYY-MM, degrees carry two years, certifications carry YYYY or
    // YYYY-MM. The order expected below only holds if a date known to the year
    // alone is read as its FIRST month: 2025 must land after 2025-11, not
    // before it.
    expect(timeline.map(identify)).toEqual([
      'professional-scrum-master-i',
      'safe-6-practitioner',
      'instant-system',
      'mail-orange',
      'stiilt',
      'master-ingenierie-informatique',
      'diplome-ingenieur-polytech',
      'ingenieur-travaux-informatiques',
    ]);
  });
});

describe("les ressources détaillées, servies à l'application", () => {
  it('répondent dans les deux langues, avec leur ETag et leur Content-Language', async () => {
    for (const resource of DETAILED_RESOURCES) {
      for (const locale of LOCALES) {
        const response = await app.request(`/v1/${resourcePath(resource)}?lang=${locale}`);

        expect(response.status, resource).toBe(200);
        expect(response.headers.get('etag'), resource).toBeTruthy();
        expect(response.headers.get('content-language'), resource).toBe(locale);
      }
    }
  });

  it('portent la même version de contenu que le reste du portfolio', async () => {
    // One source, several views: a resource announcing another version would
    // mean the iOS app holds two snapshots that cannot be compared.
    for (const resource of DETAILED_RESOURCES) {
      const response = await app.request(`/v1/${resourcePath(resource)}`);
      const body = (await response.json()) as { meta: { contentVersion: string } };

      expect(body.meta.contentVersion, resource).toBe(snapshot.version);
    }
  });
});

/** The source entries of one kind, in the order the timeline lays them out. */
function pick(timeline: readonly TimelineEntry[], kind: TimelineEntry['kind']): unknown[] {
  return timeline.flatMap((entry): unknown[] => {
    switch (entry.kind) {
      case 'experience':
        return kind === 'experience' ? [entry.experience] : [];
      case 'education':
        return kind === 'education' ? [entry.education] : [];
      case 'certification':
        return kind === 'certification' ? [entry.certification] : [];
    }
  });
}

/** What a timeline entry is, said with the slug the content already carries. */
function identify(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'experience':
      return entry.experience.slug;
    case 'education':
      return entry.education.slug;
    case 'certification':
      return entry.certification.slug;
  }
}

/** Every string a value carries, however deep — for reading published prose. */
function allText(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const entry of value) allText(entry, found);
    return found;
  }
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) allText(entry, found);
  }
  return found;
}
