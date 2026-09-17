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
 * Ce qui entre : identité, accroche, chiffres, expériences, profondeur
 * technique, compétences, formation, certifications, projets ouverts, et
 * l'inventaire des réseaux en production.
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
  readonly openProjects: readonly {
    readonly name: string;
    readonly description: RichText;
    readonly sourceUrl: string | null;
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
    openProjects: portfolio.background.openProjects.map((entry) => ({
      name: entry.name,
      description: entry.description,
      sourceUrl: entry.sourceUrl,
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
