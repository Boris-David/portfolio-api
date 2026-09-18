import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PATHS } from '../src/node/paths.js';
import { buildSnapshot } from '../src/content/snapshot.js';
import { resourcePath } from '../src/content/snapshot.js';
import { envelopeOf } from '../src/domain/envelope.js';
import { LOCALES } from '../src/domain/locale.js';
import { RESOURCE_VIEWS, RESOURCES } from '../src/domain/resources.js';
import { unavailableCvStore } from '../src/cv/unavailable-store.js';
import { createApp, cvPath } from '../src/http/app.js';
import { openApiDocument } from '../src/http/openapi.js';

const snapshot = buildSnapshot();
const app = createApp({ snapshot, cv: () => unavailableCvStore('non requis ici') });

describe('les octets servis face au contrat', () => {
  it('satisfont le schéma déclaré, pour chaque ressource et chaque langue', () => {
    // Plus fort qu'un contrôle de type : c'est la charge utile réelle,
    // pré-sérialisée au démarrage, qui est reparsée par le schéma publié.
    for (const resource of RESOURCES) {
      const schema = envelopeOf(RESOURCE_VIEWS[resource].schema);
      for (const locale of LOCALES) {
        const { body } = snapshot.representation(resource, locale);
        const parsed = schema.safeParse(JSON.parse(body));
        expect(parsed.success, `${resource}/${locale}`).toBe(true);
      }
    }
  });
});

describe('le contrat OpenAPI dérivé', () => {
  const document = app.getOpenAPI31Document(openApiDocument) as {
    paths: Record<string, unknown>;
    components: { schemas: Record<string, unknown> };
  };

  it('décrit toutes les ressources exposées', () => {
    for (const resource of RESOURCES) {
      expect(document.paths).toHaveProperty(`/v1/${resourcePath(resource)}`);
    }
    for (const locale of LOCALES) {
      expect(document.paths).toHaveProperty(cvPath(locale));
      // L'ancien chemin reste décrit : il redirige, et un client qui le lit
      // doit apprendre qu'il a bougé plutôt que de le découvrir en 404.
      expect(document.paths).toHaveProperty(`/v1/cv/${locale}.pdf`);
    }
    expect(document.paths).toHaveProperty('/health');
  });

  it('nomme ses composants depuis les schémas du domaine, sans les recopier', () => {
    for (const name of ['Portfolio', 'Profile', 'RichText', 'Span', 'App', 'Problem']) {
      expect(document.components.schemas).toHaveProperty(name);
    }
  });

  it("est servi par l'API elle-même", async () => {
    const response = await app.request('/v1/openapi.json');

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty('openapi', '3.1.0');
  });

  it('est à jour dans le dépôt — sinon la revue lit un contrat périmé', () => {
    const committed = readFileSync(PATHS.contract, 'utf8');

    expect(committed).toBe(`${JSON.stringify(document, null, 2)}\n`);
  });
});
