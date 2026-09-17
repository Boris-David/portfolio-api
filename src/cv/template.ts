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
 * tokens est calée sur le Dynamic Type d'iOS (base 17 px), trop généreux pour
 * une A4. Le facteur s'applique en `calc()` à tous les niveaux, donc les
 * rapports de l'échelle sont conservés.
 */
const PRINT_DENSITY = 0.68;

/**
 * L'interlettrage des intitulés en capitales.
 *
 * Il est **volontairement discret**. À cette taille, un interlettrage large
 * disloque les mots — « COMPÉT ENCES », « S TACK » — et donne un document qui
 * a l'air cassé. Ce qui distingue un intitulé, c'est la graisse, la couleur et
 * le filet sous lui ; l'espacement n'est qu'une respiration.
 */
const CAPS_TRACKING = '0.035em';
const MICRO_CAPS_TRACKING = '0.028em';

const PAGE_MARGIN = '13mm 13mm 11mm';

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

    /* Le rythme vertical, dérivé une seule fois puis réutilisé partout : c'est
       lui qui fait qu'un document « respire » au lieu d'alterner tassé et vide. */
    --gap-1: calc(var(--space-1) * var(--print-density));
    --gap-2: calc(var(--space-2) * var(--print-density));
    --gap-3: calc(var(--space-3) * var(--print-density));
    --gap-4: calc(var(--space-4) * var(--print-density));
    --gap-5: calc(var(--space-5) * var(--print-density));
    --gap-6: calc(var(--space-6) * var(--print-density));

    --size-caption: calc(var(--type-caption) * var(--print-density));
    --size-subhead: calc(var(--type-subhead) * var(--print-density));
    --size-body: calc(var(--type-body) * var(--print-density));
    --size-title3: calc(var(--type-title3) * var(--print-density));
    --size-title1: calc(var(--type-title1) * var(--print-density));
    --size-large: calc(var(--type-large) * var(--print-density));
}

@page { size: A4; margin: ${PAGE_MARGIN}; }

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-text);
  font-size: var(--size-body);
  line-height: 1.5;
  color: var(--color-ink-2);
  background: #fff;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

h1, h2, h3, h4 { font-weight: 600; color: var(--color-ink); }
code { font-family: var(--font-mono); font-size: 0.92em; }
strong { color: var(--color-ink); font-weight: 600; }
a { color: var(--color-accent-d); text-decoration: none; }
ul { list-style: none; }

/* Le contenu coule d'une page à l'autre ; seuls les blocs qu'on lit d'un bloc
   refusent d'être coupés. Interdire la coupe d'une expérience entière la
   repousserait tout entière et laisserait une demi-page blanche. */
li, .rows li, .job-head, .product-head { break-inside: avoid; }
h2, h3, h4 { break-after: avoid; }
/* Une ligne isolée en haut ou en bas de page est laide ; deux, c'est une
   demi-page perdue. Trois lignes de part et d'autre : le compromis tient le
   document plein sans orpheline. */
p { orphans: 3; widows: 3; }

section { margin-top: var(--gap-5); }

/* ── Intitulés de section ── */
h2 {
  font-family: var(--font-text);
  font-size: calc(var(--size-subhead) * 1.02);
  font-weight: 700;
  letter-spacing: ${CAPS_TRACKING};
  text-transform: uppercase;
  color: var(--color-accent-d);
  padding-bottom: var(--gap-1);
  border-bottom: 0.7pt solid var(--color-line-2);
  margin-bottom: var(--gap-4);
}

/* ── Identité ── */
.identity { border-bottom: 1.6pt solid var(--color-ink); padding-bottom: var(--gap-4); }
.identity h1 {
  font-family: var(--cv-display);
  font-size: calc(var(--size-large) * 1.12);
  line-height: 1.02;
  letter-spacing: -0.03em;
}
.headline {
  font-size: var(--size-title3);
  color: var(--color-accent-d);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-top: var(--gap-1);
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-1) var(--gap-3);
  margin-top: var(--gap-3);
  font-size: calc(var(--size-caption) * 0.95);
  line-height: 1.4;
  color: var(--color-ink-3);
}
.facts li::after { content: " ·"; color: var(--color-line-2); }
.facts li:last-child::after { content: ""; }
.facts a { color: var(--color-ink-2); font-weight: 500; }

