import { z } from 'zod';

/**
 * Les deux langues du portfolio. Elles ne sont pas une option de confort : la
 * cible inclut le remote parisien et international, donc le contenu est
 * bilingue **de bout en bout** — aucune ressource n'existe dans une seule
 * langue.
 */
export const LOCALES = ['fr', 'en'] as const;

export const LocaleSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof LocaleSchema>;

/** La langue servie quand la requête n'en demande aucune. */
export const DEFAULT_LOCALE: Locale = 'fr';

export function isLocale(candidate: string): candidate is Locale {
  return (LOCALES as readonly string[]).includes(candidate);
}

/**
 * Une valeur portée dans chaque langue. C'est le type du **contenu stocké** ;
 * l'API, elle, ne sert jamais cette forme — elle en sert la projection pour
 * une locale (voir `content/projection.ts`). Garder la paire côté stockage
 * rend l'oubli de traduction impossible : le schéma exige les deux clés.
 */
export type Localized<T> = Readonly<Record<Locale, T>>;
