import type { RichText } from '../domain/rich-text.js';
import { embeddedFontFaces } from './fonts.js';
import type { CvDocument } from './model.js';
import { toCssVariables, type DesignTokens } from './tokens.js';

/**
 * Le gabarit du CV.
 *
 * Aucune valeur de forme n'est écrite ici : couleurs, espaces, rayons et
 * échelle typographique viennent des tokens, comme le CSS du site. C'est la
 * condition posée par l'ADR 0004 — sinon le PDF et le site divergeraient sur
 * la forme, et on aurait seulement déplacé le problème.
 *
 * `--print-density` est la seule constante propre au support : l'échelle des
 * tokens est calée sur le Dynamic Type d'iOS (base 17 px), qui est trop
 * généreux pour une A4. Le facteur s'applique en `calc()` à tous les niveaux,
 * donc les rapports de l'échelle sont conservés.
 */
const PRINT_DENSITY = 0.7;

const PAGE_MARGIN = '14mm 14mm 12mm';

export function renderCvHtml(document: CvDocument, tokens: DesignTokens): string {
  const { labels, identity } = document;
  return `<!doctype html>
<html lang="${document.locale}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`${identity.fullName} — ${labels.documentKind}`)}</title>
<style>
${embeddedFontFaces()}

:root {
    ${toCssVariables(tokens)}
    --print-density: ${String(PRINT_DENSITY)};
    /* Dans un PDF, aucune police système n'existe : la pile d'affichage doit
       retomber sur une police EMBARQUÉE, jamais sur un générique — sinon un
       caractère absent de Fraunces se dessine en carré vide. */
    --cv-display: var(--font-display-family), var(--font-text);
}

@page { size: A4; margin: ${PAGE_MARGIN}; }

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-text);
  font-size: calc(var(--type-body) * var(--print-density));
  line-height: 1.45;
  color: var(--color-ink-2);
  background: #fff;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 { font-family: var(--cv-display); font-weight: 600; color: var(--color-ink); }
code { font-family: var(--font-mono); font-size: 0.93em; }
strong { color: var(--color-ink); font-weight: 600; }
a { color: var(--color-accent-d); text-decoration: none; }
ul { list-style: none; }

section { margin-top: calc(var(--space-5) * var(--print-density)); }
/* Le contenu coule d'une page à l'autre ; seuls les blocs qu'on lit d'un
   bloc — une expérience, une ligne de formation, une carte — refusent d'être
   coupés. Interdire la coupe d'une section entière la repousserait tout
   entière et laisserait une demi-page blanche. */
article, li, .depth > div, .skill-groups > div { break-inside: avoid; }
h2 { break-after: avoid; }

h2 {
  font-family: var(--font-text);
  font-size: calc(var(--type-caption) * var(--print-density));
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--color-accent-d);
  padding-bottom: calc(var(--space-1) * var(--print-density));
  border-bottom: 0.6pt solid var(--color-line);
  margin-bottom: calc(var(--space-4) * var(--print-density));
}

/* ── Identité ── */
.identity { border-bottom: 1.4pt solid var(--color-ink); padding-bottom: calc(var(--space-4) * var(--print-density)); }
.identity h1 {
  font-size: calc(var(--type-large) * var(--print-density));
  line-height: 1.04;
  letter-spacing: -0.028em;
}
.headline {
  font-size: calc(var(--type-title3) * var(--print-density));
  color: var(--color-accent-d);
  font-weight: 600;
  margin-top: calc(var(--space-1) * var(--print-density));
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--space-1) * var(--print-density)) calc(var(--space-4) * var(--print-density));
  margin-top: calc(var(--space-3) * var(--print-density));
  font-size: calc(var(--type-caption) * var(--print-density));
  color: var(--color-ink-3);
}
.facts li::after { content: " ·"; color: var(--color-line-2); }
.facts li:last-child::after { content: ""; }
.facts a { color: var(--color-ink-3); }

/* ── Chiffres ── */
.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: calc(var(--space-4) * var(--print-density));
  margin-top: calc(var(--space-4) * var(--print-density));
  padding: calc(var(--space-3) * var(--print-density)) calc(var(--space-4) * var(--print-density));
  background: var(--color-paper-2);
  border: 0.6pt solid var(--color-line);
  border-radius: calc(var(--radius-md) * var(--print-density));
}
.metrics .value {
  font-family: var(--cv-display);
  font-size: calc(var(--type-title1) * var(--print-density));
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}
.metrics .caption {
  font-size: calc(var(--type-caption) * var(--print-density) * 0.94);
  color: var(--color-ink-3);
  line-height: 1.3;
  margin-top: calc(var(--space-1) * var(--print-density));
}

.summary p + p { margin-top: calc(var(--space-2) * var(--print-density)); }

/* ── Expérience ── */
.job + .job { margin-top: calc(var(--space-4) * var(--print-density)); }
.job-head { display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--space-3) * var(--print-density)); }
.job-head h3 { font-size: calc(var(--type-title3) * var(--print-density)); letter-spacing: -0.015em; }
.job-head .where { font-size: calc(var(--type-subhead) * var(--print-density)); color: var(--color-ink-3); }
.job-head .period {
  font-size: calc(var(--type-caption) * var(--print-density));
  color: var(--color-ink-3);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.roles { display: flex; flex-wrap: wrap; gap: calc(var(--space-1) * var(--print-density)); margin-top: calc(var(--space-2) * var(--print-density)); }
.roles li {
  font-size: calc(var(--type-caption) * var(--print-density) * 0.92);
  font-weight: 600;
  color: var(--color-accent-d);
  background: var(--color-accent-w);
  border-radius: calc(var(--radius-sm) * var(--print-density));
  padding: 0.4mm 1.4mm;
}
.bullets { margin-top: calc(var(--space-3) * var(--print-density)); display: grid; gap: calc(var(--space-2) * var(--print-density)); }
.bullets li { padding-left: 3.4mm; position: relative; }
.bullets li::before {
  content: "";
  position: absolute;
  left: 0.4mm;
  top: 1.5mm;
  width: 1.3mm;
  height: 1.3mm;
  border-radius: 0.4mm;
  background: var(--color-accent);
}
.stack {
  margin-top: calc(var(--space-3) * var(--print-density));
  padding-top: calc(var(--space-2) * var(--print-density));
  border-top: 0.5pt solid var(--color-line);
  font-size: calc(var(--type-caption) * var(--print-density) * 0.92);
  color: var(--color-ink-3);
}
.stack .key { font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-ink-3); }

.depth { display: grid; grid-template-columns: repeat(3, 1fr); gap: calc(var(--space-4) * var(--print-density)); }
.depth h3 { font-size: calc(var(--type-subhead) * var(--print-density) * 1.1); margin-bottom: calc(var(--space-1) * var(--print-density)); }
.depth p { font-size: calc(var(--type-caption) * var(--print-density) * 1.02); color: var(--color-ink-3); line-height: 1.4; }

.skill-groups { display: grid; grid-template-columns: repeat(2, 1fr); gap: calc(var(--space-3) * var(--print-density)) calc(var(--space-6) * var(--print-density)); }
.skill-groups h3 {
  font-family: var(--font-text);
  font-size: calc(var(--type-caption) * var(--print-density) * 0.92);
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--color-ink-3);
  margin-bottom: calc(var(--space-1) * var(--print-density));
}
.chips { display: flex; flex-wrap: wrap; gap: calc(var(--space-1) * var(--print-density)); }
.chips li {
  font-size: calc(var(--type-caption) * var(--print-density) * 0.94);
  padding: 0.4mm 1.5mm;
  border: 0.5pt solid var(--color-line);
  border-radius: calc(var(--radius-sm) * var(--print-density));
  color: var(--color-ink-2);
}

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--space-6) * var(--print-density)); }
.two-col section { margin-top: 0; }
.rows { display: grid; gap: calc(var(--space-3) * var(--print-density)); }
.rows .what { font-weight: 600; color: var(--color-ink); }
.rows .where, .rows .when { font-size: calc(var(--type-caption) * var(--print-density)); color: var(--color-ink-3); }
.rows .when { font-variant-numeric: tabular-nums; }

.production .networks {
  font-size: calc(var(--type-caption) * var(--print-density) * 1.02);
  color: var(--color-ink-2);
  line-height: 1.5;
}
.production .note { font-size: calc(var(--type-caption) * var(--print-density) * 0.94); color: var(--color-ink-3); margin-top: calc(var(--space-2) * var(--print-density)); }
.production .count { font-weight: 600; color: var(--color-ink); }
</style>
</head>
<body>
${identityBlock(document)}
${summaryBlock(document)}
${experienceBlock(document)}
${depthBlock(document)}
${skillsBlock(document)}
${backgroundBlock(document)}
${productionBlock(document)}
</body>
</html>`;
}

