/**
 * The contract's description.
 *
 * Only the metadata is written here: title, version, licence, servers. The
 * **schemas** never are — they are generated from the domain's Zod schemas. A
 * hand-written contract is a contract that lies one day (ADR 0003); this one
 * cannot describe anything other than what is served.
 */
export const OPENAPI_VERSION = '1.0.0';

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'portfolio-api',
    version: OPENAPI_VERSION,
    description:
      "Le contenu du portfolio d'Amissan Amoussou-G., en lecture seule et bilingue, " +
      'et le CV en PDF rendu au build.',
    contact: { email: 'amissan.ag@outlook.fr' },
    license: { name: 'MIT', identifier: 'MIT' },
  },
  servers: [{ url: '/', description: "L'instance servant ce document." }],
  tags: [
    { name: 'Contenu', description: 'Les ressources de contenu, versionnées et cachables.' },
    { name: 'CV', description: 'Le CV en PDF, une version par langue.' },
    { name: 'Exploitation', description: "L'état de l'instance." },
  ],
};
