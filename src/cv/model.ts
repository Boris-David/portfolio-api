import { countByRole } from '../domain/apps.js';
import type { Locale } from '../domain/locale.js';
import type { Portfolio } from '../domain/portfolio.js';
import type { RichText } from '../domain/rich-text.js';
import { formatAwardedOn, formatPeriod, formatYearRange } from './format.js';
import { CV_LABELS, type CvLabels } from './labels.js';

/**
 * Le modèle du document CV : la **sélection** du contenu qui tient sur deux
 * pages, et rien d'autre.
 *
 * Un CV n'est pas la page imprimée. La page déplie deux études de cas, dont
 * une en cinq chantiers ; les y reverser produirait six pages qu'aucun
 * recruteur ne lit. La sélection est donc explicite ici, en code relisible,
 * plutôt que dissimulée dans du balisage — et elle ne retire aucun fait du
 * contenu, qui reste servi entier par l'API.
 *
 * Ce qui entre : identité, accroche, chiffres, expériences, **le produit tenu
 * de bout en bout**, profondeur technique, compétences, formation,
 * certifications, et l'inventaire des réseaux en production.
 *
 * Ce qui n'entre pas : les **projets ouverts**. Un composant calendrier et un
 * exercice d'entretien ne pèsent rien à côté d'un produit livré sur l'App
 * Store, et les garder repoussait la fin du document sur une troisième page
 * au quart pleine. Ils restent servis par l'API, et le site les montre.
 *
 * KCalories y a une place à sa mesure, et pas une ligne en bas de page : c'est
 * la seule pièce du dossier qui prouve un produit entier — quatre stacks,
 * seul, jusqu'à l'App Store. L'étude de cas de la billettique, elle, n'est pas
 * reprise : l'expérience Instant System porte déjà les mêmes faits, et les
 * écrire deux fois les affaiblirait.
 */
export interface CvDocument {
  readonly locale: Locale;
  readonly labels: CvLabels;
  readonly identity: {
    readonly fullName: string;
    readonly headline: string;
    readonly facts: readonly string[];
    readonly email: string;
    readonly links: readonly { readonly label: string; readonly url: string }[];
  };
  readonly summary: readonly RichText[];
  readonly metrics: readonly { readonly value: string; readonly caption: string }[];
  readonly experience: readonly {
    readonly role: string;
    readonly organisation: string;
    readonly location: string;
    readonly period: string;
    readonly roles: readonly string[];
    readonly highlights: readonly RichText[];
    readonly stack: readonly string[];
  }[];
  /** Le produit personnel, raconté comme une pièce à conviction. */
  readonly project: {
    readonly heading: string;
    readonly title: string;
    readonly link: { readonly label: string; readonly url: string } | null;
    readonly tags: readonly string[];
    readonly panels: readonly {
      readonly heading: string;
      readonly items: readonly RichText[];
    }[];
  };
  readonly expertise: {
    readonly heading: string;
    readonly items: readonly { readonly title: string; readonly body: RichText }[];
  };
  readonly skills: readonly { readonly title: string; readonly items: readonly string[] }[];
  readonly education: readonly {
    readonly degree: string;
    readonly school: string;
    readonly detail: string | null;
    readonly period: string;
  }[];
  readonly certifications: readonly {
    readonly name: string;
    readonly issuer: string;
    readonly awardedOn: string;
    readonly verifyUrl: string | null;
  }[];
  readonly production: {
    readonly heading: string;
    readonly note: RichText | null;
    readonly networkCount: number;
    readonly networks: readonly string[];
  };
}

export function buildCvDocument(portfolio: Portfolio, locale: Locale): CvDocument {
  const { profile, apps } = portfolio;
  const productionSection = sectionById(portfolio, 'apps');
  const depthSection = sectionById(portfolio, 'depth');
  const project = caseStudyBySlug(portfolio, CV_PROJECT_SLUG);

  return {
    locale,
    labels: CV_LABELS[locale],
    identity: {
      fullName: profile.name.full,
      headline: profile.headline,
      facts: [profile.location, profile.remote, profile.languages],
      email: profile.contact.email,
      links: profile.contact.links.map((link) => ({ label: link.label, url: link.url })),
    },
    summary: profile.summary,
    metrics: portfolio.metrics.map((metric) => ({
      value: metric.unit === null ? metric.value : `${metric.value} ${metric.unit}`,
      caption: metric.caption,
    })),
    experience: portfolio.experience.map((job) => ({
      role: job.role,
      organisation: job.organisation,
      location: job.location,
      period: formatPeriod(job.start, job.end, locale),
      roles: job.roles,
      highlights: job.highlights,
      stack: job.stack,
    })),
    project: {
      heading: CV_LABELS[locale].project,
      title: project.title,
      link: project.link,
      tags: project.tags,
      panels: project.chapters.flatMap((chapter) =>
        chapter.panels.flatMap((panel) =>
          panel.blocks
            .filter((block) => block.type === 'list')
            .map((block) => ({ heading: panel.heading, items: block.items })),
        ),
      ),
    },
    expertise: {
      heading: depthSection.eyebrow,
      items: portfolio.expertise.map((item) => ({ title: item.title, body: item.body })),
    },
    skills: portfolio.skills.map((group) => ({ title: group.title, items: group.items })),
    education: portfolio.background.education.map((entry) => ({
      degree: entry.degree,
      school: entry.school,
      detail: entry.detail,
      period: formatYearRange(entry.startYear, entry.endYear),
    })),
    certifications: portfolio.background.certifications.map((entry) => ({
      name: entry.name,
      issuer: entry.issuer,
      awardedOn: formatAwardedOn(entry.awardedOn, locale),
      verifyUrl: entry.verifyUrl,
    })),
    production: {
      heading: productionSection.eyebrow,
      note: productionSection.note,
      networkCount: countByRole(apps, 'ticketing'),
      networks: apps.items.filter((app) => app.role === 'ticketing').map((app) => app.name),
    },
  };
}

/**
 * L'étude de cas qui entre au CV.
 *
 * Le choix est éditorial, donc il est écrit ici, en clair, plutôt que deviné
 * par une heuristique sur les données. Un test garde qu'elle existe.
 */
const CV_PROJECT_SLUG = 'kcalories';

function caseStudyBySlug(portfolio: Portfolio, slug: string) {
  const found = portfolio.caseStudies.find((study) => study.slug === slug);
  if (found === undefined) {
    throw new Error(
      `Le contenu ne décrit pas l'étude de cas « ${slug} » : le CV ne peut pas s'écrire.`,
    );
  }
  return found;
}

/**
 * Le CV lit ses intitulés de section dans le contenu. Une section absente est
 * une erreur de contenu, pas un cas à contourner par un libellé de secours —
 * un libellé de secours serait précisément la seconde source de vérité qu'on
 * refuse partout ailleurs.
 */
function sectionById(portfolio: Portfolio, id: Portfolio['sections'][number]['id']) {
  const found = portfolio.sections.find((section) => section.id === id);
  if (found === undefined) {
    throw new Error(`Le contenu ne décrit pas la section « ${id} » : le CV ne peut pas s'écrire.`);
  }
  return found;
}