function identityBlock(document: CvDocument): string {
  const { identity } = document;
  const facts = [
    ...identity.facts.map(escapeHtml),
    `<a href="mailto:${escapeHtml(identity.email)}">${escapeHtml(identity.email)}</a>`,
    ...identity.links.map(
      (link) => `<a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>`,
    ),
  ];
  return `<header class="identity">
  <h1>${escapeHtml(identity.fullName)}</h1>
  <p class="headline">${escapeHtml(identity.headline)}</p>
  <ul class="facts">${facts.map((fact) => `<li>${fact}</li>`).join('')}</ul>
</header>`;
}

function summaryBlock(document: CvDocument): string {
  return `<section class="summary">
  <h2>${escapeHtml(document.labels.profile)}</h2>
  ${document.summary.map((paragraph) => `<p>${richToHtml(paragraph)}</p>`).join('\n  ')}
  <ul class="metrics">${document.metrics
    .map(
      (metric) =>
        `<li><div class="value">${escapeHtml(metric.value)}</div><div class="caption">${escapeHtml(metric.caption)}</div></li>`,
    )
    .join('')}</ul>
</section>`;
}

function experienceBlock(document: CvDocument): string {
  const jobs = document.experience
    .map(
      (job) => `<article class="job">
    <div class="job-head">
      <div>
        <h3>${escapeHtml(job.role)}</h3>
        <div class="where">${escapeHtml(job.organisation)} · ${escapeHtml(job.location)}</div>
      </div>
      <div class="period">${escapeHtml(job.period)}</div>
    </div>
    ${
      job.roles.length > 0
        ? `<ul class="roles">${job.roles.map((role) => `<li>${escapeHtml(role)}</li>`).join('')}</ul>`
        : ''
    }
    <ul class="bullets">${job.highlights.map((highlight) => `<li>${richToHtml(highlight)}</li>`).join('')}</ul>
    <div class="stack"><span class="key">${escapeHtml(document.labels.stack)}</span> · ${job.stack
      .map(escapeHtml)
      .join(' · ')}</div>
  </article>`,
    )
    .join('\n  ');
  return `<section class="experience">
  <h2>${escapeHtml(document.labels.experience)}</h2>
  ${jobs}
</section>`;
}

