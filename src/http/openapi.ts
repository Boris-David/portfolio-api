/**
 * La description du contrat.
 *
 * Seules les métadonnées sont écrites ici : titre, version, licence, serveurs.
 * Les **schémas** ne le sont jamais — ils sont générés depuis les schémas Zod
 * du domaine. Un contrat écrit à la main est un contrat qui ment un jour
 * (ADR 0003) ; celui-ci ne peut pas décrire autre chose que ce qui est servi.
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