/* ── Chiffres ── */
.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--gap-5);
  margin-top: var(--gap-4);
  padding: var(--gap-2) var(--gap-5);
  background: var(--color-paper-2);
  border: 0.6pt solid var(--color-line);
  border-radius: calc(var(--radius-md) * var(--print-density));
}
.metrics .value {
  font-family: var(--cv-display);
  font-size: var(--size-title1);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}
.metrics .caption {
  font-size: calc(var(--size-caption) * 0.97);
  color: var(--color-ink-3);
  line-height: 1.4;
  margin-top: var(--gap-1);
}

.summary p { max-width: 96%; }
.summary p + p { margin-top: var(--gap-2); }

/* ── Expérience ──
   L'entreprise et la période portent le bloc : c'est « où » et « quand » qu'un
   lecteur cherche d'abord en parcourant un CV. L'intitulé de poste vient
   ensuite, en accent. */
.job + .job { margin-top: var(--gap-5); }
.job-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--gap-4);
  border-bottom: 0.5pt solid var(--color-line);
  padding-bottom: var(--gap-1);
}
.job-head h3 {
  font-family: var(--cv-display);
  font-size: var(--size-title3);
  line-height: 1.15;
  letter-spacing: -0.018em;
}
.job-when {
  font-size: var(--size-subhead);
  font-weight: 600;
  color: var(--color-ink-2);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
/* Le poste et ses étiquettes tiennent sur une seule ligne : elles se lisent
   ensemble, et une rangée séparée coûtait une ligne par expérience. */
.job-role {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--gap-1) var(--gap-2);
  font-size: var(--size-body);
  font-weight: 600;
  color: var(--color-accent-d);
  margin-top: var(--gap-2);
}
.roles { display: contents; }
.roles li {
  font-size: calc(var(--size-caption) * 0.95);
  font-weight: 600;
  color: var(--color-accent-d);
  background: var(--color-accent-w);
  border-radius: calc(var(--radius-sm) * var(--print-density));
  padding: 0.5mm 1.6mm;
}

.bullets { margin-top: var(--gap-3); display: grid; gap: var(--gap-2); }
.bullets li { padding-left: 3.6mm; position: relative; }
.bullets li::before {
  content: "";
  position: absolute;
  left: 0.5mm;
  top: 1.7mm;
  width: 1.2mm;
  height: 1.2mm;
  border-radius: 0.35mm;
  background: var(--color-accent);
}

.stack {
  margin-top: var(--gap-3);
  font-size: calc(var(--size-caption) * 0.9);
  line-height: 1.45;
  color: var(--color-ink-3);
}
.stack .key {
  font-weight: 700;
  letter-spacing: ${MICRO_CAPS_TRACKING};
  text-transform: uppercase;
  color: var(--color-ink-2);
}

/* ── Le produit tenu de bout en bout ── */
.product-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--gap-4);
  border-bottom: 0.5pt solid var(--color-line);
  padding-bottom: var(--gap-1);
}
.product-head h3 {
  font-family: var(--cv-display);
  font-size: var(--size-title3);
  line-height: 1.15;
  letter-spacing: -0.018em;
}
.product-link {
  font-size: var(--size-subhead);
  font-weight: 600;
  white-space: nowrap;
}
.product-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap-4) var(--gap-6);
  margin-top: var(--gap-3);
}
.product-panels h4 {
  font-family: var(--font-text);
  font-size: calc(var(--size-caption) * 0.95);
  font-weight: 700;
  letter-spacing: ${MICRO_CAPS_TRACKING};
  text-transform: uppercase;
  color: var(--color-ink-3);
}
.product-panels .bullets { margin-top: var(--gap-2); }

/* ── Profondeur technique ── */
/* Colonnes plutôt que grille : une grille CSS ne se fragmente pas entre deux
   pages — elle bascule tout entière et laisse une demi-page blanche. Les
   colonnes, elles, coulent. C'est ce qui remplit les pages au lieu de les
   trouer. */
