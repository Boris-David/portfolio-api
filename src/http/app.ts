import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { CACHE_CONTROL } from '../config.js';
import { matchesETag } from '../content/digest.js';
import { resourcePath, type ContentSnapshot, type Representation } from '../content/snapshot.js';
import { cvFileName } from '../cv/manifest.js';
import type { CvStore } from '../cv/store.js';
import { envelopeOf } from '../domain/envelope.js';
import { DEFAULT_LOCALE, LOCALES, LocaleSchema, type Locale } from '../domain/locale.js';
import { RESOURCE_VIEWS, RESOURCES, type ResourceId } from '../domain/resources.js';
import { resolveLocale } from './locale.js';
import { openApiDocument } from './openapi.js';
import { PROBLEMS, ProblemSchema, problemResponse } from './problem.js';

export const API_VERSION = 'v1';
const BASE_PATH = `/${API_VERSION}`;

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const PDF_CONTENT_TYPE = 'application/pdf';
const OK = 200;
const NOT_MODIFIED = 304;

/**
 * Résout le magasin de CV pour la requête courante.
 *
 * C'est une fonction et non une valeur parce que, sur Workers, le magasin
 * d'assets n'est accessible que par `c.env` — il n'existe pas au moment où
 * l'application est assemblée. Un test, lui, renvoie simplement un double.
 */
export type CvStoreResolver = (context: Context) => CvStore;

export interface AppDependencies {
  readonly snapshot: ContentSnapshot;
  readonly cv: CvStoreResolver;
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
    const { schema: dataSchema } = RESOURCE_VIEWS[resource];

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

/**
 * Le chemin public du CV dans une langue donnée.
 *
 * Le dernier segment est **le nom du fichier**, et c'est tout l'objet de cette
 * forme : sur iOS, Safari ignore `Content-Disposition` pour la feuille de
 * partage et reprend le dernier segment de l'URL. Un chemin en
 * `/v1/cv/fr.pdf` faisait donc apparaître « fr » au partage.
 */
export function cvPath(locale: Locale): string {
  return `${BASE_PATH}/cv/${cvFileName(locale)}`;
}

/** L'ancien chemin, conservé en redirection : des liens circulent déjà. */
function legacyCvPath(locale: Locale): string {
  return `${BASE_PATH}/cv/${locale}.pdf`;
}

const MOVED_PERMANENTLY = 301;

function registerCvRoutes(app: OpenAPIHono, resolve: CvStoreResolver): void {
  for (const locale of LOCALES) {
    const path = cvPath(locale);

    app.openAPIRegistry.registerPath({
      method: 'get',
      path,
      tags: ['CV'],
      summary: `Le CV en PDF (${locale}).`,
      description:
        'Le PDF est rendu au build, au moment où le contenu change — jamais à la requête. ' +
        'Il est publié dans les Workers Static Assets et relayé ici, validé par « ETag ».',
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

    app.get(path, async (c) => {
      const store = resolve(c);
      const lookup = await store.describe(locale);
      if (lookup.status === 'unavailable') {
        return problemResponse(c, 'cvUnavailable', lookup.reason);
      }

      const { description } = lookup;
      c.header('ETag', description.etag);
      c.header('Cache-Control', CACHE_CONTROL.cv);
      c.header('Content-Language', locale);
      c.header('Content-Disposition', `inline; filename="${description.fileName}"`);

      // La revalidation répond avant d'ouvrir le PDF : télécharger 330 Ko pour
      // dire au client qu'il les a déjà serait absurde.
      if (matchesETag(c.req.header('if-none-match'), description.etag)) {
        return c.body(null, NOT_MODIFIED);
      }

      const body = await store.open(description);
      if (body === null) {
        return problemResponse(
          c,
          'cvUnavailable',
          `Le manifeste annonce ${description.assetPath}, absent du magasin d'assets.`,
        );
      }
      return c.body(body, OK, { 'Content-Type': PDF_CONTENT_TYPE });
    });

    // L'ancien chemin reste, en redirection permanente : il a été partagé, et
    // un lien de CV qui tombe en 404 chez un recruteur coûte plus cher que
    // deux lignes de compatibilité.
    app.openAPIRegistry.registerPath({
      method: 'get',
      path: legacyCvPath(locale),
      tags: ['CV'],
      summary: `Ancien chemin du CV (${locale}).`,
      description: `Redirige définitivement vers « ${path} », dont le dernier segment est le nom du fichier.`,
      deprecated: true,
      responses: {
        301: {
          description: 'Redirection permanente vers le chemin courant.',
          headers: {
            Location: { description: 'Le chemin courant.', schema: { type: 'string' } },
          },
        },
      },
    });

    app.get(legacyCvPath(locale), (c) => c.redirect(path, MOVED_PERMANENTLY));
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

  app.get('/health', async (c) => {
    const lookup = await dependencies.cv(c).describe(DEFAULT_LOCALE);
    const available = lookup.status === 'ready';
    return c.json(
      {
        status: available ? 'ok' : 'degraded',
        contentVersion: dependencies.snapshot.version,
        cv: {
          available,
          reason: lookup.status === 'unavailable' ? lookup.reason : null,
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
  deepDives: 'Les mêmes sujets, en version longue.',
  architectures: "Les motifs d'architecture comparés, et ceux des bases de code traversées.",
  experience: 'Les expériences professionnelles.',
  background: 'Formation, certifications et projets ouverts.',
  skills: 'Les compétences, par groupe.',
  timeline: 'Le parcours entier en une seule suite, du plus récent au plus ancien.',
};

function summaryOf(resource: ResourceId): string {
  return SUMMARIES[resource];
}

export { PROBLEMS };
