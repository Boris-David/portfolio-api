import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { PATHS } from '../node/paths.js';

/**
 * Les tokens de design — la source unique de la **forme**.
 *
 * L'ADR 0004 est explicite : déplacer le gabarit du CV dans l'API déplace le
 * risque de dérive du contenu vers la forme, *sauf* si la mise en page du PDF
 * et celle du site boivent à la même source. Aucune couleur, aucune police,
 * aucune espace n'est donc écrite en dur dans le gabarit : tout vient d'ici.
 *
 * Le fichier est un **instantané** du dépôt hub, qui en est propriétaire (ADR
 * 0001). Ce dépôt doit se cloner et se construire seul, donc il en porte une
 * copie — et `npm run check:tokens` échoue si elle dérive de l'original. Même
 * dispositif que l'instantané embarqué côté iOS : une copie gardée par une
 * vérification, jamais une seconde source de vérité.
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
 * Les tokens, en variables CSS.
 *
 * Le PDF est un document imprimé : il prend systématiquement la déclinaison
 * claire. Le mode sombre n'est pas « non implémenté », il n'a pas de sens sur
 * du papier.
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
