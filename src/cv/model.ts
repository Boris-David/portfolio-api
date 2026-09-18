import { countByRole } from '../domain/apps.js';
import type { Locale } from '../domain/locale.js';
import type { Portfolio } from '../domain/portfolio.js';
import type { RichText } from '../domain/rich-text.js';
import { formatAwardedOn, formatPeriod, formatYearRange } from './format.js';
import { CV_LABELS, type CvLabels } from './labels.js';

/**
 * The résumé document model: the **selection** of content that fits on two
 * pages, and nothing else.
 *
 * A résumé is not the printed web page. The page unfolds two case studies, one
 * of them across five pieces of work; pouring those in would produce six pages
 * no recruiter reads. So the selection is explicit here, in readable code,
 * rather than hidden inside markup — and it removes no fact from the content,
 * which the API keeps serving whole.
 *
 * What goes in: identity, headline, figures, jobs, **the product carried end
 * to end**, technical depth, skills, education, certifications, and the
 * inventory of networks in production.
 *
 * What stays out: the **open projects**. A calendar component and an interview
 * exercise weigh nothing next to a product shipped on the App Store, and
 * keeping them pushed the end of the document onto a third page a quarter
 * full. The API still serves them, and the website shows them.
 *
 * KCalories gets room to match what it is, not a line at the bottom of a page:
 * it is the only piece of the file that proves a whole product — four stacks,
 * alone, all the way to the App Store. The ticketing case study is not
 * repeated: the Instant System job already carries the same facts, and writing
 * them twice would weaken them.
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
  /** The personal product, told as a piece of evidence. */
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
 * The case study that makes it onto the résumé.
 *
 * The choice is editorial, so it is written out here rather than guessed by a
 * heuristic over the data. A test guards that it exists.
 */
const CV_PROJECT_SLUG = 'kcalories';

function caseStudyBySlug(portfolio: Portfolio, slug: string) {
  const found = portfolio.caseStudies.find((study) => study.slug === slug);
  if (found === undefined) {
    throw new Error(
      `The content does not describe the case study "${slug}": the résumé cannot be written.`,
    );
  }
  return found;
}

/**
 * The résumé reads its section headings from the content. A missing section is
 * a content error, not a case to work around with a fallback label — a
 * fallback label would be precisely the second source of truth refused
 * everywhere else.
 */
function sectionById(portfolio: Portfolio, id: Portfolio['sections'][number]['id']) {
  const found = portfolio.sections.find((section) => section.id === id);
  if (found === undefined) {
    throw new Error(
      `The content does not describe the section "${id}": the résumé cannot be written.`,
    );
  }
  return found;
}
