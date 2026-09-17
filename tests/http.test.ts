import { beforeAll, describe, expect, it } from 'vitest';
import { buildSnapshot, type ContentSnapshot } from '../src/content/snapshot.js';
import type { CvArtifact, CvLibrary } from '../src/cv/artifacts.js';
import { strongETag } from '../src/content/digest.js';
import { createApp } from '../src/http/app.js';

const PDF_BYTES = new TextEncoder().encode('%PDF-1.4 faux document de test\n%%EOF');

function readyLibrary(): CvLibrary {
  const artifact = (locale: 'fr' | 'en'): CvArtifact => ({
    locale,
    bytes: PDF_BYTES,
    etag: strongETag(`${locale}-${String(PDF_BYTES.byteLength)}`),
    fileName: `cv-${locale}.pdf`,
  });
  return { status: 'ready', artifacts: { fr: artifact('fr'), en: artifact('en') } };
}

let snapshot: ContentSnapshot;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  snapshot = buildSnapshot();
  app = createApp({ snapshot, cv: readyLibrary() });
});

describe('les ressources de contenu', () => {
  it('servent le français par défaut', async () => {
    const response = await app.request('/v1/profile');
    const body = (await response.json()) as {
      meta: { locale: string };
      data: { headline: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('content-language')).toBe('fr');
    expect(body.meta.locale).toBe('fr');
    expect(body.data.headline).toBe('Ingénieur iOS senior');
  });

  it('servent la langue demandée en paramètre', async () => {
    const response = await app.request('/v1/profile?lang=en');
    const body = (await response.json()) as { data: { headline: string } };

    expect(body.data.headline).toBe('Senior iOS Engineer');
    expect(response.headers.get('content-language')).toBe('en');
  });

  it("négocient depuis Accept-Language quand aucun paramètre n'est donné", async () => {
    const response = await app.request('/v1/profile', {
      headers: { 'accept-language': 'en-GB,en;q=0.9,fr;q=0.4' },
    });

    expect(response.headers.get('content-language')).toBe('en');
  });

  it('déclarent Vary, sans quoi un cache partagé servirait la mauvaise langue', async () => {
    const response = await app.request('/v1/profile');

    expect(response.headers.get('vary')).toBe('Accept-Language');
  });

  it("portent la version du contenu dans l'enveloppe, pour l'instantané hors ligne", async () => {
    const response = await app.request('/v1/portfolio');
    const body = (await response.json()) as { meta: { contentVersion: string } };

    expect(body.meta.contentVersion).toBe(snapshot.version);
  });

  it('refusent une langue inconnue plutôt que de retomber en silence', async () => {
    const response = await app.request('/v1/profile?lang=de');
    const problem = (await response.json()) as { status: number; detail: string };

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(problem.detail).toContain('de');
  });

  it('exposent toutes les parties du portfolio', async () => {
    for (const path of [
      'portfolio',
      'profile',
      'metrics',
      'sections',
      'case-studies',
      'apps',
      'expertise',
      'experience',
      'background',
      'skills',
    ]) {
      const response = await app.request(`/v1/${path}`);
      expect(response.status, path).toBe(200);
    }
  });
});

describe('la revalidation par ETag', () => {
  it("répond 304 quand le client présente l'ETag courant", async () => {
    const first = await app.request('/v1/apps');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = await app.request('/v1/apps', { headers: { 'if-none-match': etag ?? '' } });

    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
    expect(second.headers.get('etag')).toBe(etag);
  });

  it("accepte la forme faible et la liste, comme l'exige la RFC", async () => {
    const first = await app.request('/v1/apps');
    const etag = first.headers.get('etag') ?? '';

    const weak = await app.request('/v1/apps', { headers: { 'if-none-match': `W/${etag}` } });
    const list = await app.request('/v1/apps', {
      headers: { 'if-none-match': `"autre", ${etag}` },
    });

    expect(weak.status).toBe(304);
    expect(list.status).toBe(304);
  });

  it('donne un ETag différent par langue — sans quoi un cache mélangerait les deux', async () => {
    const fr = await app.request('/v1/profile?lang=fr');
    const en = await app.request('/v1/profile?lang=en');

    expect(fr.headers.get('etag')).not.toBe(en.headers.get('etag'));
  });

  it('annonce un cache public revalidable', async () => {
    const response = await app.request('/v1/profile');

    expect(response.headers.get('cache-control')).toContain('public');
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate');
  });
});

describe('le CV', () => {
  it('est servi en PDF, avec son nom de fichier', async () => {
    const response = await app.request('/v1/cv/fr.pdf');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('cv-fr.pdf');
  });

  it('se revalide comme le contenu', async () => {
    const first = await app.request('/v1/cv/en.pdf');
    const etag = first.headers.get('etag') ?? '';
    const second = await app.request('/v1/cv/en.pdf', { headers: { 'if-none-match': etag } });

    expect(second.status).toBe(304);
  });

  it('répond 503 en disant quoi faire, plutôt que de servir un CV périmé', async () => {
    const degraded = createApp({
      snapshot,
      cv: { status: 'unavailable', reason: 'CV périmé : rendu pour un autre contenu.' },
    });

    const response = await degraded.request('/v1/cv/fr.pdf');
    const problem = (await response.json()) as { detail: string };

    expect(response.status).toBe(503);
    expect(problem.detail).toContain('périmé');
  });
});

describe("l'exploitation", () => {
  it('signale « degraded » quand le CV manque, sans couper le contenu', async () => {
    const degraded = createApp({
      snapshot,
      cv: { status: 'unavailable', reason: 'aucun rendu' },
    });

    const health = (await (await degraded.request('/health')).json()) as {
      status: string;
      cv: { available: boolean; reason: string | null };
    };
    const content = await degraded.request('/v1/profile');

    expect(health.status).toBe('degraded');
    expect(health.cv.available).toBe(false);
    expect(health.cv.reason).toBe('aucun rendu');
    expect(content.status).toBe(200);
  });

  it('répond « ok » quand tout est là', async () => {
    const health = (await (await app.request('/health')).json()) as { status: string };

    expect(health.status).toBe('ok');
  });

  it('renvoie un problème RFC 9457 sur une route inconnue', async () => {
    const response = await app.request('/v1/inconnu');
    const problem = (await response.json()) as { status: number; type: string };

    expect(response.status).toBe(404);
    expect(problem.type).toContain('not-found');
  });
});