.depth { column-count: 3; column-gap: var(--gap-5); }
.depth > div { break-inside: avoid; }
.depth h3 {
  font-family: var(--cv-display);
  font-size: calc(var(--size-subhead) * 1.12);
  line-height: 1.2;
  letter-spacing: -0.012em;
  margin-bottom: var(--gap-1);
}
.depth p { font-size: calc(var(--size-caption) * 1.02); color: var(--color-ink-3); line-height: 1.4; }

/* ── Compétences ── */
.skill-groups { column-count: 2; column-gap: var(--gap-6); }
.skill-groups > div { break-inside: avoid; margin-bottom: var(--gap-3); }
.skill-groups h3 {
  font-family: var(--font-text);
  font-size: calc(var(--size-caption) * 0.95);
  font-weight: 700;
  letter-spacing: ${MICRO_CAPS_TRACKING};
  text-transform: uppercase;
  color: var(--color-ink-3);
  margin-bottom: var(--gap-1);
}
.chips { display: flex; flex-wrap: wrap; gap: var(--gap-1); }
.chips li {
  font-size: calc(var(--size-caption) * 0.95);
  padding: 0.5mm 1.7mm;
  border: 0.5pt solid var(--color-line);
  border-radius: calc(var(--radius-sm) * var(--print-density));
  color: var(--color-ink-2);
}

/* ── Formation, certifications, projets ── */
.two-col { margin-top: var(--gap-5); column-count: 2; column-gap: var(--gap-6); }
.two-col section { margin-top: 0; break-inside: avoid; }
.two-col section + section { margin-top: var(--gap-5); }
.rows { display: grid; gap: var(--gap-2); }
.rows .what { font-weight: 600; color: var(--color-ink); line-height: 1.3; }
.rows .where { font-size: calc(var(--size-caption) * 1.02); color: var(--color-ink-3); line-height: 1.4; }
.rows .when {
  font-size: var(--size-caption);
  color: var(--color-ink-3);
  font-variant-numeric: tabular-nums;
}


/* ── En production ── */
.production .networks {
  font-size: calc(var(--size-caption) * 1.02);
  color: var(--color-ink-2);
  line-height: 1.6;
}
.production .note {
  font-size: calc(var(--size-caption) * 0.95);
  color: var(--color-ink-3);
  line-height: 1.45;
  margin-top: var(--gap-2);
}
.production .count { font-weight: 700; color: var(--color-ink); }
</style>
</head>
<body>
${identityBlock(document)}
${summaryBlock(document)}
${experienceBlock(document)}
${projectBlock(document)}
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
      <h3>${escapeHtml(job.organisation)}</h3>
      <div class="job-when">${escapeHtml(job.location)} · ${escapeHtml(job.period)}</div>
    </div>
    <div class="job-role">
      <span>${escapeHtml(job.role)}</span>
      ${
        job.roles.length > 0
          ? `<ul class="roles">${job.roles.map((role) => `<li>${escapeHtml(role)}</li>`).join('')}</ul>`
          : ''
      }
    </div>
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

function projectBlock(document: CvDocument): string {
  const { project } = document;
  const panels = project.panels
    .map(
      (panel) =>
        `<div><h4>${escapeHtml(panel.heading)}</h4><ul class="bullets">${panel.items
          .map((item) => `<li>${richToHtml(item)}</li>`)
          .join('')}</ul></div>`,
    )
    .join('');

  return `<section class="project">
  <h2>${escapeHtml(project.heading)}</h2>
  <article class="product">
    <div class="product-head">
      <h3>${escapeHtml(project.title)}</h3>
      ${
        project.link === null
          ? ''
          : `<a class="product-link" href="${escapeHtml(project.link.url)}">${escapeHtml(project.link.label)}</a>`
      }
    </div>
    <div class="product-panels">${panels}</div>
    <div class="stack"><span class="key">${escapeHtml(document.labels.stack)}</span> · ${project.tags
      .map(escapeHtml)
      .join(' · ')}</div>
  </article>
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

  return `<div class="two-col">
  <section>
    <h2>${escapeHtml(labels.education)}</h2>
    <ul class="rows">${education}</ul>
  </section>
  <section>
    <h2>${escapeHtml(labels.certifications)}</h2>
    <ul class="rows">${certifications}</ul>
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