function depthBlock(document: CvDocument): string {
  return `<section>
  <h2>${escapeHtml(document.expertise.heading)}</h2>
  <div class="depth">${document.expertise.items
    .map((item) => `<div><h3>${escapeHtml(item.title)}</h3><p>${richToHtml(item.body)}</p></div>`)
    .join('')}</div>
</section>`;
}

function skillsBlock(document: CvDocument): string {
  return `<section>
  <h2>${escapeHtml(document.labels.skills)}</h2>
  <div class="skill-groups">${document.skills
    .map(
      (group) =>
        `<div><h3>${escapeHtml(group.title)}</h3><ul class="chips">${group.items
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul></div>`,
    )
    .join('')}</div>
</section>`;
}

function backgroundBlock(document: CvDocument): string {
  const { labels } = document;
  const education = document.education
    .map(
      (entry) => `<li>
      <div class="when">${escapeHtml(entry.period)}</div>
      <div class="what">${escapeHtml(entry.degree)}</div>
      <div class="where">${escapeHtml(entry.school)}${
        entry.detail === null ? '' : ` — ${escapeHtml(entry.detail)}`
      }</div>
    </li>`,
    )
    .join('');

  const certifications = document.certifications
    .map(
      (entry) => `<li>
      <div class="when">${escapeHtml(entry.awardedOn)}</div>
      <div class="what">${escapeHtml(entry.name)}</div>
      <div class="where">${escapeHtml(entry.issuer)}${
        entry.verifyUrl === null
          ? ''
          : ` — <a href="${escapeHtml(entry.verifyUrl)}">${escapeHtml(labels.verify)}</a>`
      }</div>
    </li>`,
    )
    .join('');

  const projects = document.openProjects
    .map(
      (entry) => `<li>
      <div class="what">${escapeHtml(entry.name)}</div>
      <div class="where">${richToHtml(entry.description)}${
        entry.sourceUrl === null
          ? ''
          : ` — <a href="${escapeHtml(entry.sourceUrl)}">${escapeHtml(entry.sourceUrl)}</a>`
      }</div>
    </li>`,
    )
    .join('');

  return `<div class="two-col" style="margin-top: calc(var(--space-6) * var(--print-density))">
  <section>
    <h2>${escapeHtml(labels.education)}</h2>
    <ul class="rows">${education}</ul>
  </section>
  <section>
    <h2>${escapeHtml(labels.certifications)}</h2>
    <ul class="rows">${certifications}</ul>
    <h2 style="margin-top: calc(var(--space-5) * var(--print-density))">${escapeHtml(labels.openProjects)}</h2>
    <ul class="rows">${projects}</ul>
  </section>
</div>`;
}

function productionBlock(document: CvDocument): string {
  const { production } = document;
  return `<section class="production">
  <h2>${escapeHtml(production.heading)}</h2>
  <p class="networks"><span class="count">${String(production.networkCount)}</span> — ${production.networks
    .map(escapeHtml)
    .join(' · ')}</p>
  ${production.note === null ? '' : `<p class="note">${richToHtml(production.note)}</p>`}
</section>`;
}

/** Le texte enrichi en HTML — jamais du HTML stocké, toujours des spans rendus. */
export function richToHtml(rich: RichText): string {
  return rich
    .map((span) => {
      const text = escapeHtml(span.text);
      switch (span.style) {
        case 'strong':
          return `<strong>${text}</strong>`;
        case 'code':
          return `<code>${text}</code>`;
        case 'plain':
          return text;
      }
    })
    .join('');
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}
