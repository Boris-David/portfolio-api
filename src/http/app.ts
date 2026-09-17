import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { CACHE_CONTROL } from '../config.js';
import { matchesETag } from '../content/digest.js';
import {
  RESOURCES,
  resourcePath,
  type ContentSnapshot,
  type Representation,
  type ResourceId,
} from '../content/snapshot.js';
import type { CvLibrary } from '../cv/artifacts.js';
import { envelopeOf } from '../domain/envelope.js';
import { LOCALES, LocaleSchema, type Locale } from '../domain/locale.js';
import { PART_SCHEMAS, PortfolioSchema } from '../domain/portfolio.js';
import { resolveLocale } from './locale.js';
import { openApiDocument } from './openapi.js';
import { PROBLEMS, ProblemSchema, problemResponse } from './problem.js';

export const API_VERSION = 'v1';
const BASE_PATH = `/${API_VERSION}`;

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const PDF_CONTENT_TYPE = 'application/pdf';
const OK = 200;
const NOT_MODIFIED = 304;

export interface AppDependencies {
  readonly snapshot: ContentSnapshot;
  readonly cv: CvLibrary;
}

/**
 * L'assemblage HTTP.
 *
 * Les dépendances sont injectées : le serveur les construit depuis le disque,
 * un test en fabrique d'autres. Rien ici ne lit un fichier, donc rien ici
 * n'exige un environnement particulier pour être testé.
 *
 * Les routes sont **déclarées** dans le registre OpenAPI et **servies** par des
 * handlers ordinaires. Les corps sont pré-sérialisés au démarrage : les
 * réifier en objets pour les re-sérialiser à chaque requête annulerait le
 * bénéfice, et surtout empêcherait de comparer l'`ETag` *avant* de produire la
 * réponse. La conformité au contrat n'est pas perdue pour autant — elle est
 * vérifiée sur les octets réellement servis (`tests/contract.test.ts`), ce qui
 * est plus fort qu'un contrôle de type.
 */
export function createApp(dependencies: AppDependencies): OpenAPIHono {
  const app = new OpenAPIHono();

  registerContentRoutes(app, dependencies.snapshot);
  registerCvRoutes(app, dependencies.cv);
  registerHealthRoute(app, dependencies);

  app.doc31(`${BASE_PATH}/openapi.json`, openApiDocument);

  app.notFound((c) =>
    problemResponse(
      c,
      'notFound',
      `Aucune ressource à ${c.req.path}. Voir ${BASE_PATH}/openapi.json.`,
    ),
  );
  app.onError((error, c) => {
    console.error(error);
    return problemResponse(c, 'internal', "L'API n'a pas pu traiter la requête.");
  });

  return app;
}

const LangQuerySchema = z.object({
  lang: LocaleSchema.optional().meta({
    param: { name: 'lang', in: 'query' },
    description: 'Langue servie. À défaut, « Accept-Language », puis le français.',
  }),
});

function registerContentRoutes(app: OpenAPIHono, snapshot: ContentSnapshot): void {
  for (const resource of RESOURCES) {
    const path = `${BASE_PATH}/${resourcePath(resource)}`;
    const dataSchema = resource === 'portfolio' ? PortfolioSchema : PART_SCHEMAS[resource];

    app.openAPIRegistry.registerPath({
      method: 'get',
      path,
      tags: ['Contenu'],
      summary: summaryOf(resource),
      request: { query: LangQuerySchema },
      responses: {
        200: {
          description: 'Le contenu, dans la langue résolue.',
          content: { 'application/json': { schema: envelopeOf(dataSchema) } },
          headers: RESPONSE_HEADERS,
        },
        304: { description: "Inchangé depuis l'« ETag » présenté." },
        400: {
          description: 'Langue demandée inconnue.',
          content: { 'application/problem+json': { schema: ProblemSchema } },
        },
      },
    });

    app.get(path, (c) => {
      const locale = localeOrProblem(c);
      if (typeof locale !== 'string') return locale;
      return sendJson(c, snapshot.representation(resource, locale), locale);
    });
  }
}

const RESPONSE_HEADERS = {
  ETag: { description: 'Validateur fort du corps servi.', schema: { type: 'string' } },
  'Content-Language': { description: 'Langue réellement servie.', schema: { type: 'string' } },
  'Cache-Control': { description: 'Politique de cache.', schema: { type: 'string' } },
} as const;

