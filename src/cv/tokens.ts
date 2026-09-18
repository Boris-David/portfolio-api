import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { PATHS } from '../node/paths.js';

/**
 * The design tokens — the single source of **form**.
 *
 * ADR 0004 is explicit: moving the résumé template into the API moves the
 * drift risk from content to form, *unless* the PDF's layout and the website's
 * drink from the same source. So no colour, no font and no spacing is
 * hardcoded in the template: everything comes from here.
 *
 * The file is a **snapshot** of the hub repo, which owns it (ADR 0001). This
 * repo has to clone and build on its own, so it carries a copy — and
 * `npm run check:tokens` fails if that copy drifts from the original. Same
 * arrangement as the snapshot embedded on the iOS side: a copy held by a
 * check, never a second source of truth.
 */
const ThemedColorSchema = z.object({ light: z.string(), dark: z.string() });

const TokensSchema = z.object({
  font: z.object({
    display: z.object({ family: z.string(), fallback: z.string() }).loose(),
    text: z.object({ family: z.string(), fallback: z.string() }).loose(),
    mono: z.object({ family: z.string(), fallback: z.string() }).loose(),
  }),
  color: z.record(z.string(), ThemedColorSchema),
  space: z.record(z.string(), z.number()),
  radius: z.record(z.string(), z.number()),
  type: z.record(z.string(), z.number()),
  a11y: z.object({ minTouchTarget: z.number(), contrast: z.string() }).loose(),
});

export type DesignTokens = z.infer<typeof TokensSchema>;

export function loadDesignTokens(path: string = PATHS.designTokens): DesignTokens {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return TokensSchema.parse(stripComments(raw));
}

function stripComments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripComments);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('$'))
      .map(([key, entry]) => [key, stripComments(entry)]),
  );
}

/**
 * The tokens, as CSS variables.
 *
 * The PDF is a printed document: it always takes the light variant. Dark mode
 * is not "not implemented" — it has no meaning on paper.
 */
export function toCssVariables(tokens: DesignTokens): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(tokens.color)) {
    lines.push(`--color-${name}: ${value.light};`);
  }
  for (const [name, value] of Object.entries(tokens.space)) {
    lines.push(`--space-${name}: ${String(value)}px;`);
  }
  for (const [name, value] of Object.entries(tokens.radius)) {
    lines.push(`--radius-${name}: ${String(value)}px;`);
  }
  for (const [name, value] of Object.entries(tokens.type)) {
    lines.push(`--type-${name}: ${String(value)}px;`);
  }
  lines.push(`--font-display-family: "${tokens.font.display.family}";`);
  lines.push(`--font-text-family: "${tokens.font.text.family}";`);
  lines.push(`--font-display: "${tokens.font.display.family}", ${tokens.font.display.fallback};`);
  lines.push(`--font-text: "${tokens.font.text.family}", ${tokens.font.text.fallback};`);
  lines.push(`--font-mono: ${tokens.font.mono.family}, ${tokens.font.mono.fallback};`);
  return lines.join('\n    ');
}
