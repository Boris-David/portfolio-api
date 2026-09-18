import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from '../domain/locale.js';

/**
 * Choosing the language to serve.
 *
 * Three sources, in this order: the `lang` parameter when given, then
 * `Accept-Language`, then French. The explicit parameter wins because it comes
 * from a deliberate action — the site's language switcher — whereas the header
 * only describes a browser preference.
 *
 * An unknown `lang` value is an **error**, not a silent fallback: a client
 * asking for `?lang=de` must be told, not handed French while believing it got
 * German.
 */
export type LocaleResolution =
  | { readonly ok: true; readonly locale: Locale }
  | { readonly ok: false; readonly requested: string };

export function resolveLocale(
  explicit: string | undefined,
  acceptLanguage: string | undefined,
): LocaleResolution {
  if (explicit !== undefined && explicit !== '') {
    return isLocale(explicit) ? { ok: true, locale: explicit } : { ok: false, requested: explicit };
  }
  return { ok: true, locale: negotiate(acceptLanguage) };
}

const DEFAULT_QUALITY = 1;

/**
 * Negotiates from `Accept-Language`: "fr-FR,fr;q=0.9,en;q=0.8".
 *
 * The prefix is enough (`fr-CA` satisfies `fr`), and the highest quality wins.
 * No match at all: the default language.
 */
export function negotiate(acceptLanguage: string | undefined): Locale {
  if (acceptLanguage === undefined || acceptLanguage.trim() === '') return DEFAULT_LOCALE;

  let best: { locale: Locale; quality: number } | null = null;
  for (const part of acceptLanguage.split(',')) {
    const [tag, ...parameters] = part.trim().split(';');
    if (tag === undefined || tag === '') continue;
    const quality = qualityOf(parameters);
    if (quality <= 0) continue;

    const matched = LOCALES.find(
      (locale) =>
        tag === '*' || tag.toLowerCase() === locale || tag.toLowerCase().startsWith(`${locale}-`),
    );
    if (matched === undefined) continue;
    if (best === null || quality > best.quality) best = { locale: matched, quality };
  }
  return best?.locale ?? DEFAULT_LOCALE;
}

function qualityOf(parameters: readonly string[]): number {
  for (const parameter of parameters) {
    const [key, value] = parameter.trim().split('=');
    if (key?.trim() !== 'q') continue;
    const parsed = Number.parseFloat(value ?? '');
    return Number.isNaN(parsed) ? DEFAULT_QUALITY : parsed;
  }
  return DEFAULT_QUALITY;
}