function registerCvRoutes(app: OpenAPIHono, library: CvLibrary): void {
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: `${BASE_PATH}/cv/{locale}.pdf`,
    tags: ['CV'],
    summary: 'Le CV en PDF, une version par langue.',
    description:
      'Le PDF est rendu au build, au moment où le contenu change — jamais à la requête. ' +
      'Il est servi comme un blob statique validé par « ETag ».',
    request: {
      params: z.object({
        locale: LocaleSchema.meta({ param: { name: 'locale', in: 'path' } }),
      }),
    },
    responses: {
      200: {
        description: 'Le CV rendu.',
        content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
        headers: RESPONSE_HEADERS,
      },
      304: { description: "Inchangé depuis l'« ETag » présenté." },
      503: {
        description: 'Aucun CV rendu pour la version de contenu servie.',
        content: { 'application/problem+json': { schema: ProblemSchema } },
      },
    },
  });

  // Deux routes littérales plutôt qu'un paramètre : les langues sont connues à
  // la compilation, et une route littérale ne peut pas accepter une valeur
  // qu'on aurait oublié de valider.
  for (const locale of LOCALES) {
    app.get(`${BASE_PATH}/cv/${locale}.pdf`, (c) => {
      if (library.status === 'unavailable') {
        return problemResponse(c, 'cvUnavailable', library.reason);
      }
      const artifact = library.artifacts[locale];
      c.header('ETag', artifact.etag);
      c.header('Cache-Control', CACHE_CONTROL.cv);
      c.header('Content-Language', locale);
      c.header('Content-Disposition', `inline; filename="${artifact.fileName}"`);
      if (matchesETag(c.req.header('if-none-match'), artifact.etag)) {
        return c.body(null, NOT_MODIFIED);
      }
      return c.body(artifact.bytes as unknown as ArrayBuffer, OK, {
        'Content-Type': PDF_CONTENT_TYPE,
      });
    });
  }
}

const HealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    contentVersion: z.string(),
    cv: z.object({ available: z.boolean(), reason: z.string().nullable() }),
  })
  .meta({ id: 'Health' });

function registerHealthRoute(app: OpenAPIHono, dependencies: AppDependencies): void {
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['Exploitation'],
    summary: "L'état de l'instance.",
    description:
      '« degraded » signifie que le contenu est servi mais que le CV rendu manque ou ne ' +
      'correspond plus à la version de contenu servie.',
    responses: {
      200: {
        description: "L'état courant.",
        content: { 'application/json': { schema: HealthSchema } },
      },
    },
  });

  app.get('/health', (c) => {
    const available = dependencies.cv.status === 'ready';
    return c.json(
      {
        status: available ? 'ok' : 'degraded',
        contentVersion: dependencies.snapshot.version,
        cv: {
          available,
          reason: dependencies.cv.status === 'unavailable' ? dependencies.cv.reason : null,
        },
      },
      OK,
      { 'Cache-Control': CACHE_CONTROL.none },
    );
  });
}

function localeOrProblem(c: Context): Locale | Response {
  const resolution = resolveLocale(c.req.query('lang'), c.req.header('accept-language'));
  if (resolution.ok) return resolution.locale;
  return problemResponse(
    c,
    'unsupportedLocale',
    `« ${resolution.requested} » n'est pas une langue servie. Langues disponibles : ${LOCALES.join(', ')}.`,
  );
}

/**
 * Sert une représentation pré-calculée, avec sa revalidation.
 *
 * `Vary: Accept-Language` est indispensable : sans lui, un cache partagé
 * servirait à un lecteur anglophone la réponse française mise en cache juste
 * avant.
 */
function sendJson(c: Context, representation: Representation, locale: Locale): Response {
  c.header('ETag', representation.etag);
  c.header('Cache-Control', CACHE_CONTROL.content);
  c.header('Content-Language', locale);
  c.header('Vary', 'Accept-Language');
  if (matchesETag(c.req.header('if-none-match'), representation.etag)) {
    return c.body(null, NOT_MODIFIED);
  }
  return c.body(representation.body, OK, { 'Content-Type': JSON_CONTENT_TYPE });
}

const SUMMARIES: Readonly<Record<ResourceId, string>> = {
  portfolio: "Tout le contenu du portfolio, d'un seul appel.",
  profile: "L'identité, l'accroche et le contact.",
  metrics: 'Les chiffres publiables.',
  sections: 'Les en-têtes éditoriaux des sections.',
  caseStudies: 'Les études de cas.',
  apps: 'Les applications en production.',
  expertise: 'Les sujets creusés en profondeur.',
  experience: 'Les expériences professionnelles.',
  background: 'Formation, certifications et projets ouverts.',
  skills: 'Les compétences, par groupe.',
};

function summaryOf(resource: ResourceId): string {
  return SUMMARIES[resource];
}

export { PROBLEMS };
